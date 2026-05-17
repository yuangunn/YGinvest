"""1시간 주기. stocks + stock_bars를 읽어 5 카테고리 추천 계산.

- top_gainers / top_losers: 어제 vs 오늘 종가 change_pct, KR/US 각 top 10
- volume_surge: 오늘 / 5일 평균 거래량 ≥ 3.0, ratio 상위 10 (KR/US)
- near_52w_high: last_price / fifty_two_week_high ≥ 0.95, market_cap 상위 10 (KR/US)
- low_per_value: KR 시총 top 200 중 PER > 0, PER 최저 10 (KR만, 'KR' scope)

Atomic 갱신: 전체 DELETE → INSERT. 단일 워커 가정.

NOTE: score 컬럼 의미가 카테고리별로 다름 — top_gainers는 change_pct(%),
volume_surge는 ratio, near_52w_high는 비율, low_per_value는 PER 절댓값
(낮을수록 좋음). rank가 진실의 단일 원천.
"""

from collections import defaultdict
from datetime import UTC, date, datetime, timedelta
from typing import Any


def _compute_change_pct(*, today: float, prev: float) -> float:
    # prev=0 보호 (분모). 음수 prev는 stock_bars에 들어올 수 없음.
    if prev == 0:
        return 0.0
    return (today - prev) / prev


def _compute_volume_ratio(*, today: float, prev_5d: list[float]) -> float:
    if not prev_5d:
        return 0.0
    avg = sum(prev_5d) / len(prev_5d)
    if avg == 0:
        return 0.0
    return today / avg


def run_compute_recommendations(supabase: Any, logger: Any) -> None:
    stocks = (
        supabase.table("stocks")
        .select(
            "symbol, currency, market, last_price, market_cap, per, fifty_two_week_high"
        )
        .eq("is_active", True)
        .execute()
        .data
    )
    if not stocks:
        logger.info("compute_recommendations.skip", reason="no_stocks")
        return

    logger.info("compute_recommendations.start", count=len(stocks))
    symbols = [s["symbol"] for s in stocks]

    # 최근 14일치 일봉. PostgREST가 서버측 max-rows 1000을 강제하므로
    # `.range()`로 페이지네이션. stocks 200 × 14일 = ~2800 rows.
    # Plan #34: HTTP/2 GOAWAY 방지 — symbol을 200개씩 chunk로 나눠 쿼리.
    # 1000+ symbols을 한 번에 .in_()으로 보내면 URL 길이 + 처리 시간 초과 → 끊김.
    cutoff = (date.today() - timedelta(days=14)).isoformat()
    bars: list[dict] = []
    SYMBOL_CHUNK = 200
    page_size = 1000
    for ci in range(0, len(symbols), SYMBOL_CHUNK):
        sym_chunk = symbols[ci:ci + SYMBOL_CHUNK]
        offset = 0
        while True:
            try:
                page = (
                    supabase.table("stock_bars")
                    .select("symbol, ts, close, volume")
                    .gte("ts", cutoff)
                    .in_("symbol", sym_chunk)
                    .range(offset, offset + page_size - 1)
                    .execute()
                    .data
                )
            except Exception as exc:
                logger.warning(
                    "compute_recommendations.chunk_failed",
                    chunk_start=ci,
                    chunk_size=len(sym_chunk),
                    offset=offset,
                    error=str(exc),
                )
                break  # 이 chunk 포기 — 다음 chunk 계속
            if not page:
                break
            bars.extend(page)
            if len(page) < page_size:
                break
            offset += page_size

    # symbol → sorted (desc by ts) bars
    by_symbol: dict[str, list[dict]] = defaultdict(list)
    for b in bars:
        by_symbol[b["symbol"]].append(b)
    for lst in by_symbol.values():
        lst.sort(key=lambda x: x["ts"], reverse=True)

    # 종목별 메트릭 계산
    enriched: list[dict] = []
    for s in stocks:
        sym = s["symbol"]
        sym_bars = by_symbol.get(sym, [])
        if len(sym_bars) < 2:
            continue  # 일봉 부족 — change_pct 계산 불가

        today_bar = sym_bars[0]
        prev_bar = sym_bars[1]
        change_pct = _compute_change_pct(
            today=float(today_bar["close"]),
            prev=float(prev_bar["close"]),
        )

        prev_5_vols = [float(b["volume"]) for b in sym_bars[1:6]]
        volume_ratio = _compute_volume_ratio(
            today=float(today_bar["volume"]), prev_5d=prev_5_vols
        )

        last_price = float(s["last_price"]) if s["last_price"] else 0.0
        fifty_two_high = (
            float(s["fifty_two_week_high"]) if s["fifty_two_week_high"] else 0.0
        )
        near_52w_pct = (
            last_price / fifty_two_high if fifty_two_high > 0 else 0.0
        )

        enriched.append(
            {
                **s,
                "change_pct": change_pct,
                "volume_ratio": volume_ratio,
                "near_52w_pct": near_52w_pct,
                "scope": "KR" if sym.endswith((".KS", ".KQ")) else "US",
            }
        )

    # 카테고리별 ranking
    now_iso = datetime.now(UTC).isoformat()
    rows: list[dict] = []

    for scope in ("KR", "US"):
        scoped = [e for e in enriched if e["scope"] == scope]

        # top_gainers (change_pct desc)
        gainers = sorted(scoped, key=lambda x: x["change_pct"], reverse=True)[:10]
        for rank, e in enumerate(gainers, start=1):
            rows.append(
                {
                    "category": "top_gainers",
                    "market_scope": scope,
                    "symbol": e["symbol"],
                    "rank": rank,
                    "score": e["change_pct"] * 100,
                    "reason": f"{e['change_pct'] * 100:+.2f}%",
                    "computed_at": now_iso,
                }
            )

        # top_losers (change_pct asc)
        losers = sorted(scoped, key=lambda x: x["change_pct"])[:10]
        for rank, e in enumerate(losers, start=1):
            rows.append(
                {
                    "category": "top_losers",
                    "market_scope": scope,
                    "symbol": e["symbol"],
                    "rank": rank,
                    "score": e["change_pct"] * 100,
                    "reason": f"{e['change_pct'] * 100:+.2f}%",
                    "computed_at": now_iso,
                }
            )

        # volume_surge (ratio >= 3.0, sort by ratio desc, top 10)
        surge = [e for e in scoped if e["volume_ratio"] >= 3.0]
        surge.sort(key=lambda x: x["volume_ratio"], reverse=True)
        for rank, e in enumerate(surge[:10], start=1):
            rows.append(
                {
                    "category": "volume_surge",
                    "market_scope": scope,
                    "symbol": e["symbol"],
                    "rank": rank,
                    "score": e["volume_ratio"],
                    "reason": f"{e['volume_ratio']:.1f}× 평균",
                    "computed_at": now_iso,
                }
            )

        # near_52w_high (near_52w_pct >= 0.95, sort by market_cap desc, top 10)
        near = [
            e
            for e in scoped
            if e["near_52w_pct"] >= 0.95 and e.get("market_cap")
        ]
        near.sort(key=lambda x: float(x["market_cap"]), reverse=True)
        for rank, e in enumerate(near[:10], start=1):
            rows.append(
                {
                    "category": "near_52w_high",
                    "market_scope": scope,
                    "symbol": e["symbol"],
                    "rank": rank,
                    "score": e["near_52w_pct"],
                    "reason": f"52주 최고가 대비 {e['near_52w_pct'] * 100:.1f}%",
                    "computed_at": now_iso,
                }
            )

    # low_per_value (KR only, market_cap top 200 중 per > 0, per asc top 10)
    kr_with_cap = [
        e for e in enriched if e["scope"] == "KR" and e.get("market_cap")
    ]
    kr_with_cap.sort(key=lambda x: float(x["market_cap"]), reverse=True)
    kr_top200 = kr_with_cap[:200]
    low_per = [
        e for e in kr_top200 if e.get("per") and float(e["per"]) > 0
    ]
    low_per.sort(key=lambda x: float(x["per"]))
    for rank, e in enumerate(low_per[:10], start=1):
        rows.append(
            {
                "category": "low_per_value",
                "market_scope": "KR",
                "symbol": e["symbol"],
                "rank": rank,
                "score": float(e["per"]),
                "reason": f"PER {float(e['per']):.1f}",
                "computed_at": now_iso,
            }
        )

    # Atomic 갱신: DELETE all → INSERT
    # PostgREST DELETE는 WHERE 절 강제이므로 rank >= 0 (모든 row) 사용
    try:
        supabase.table("recommendations").delete().gte("rank", 0).execute()
        if rows:
            supabase.table("recommendations").insert(rows).execute()
    except Exception as exc:
        logger.error("compute_recommendations.write_failed", error=str(exc))
        return

    logger.info(
        "compute_recommendations.done",
        inserted=len(rows),
        categories=len({r["category"] for r in rows}),
    )
