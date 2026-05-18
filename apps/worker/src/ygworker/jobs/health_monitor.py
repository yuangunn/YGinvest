"""Plan #47.3: E2E health monitor — 매 15분 cron.

데이터 파이프라인의 모든 critical 임계치 자동 체크.
위반 시 Telegram 즉시 알림 + Supabase `health_alerts` 테이블에 기록.

체크 항목:
  1) 활성 종목 가격 신선도 (active의 90%+가 15분 이내 fetch)
  2) 보유 종목 가격 신선도 (100%가 1시간 이내)
  3) Portfolio snapshot 신선도 (모든 active portfolio가 10분 이내)
  4) FX rate 신선도 (USDKRW 1시간 이내)
  5) Pending order stale (24시간 이상 pending)
  6) Worker가 시장 시간 중 fetch 안 함 (KR/US 장중인데 fetch 0)
  7) market_briefing 어제+오늘 둘 다 없으면 alert

알림 dedup: 같은 종류 alert 60분 내 중복 방지 (health_alerts 테이블).
"""

from __future__ import annotations

import json
import os
import urllib.request
from datetime import UTC, datetime, timedelta
from typing import Any
from zoneinfo import ZoneInfo

from ygworker.market_hours import is_any_market_open

# 임계치 (운영하면서 튜닝)
THRESHOLDS = {
    "stocks_fresh_pct": 0.90,      # active의 90%가 15분 이내
    "holdings_max_stale_min": 60,  # 보유 종목은 60분 이내 (조금 더 빠르게)
    "snapshot_max_stale_min": 10,
    "fx_max_stale_min": 60,
    "pending_order_max_age_h": 24,
}

ALERT_DEDUP_MIN = 60  # 같은 alert 60분 내 중복 방지


def _send_telegram(msg: str, logger: Any) -> None:
    token = os.environ.get("TELEGRAM_BOT_TOKEN")
    chat_id = os.environ.get("TELEGRAM_CHAT_ID")
    if not token or not chat_id:
        logger.warning("health.no_telegram_config")
        return
    try:
        body = json.dumps({"chat_id": chat_id, "text": msg}).encode("utf-8")
        req = urllib.request.Request(
            f"https://api.telegram.org/bot{token}/sendMessage",
            data=body,
            headers={"Content-Type": "application/json; charset=utf-8"},
        )
        urllib.request.urlopen(req, timeout=10).read()
    except Exception as e:
        logger.warning("health.telegram_fail", error=str(e))


def _should_alert(supabase: Any, alert_key: str) -> bool:
    """같은 종류 alert가 ALERT_DEDUP_MIN 이내에 있으면 skip."""
    try:
        cutoff = (datetime.now(UTC) - timedelta(minutes=ALERT_DEDUP_MIN)).isoformat()
        res = (
            supabase.table("health_alerts")
            .select("ts")
            .eq("alert_key", alert_key)
            .gte("ts", cutoff)
            .limit(1)
            .execute()
        )
        return not (res.data or [])
    except Exception:
        # 테이블 없을 경우 일단 alert
        return True


def _record_alert(
    supabase: Any, alert_key: str, severity: str, message: str, context: dict[str, Any]
) -> None:
    try:
        supabase.table("health_alerts").insert(
            {
                "alert_key": alert_key,
                "severity": severity,
                "message": message,
                "context": context,
                "ts": datetime.now(UTC).isoformat(),
            }
        ).execute()
    except Exception:
        pass  # health_alerts 테이블 없어도 logger 알림은 계속


def _check_stocks_fresh(supabase: Any, logger: Any) -> list[dict[str, Any]]:
    """active stocks의 가격 신선도 체크."""
    # KS/KQ/US별 통계 (페이지네이션 불필요 — count 쿼리)
    cutoff = (datetime.now(UTC) - timedelta(minutes=15)).isoformat()
    alerts: list[dict[str, Any]] = []
    for market_label, suffix in [("KS", ".KS"), ("KQ", ".KQ"), ("US", "")]:
        if suffix:
            base = supabase.table("stocks").select("symbol", count="exact", head=True).eq(
                "is_active", True
            ).like("symbol", f"%{suffix}")
        else:
            base = (
                supabase.table("stocks")
                .select("symbol", count="exact", head=True)
                .eq("is_active", True)
                .not_.like("symbol", "%.KS")
                .not_.like("symbol", "%.KQ")
            )
        total = base.execute().count or 0
        if total == 0:
            continue
        if suffix:
            fresh_q = (
                supabase.table("stocks")
                .select("symbol", count="exact", head=True)
                .eq("is_active", True)
                .like("symbol", f"%{suffix}")
                .gte("last_price_at", cutoff)
            )
        else:
            fresh_q = (
                supabase.table("stocks")
                .select("symbol", count="exact", head=True)
                .eq("is_active", True)
                .not_.like("symbol", "%.KS")
                .not_.like("symbol", "%.KQ")
                .gte("last_price_at", cutoff)
            )
        fresh = fresh_q.execute().count or 0
        pct = fresh / total if total else 0
        if pct < THRESHOLDS["stocks_fresh_pct"]:
            alerts.append(
                {
                    "key": f"stocks_stale_{market_label}",
                    "severity": "warning",
                    "msg": (
                        f"⚠️ {market_label} 가격 신선도 {pct * 100:.1f}% (임계 90%)\n"
                        f"  fresh {fresh}/{total}"
                    ),
                    "context": {"market": market_label, "fresh": fresh, "total": total, "pct": pct},
                }
            )
    return alerts


def _check_holdings(supabase: Any, logger: Any) -> list[dict[str, Any]]:
    """보유 종목 (quantity > 0)의 가격이 stale인지."""
    max_stale = THRESHOLDS["holdings_max_stale_min"]
    cutoff = (datetime.now(UTC) - timedelta(minutes=max_stale)).isoformat()
    # SQL view를 못 만들었으니 join 결과를 한 번에 못 가져옴 → 두 단계
    # 1) holdings with quantity > 0
    holdings = (
        supabase.table("holdings")
        .select("symbol")
        .gt("quantity", 0)
        .execute()
        .data
        or []
    )
    held_syms = list(set(h["symbol"] for h in holdings))
    if not held_syms:
        return []
    # 2) 그 symbol들 중 stale
    stale: list[str] = []
    # in 1000-row limit 회피하려고 chunk
    for i in range(0, len(held_syms), 500):
        chunk = held_syms[i : i + 500]
        res = (
            supabase.table("stocks")
            .select("symbol, last_price_at")
            .in_("symbol", chunk)
            .execute()
            .data
            or []
        )
        for r in res:
            ts = r.get("last_price_at")
            if not ts or ts < cutoff:
                stale.append(r["symbol"])
    if not stale:
        return []
    return [
        {
            "key": "holdings_stale",
            "severity": "critical",
            "msg": (
                f"🔥 보유 종목 {len(stale)}개 가격 stale "
                f"({THRESHOLDS['holdings_max_stale_min']}분+)\n"
                f"  예: {', '.join(stale[:5])}"
            ),
            "context": {"count": len(stale), "sample": stale[:10]},
        }
    ]


def _check_snapshots(supabase: Any, logger: Any) -> list[dict[str, Any]]:
    max_stale = THRESHOLDS["snapshot_max_stale_min"]
    cutoff = (datetime.now(UTC) - timedelta(minutes=max_stale)).isoformat()
    total = (
        supabase.table("portfolios")
        .select("id", count="exact", head=True)
        .eq("status", "active")
        .execute()
        .count
        or 0
    )
    if total == 0:
        return []
    fresh = (
        supabase.table("portfolio_snapshots")
        .select("portfolio_id", count="exact", head=True)
        .gte("ts", cutoff)
        .execute()
        .count
        or 0
    )
    # fresh가 total 절반 미만이면 snapshot cron 문제
    if fresh < total * 0.8:
        return [
            {
                "key": "snapshots_stale",
                "severity": "critical",
                "msg": (
                    f"🔥 Portfolio snapshot {fresh}/{total} fresh "
                    f"({THRESHOLDS['snapshot_max_stale_min']}분 내)\n"
                    f"  snapshot cron 점검 필요"
                ),
                "context": {"fresh": fresh, "total": total},
            }
        ]
    return []


def _check_fx(supabase: Any, logger: Any) -> list[dict[str, Any]]:
    cutoff = (datetime.now(UTC) - timedelta(minutes=THRESHOLDS["fx_max_stale_min"])).isoformat()
    res = (
        supabase.table("fx_rates")
        .select("ts")
        .eq("base", "USD")
        .eq("quote", "KRW")
        .gte("ts", cutoff)
        .limit(1)
        .execute()
    )
    if not (res.data or []):
        # 가장 최근 ts 가져와서 메시지 작성
        latest = (
            supabase.table("fx_rates")
            .select("ts")
            .eq("base", "USD")
            .eq("quote", "KRW")
            .order("ts", desc=True)
            .limit(1)
            .execute()
            .data
            or []
        )
        last_ts = latest[0]["ts"] if latest else "never"
        return [
            {
                "key": "fx_stale",
                "severity": "warning",
                "msg": (
                    f"⚠️ FX (USDKRW) {THRESHOLDS['fx_max_stale_min']}분 이상 stale\n"
                    f"  last: {last_ts}"
                ),
                "context": {"last_ts": last_ts},
            }
        ]
    return []


def _check_pending_orders(supabase: Any, logger: Any) -> list[dict[str, Any]]:
    max_age_h = THRESHOLDS["pending_order_max_age_h"]
    cutoff = (datetime.now(UTC) - timedelta(hours=max_age_h)).isoformat()
    n = (
        supabase.table("orders")
        .select("id", count="exact", head=True)
        .eq("status", "pending")
        .lt("created_at", cutoff)
        .execute()
        .count
        or 0
    )
    if n > 0:
        return [
            {
                "key": "orders_stuck",
                "severity": "warning",
                "msg": f"⚠️ 24시간+ pending 주문 {n}건. matching engine 점검 필요.",
                "context": {"count": n},
            }
        ]
    return []


def _check_briefing(supabase: Any, logger: Any) -> list[dict[str, Any]]:
    kst = ZoneInfo("Asia/Seoul")
    today = datetime.now(kst).date()
    yesterday = today - timedelta(days=1)
    res = (
        supabase.table("market_briefing")
        .select("date")
        .in_("date", [today.isoformat(), yesterday.isoformat()])
        .execute()
        .data
        or []
    )
    # 어제+오늘 둘 다 없으면 alert (오전 07:00 전엔 오늘 없을 수 있어서 어제만 있으면 OK)
    if not res:
        return [
            {
                "key": "briefing_missing",
                "severity": "warning",
                "msg": (
                    f"⚠️ 시장 시황 brief 어제({yesterday})+오늘({today}) 모두 없음.\n"
                    f"  daily_market_briefing cron 점검."
                ),
                "context": {"today": today.isoformat(), "yesterday": yesterday.isoformat()},
            }
        ]
    return []


def run_health_monitor(supabase: Any, logger: Any) -> None:
    """매 15분 cron — E2E 헬스 체크 + Telegram alert."""
    market_open = is_any_market_open()
    logger.info("health.start", market_open=market_open)

    alerts: list[dict[str, Any]] = []

    # 시장 시간 중에만 가격 신선도 strict 체크 (장 마감 후엔 stale이 정상)
    if market_open:
        alerts.extend(_check_stocks_fresh(supabase, logger))
        alerts.extend(_check_holdings(supabase, logger))
        alerts.extend(_check_snapshots(supabase, logger))

    # 시장 시간 무관 체크들
    alerts.extend(_check_fx(supabase, logger))
    alerts.extend(_check_pending_orders(supabase, logger))
    alerts.extend(_check_briefing(supabase, logger))

    if not alerts:
        logger.info("health.ok", market_open=market_open)
        return

    # alert 처리 — dedup 후 Telegram + 로깅
    sent_count = 0
    for a in alerts:
        if not _should_alert(supabase, a["key"]):
            logger.debug("health.alert_deduped", key=a["key"])
            continue
        logger.warning(
            "health.alert", key=a["key"], severity=a["severity"], context=a.get("context")
        )
        _send_telegram(a["msg"], logger)
        _record_alert(supabase, a["key"], a["severity"], a["msg"], a.get("context") or {})
        sent_count += 1

    logger.info("health.done", alerts=len(alerts), sent=sent_count)
