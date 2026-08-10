#!/usr/bin/env python3
"""Plan #48: 외부 dead-man's switch — 워커 생존 감지.

워커 *밖*(GitHub Actions cron)에서 실행된다. worker_heartbeat 테이블의 ts가
임계치보다 오래됐으면 워커가 죽은 것으로 보고 Telegram 알림을 보낸다.

핵심: 기존 health_monitor 는 워커 프로세스 *안*에서 돌기 때문에, 워커가 죽으면
알림도 같이 죽는다. 이 스크립트는 워커와 완전히 독립적이라 워커가 죽어도
(심지어 VM 전체가 꺼져도) 알림이 나간다.

신호원: worker_heartbeat.ts — heartbeat 잡이 매 60초 갱신. 시장 시간과
무관하게 항상 돌므로 ts staleness = 워커 다운.

상태 전이 (health_alerts 테이블로 추적, 외부 DB라 stateless GH Actions에서도 동작):
  - 다운 감지 → worker_down alert (DEDUP_MIN 내 중복 방지, 그 후엔 재알림)
  - 복구 감지 → worker_recovered alert 1회

필요 env:
  SUPABASE_URL                필수
  SUPABASE_SERVICE_ROLE_KEY   필수 (RLS 우회 + health_alerts 기록)
  TELEGRAM_BOT_TOKEN          필수
  TELEGRAM_CHAT_ID            필수
  STALE_THRESHOLD_MIN         선택, 기본 15 (분)
  DEDUP_MIN                   선택, 기본 60 (분) — 다운 중 재알림 간격
"""

from __future__ import annotations

import json
import os
import sys
import urllib.error
import urllib.request
from datetime import UTC, datetime, timedelta

STALE_THRESHOLD_MIN = int(os.environ.get("STALE_THRESHOLD_MIN", "15"))
DEDUP_MIN = int(os.environ.get("DEDUP_MIN", "60"))
HTTP_TIMEOUT = 15


def _log(msg: str) -> None:
    print(f"[deadman] {msg}", flush=True)


def _env(name: str) -> str:
    val = os.environ.get(name, "").strip()
    if not val:
        _log(f"FATAL: env {name} 미설정")
        sys.exit(2)
    return val


def _rest_headers(key: str) -> dict[str, str]:
    return {
        "apikey": key,
        "Authorization": f"Bearer {key}",
        "Content-Type": "application/json",
    }


def _rest_get(url: str, key: str, path: str) -> list[dict]:
    req = urllib.request.Request(
        f"{url}/rest/v1/{path}", headers=_rest_headers(key), method="GET"
    )
    with urllib.request.urlopen(req, timeout=HTTP_TIMEOUT) as resp:
        return json.loads(resp.read().decode("utf-8"))


def _rest_insert(url: str, key: str, table: str, row: dict) -> None:
    headers = _rest_headers(key)
    headers["Prefer"] = "return=minimal"
    body = json.dumps(row).encode("utf-8")
    req = urllib.request.Request(
        f"{url}/rest/v1/{table}", data=body, headers=headers, method="POST"
    )
    urllib.request.urlopen(req, timeout=HTTP_TIMEOUT).read()


def _send_telegram(token: str, chat_id: str, msg: str) -> None:
    body = json.dumps({"chat_id": chat_id, "text": msg}).encode("utf-8")
    req = urllib.request.Request(
        f"https://api.telegram.org/bot{token}/sendMessage",
        data=body,
        headers={"Content-Type": "application/json; charset=utf-8"},
    )
    urllib.request.urlopen(req, timeout=HTTP_TIMEOUT).read()


def _parse_ts(ts: str) -> datetime:
    # supabase ISO ts (예: 2026-06-15T00:01:02.345+00:00 또는 ...Z)
    return datetime.fromisoformat(ts.replace("Z", "+00:00"))


def _last_worker_state(url: str, key: str) -> str | None:
    """가장 최근 worker_down / worker_recovered alert 종류 반환 (없으면 None)."""
    try:
        rows = _rest_get(
            url,
            key,
            "health_alerts?alert_key=in.(worker_down,worker_recovered)"
            "&select=alert_key,ts&order=ts.desc&limit=1",
        )
        return rows[0]["alert_key"] if rows else None
    except Exception as e:  # fail-open: 상태 모르면 None
        _log(f"WARN: last_state 조회 실패 — {e}")
        return None


def _recent_alert_key(url: str, key: str, alert_key: str) -> bool:
    """DEDUP_MIN 내 해당 alert_key 가 있으면 True (재알림 억제)."""
    try:
        cutoff = (datetime.now(UTC) - timedelta(minutes=DEDUP_MIN)).isoformat()
        rows = _rest_get(
            url,
            key,
            f"health_alerts?alert_key=eq.{alert_key}&ts=gte.{cutoff}"
            "&select=ts&limit=1",
        )
        return bool(rows)
    except Exception:
        return False  # 모르면 알림 보내는 쪽(fail-loud)


def _record(url: str, key: str, alert_key: str, severity: str, message: str, ctx: dict) -> None:
    try:
        _rest_insert(
            url,
            key,
            "health_alerts",
            {
                "alert_key": alert_key,
                "severity": severity,
                "message": message,
                "context": ctx,
                "ts": datetime.now(UTC).isoformat(),
            },
        )
    except Exception as e:
        _log(f"WARN: health_alerts 기록 실패 — {e}")


def main() -> int:
    url = _env("SUPABASE_URL").rstrip("/")
    key = _env("SUPABASE_SERVICE_ROLE_KEY")
    tg_token = _env("TELEGRAM_BOT_TOKEN")
    tg_chat = _env("TELEGRAM_CHAT_ID")

    # 1) heartbeat ts 조회
    age_min: float | None = None
    last_ts_str = "never"
    meta: dict = {}
    query_error: str | None = None
    try:
        rows = _rest_get(url, key, "worker_heartbeat?id=eq.worker&select=ts,meta&limit=1")
        if rows:
            last_ts = _parse_ts(rows[0]["ts"])
            last_ts_str = rows[0]["ts"]
            age_min = (datetime.now(UTC) - last_ts).total_seconds() / 60
            meta = rows[0].get("meta") or {}
    except urllib.error.URLError as e:
        query_error = f"Supabase 도달 실패: {e}"
    except Exception as e:
        query_error = f"조회 오류: {e}"

    # 2) 다운 여부 판정
    #    - 조회 실패: Supabase 자체 문제일 수 있음 → 알림 (모니터가 눈 감으면 안 됨)
    #    - ts 없음 또는 임계 초과: 워커 다운
    if query_error is not None:
        down = True
        reason = query_error
        ctx = {"error": query_error}
    elif age_min is None:
        down = True
        reason = "worker_heartbeat 행 없음 (워커가 한 번도 기록 안 함?)"
        ctx = {"last_ts": last_ts_str}
    elif age_min > STALE_THRESHOLD_MIN:
        down = True
        reason = f"heartbeat {age_min:.1f}분 전 (임계 {STALE_THRESHOLD_MIN}분)"
        ctx = {"last_ts": last_ts_str, "age_min": round(age_min, 1)}
    else:
        down = False
        reason = f"heartbeat {age_min:.1f}분 전 — 정상"
        ctx = {"last_ts": last_ts_str, "age_min": round(age_min, 1)}

    _log(reason)

    last_state = _last_worker_state(url, key)

    if down:
        # DEDUP_MIN 내 이미 down 알림 보냈으면 skip (도배 방지)
        if _recent_alert_key(url, key, "worker_down"):
            _log("최근 worker_down 알림 있음 — 재알림 skip")
            return 0
        msg = (
            "🚨 YGinvest 워커 다운 감지 (외부 모니터)\n"
            f"  {reason}\n"
            f"  마지막 heartbeat: {last_ts_str}\n\n"
            "복구: ssh -i ~/.ssh/oracle-yginvest.key ubuntu@168.110.114.1 "
            "'bash ~/redeploy.sh'\n"
            "(SSH 불가 시 Oracle Console에서 VM Start)"
        )
        try:
            _send_telegram(tg_token, tg_chat, msg)
            _log("Telegram worker_down 알림 전송")
        except Exception as e:
            _log(f"ERROR: Telegram 전송 실패 — {e}")
            return 1
        _record(url, key, "worker_down", "critical", msg, ctx)
        return 0

    # FD 누수 조기 경보 (2026-06-05 장애 원인). soft limit의 85% 넘으면 먹통 전에 알림.
    fd_open = meta.get("fd_open", -1)
    fd_limit = meta.get("fd_limit", -1)
    if fd_limit > 0 and fd_open >= 0 and fd_open >= fd_limit * 0.85:
        if not _recent_alert_key(url, key, "worker_fd_high"):
            ratio = fd_open / fd_limit * 100
            fd_msg = (
                "⚠️ YGinvest 워커 FD 고갈 임박 (외부 모니터)\n"
                f"  열린 FD {fd_open}/{fd_limit} ({ratio:.0f}%)\n"
                "  FD 누수로 곧 먹통(Errno 24) 위험 → 재배포 권장:\n"
                "  ssh -i ~/.ssh/oracle-yginvest.key ubuntu@168.110.114.1 'bash ~/redeploy.sh'"
            )
            try:
                _send_telegram(tg_token, tg_chat, fd_msg)
                _log(f"Telegram worker_fd_high 알림 전송 ({fd_open}/{fd_limit})")
            except Exception as e:
                _log(f"ERROR: Telegram 전송 실패 — {e}")
            _record(url, key, "worker_fd_high", "warning", fd_msg,
                    {"fd_open": fd_open, "fd_limit": fd_limit})

    # 정상 — 직전이 down이었으면 복구 알림 1회
    if last_state == "worker_down":
        msg = (
            "✅ YGinvest 워커 복구됨 (외부 모니터)\n"
            f"  {reason}\n"
            f"  heartbeat: {last_ts_str}"
        )
        try:
            _send_telegram(tg_token, tg_chat, msg)
            _log("Telegram worker_recovered 알림 전송")
        except Exception as e:
            _log(f"ERROR: Telegram 전송 실패 — {e}")
        _record(url, key, "worker_recovered", "info", msg, ctx)

    return 0


if __name__ == "__main__":
    sys.exit(main())
