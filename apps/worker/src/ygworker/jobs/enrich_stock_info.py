"""Plan #22 hotfix — sector / PER / 52w / market_cap을 yfinance에서 fetch 후 stocks 갱신.

bootstrap_stocks가 FDR만 사용해서 sector/PER/52w가 NULL로 남는 문제 해결.
일 1회 (KR open 30분 전) 실행 → 모든 stocks의 enrichment 필드 갱신.

또한 ad-hoc /rpc/enrich_now 엔드포인트로 강제 실행 가능.
"""
from datetime import UTC, datetime
from typing import Any

import yfinance as yf
from tenacity import retry, stop_after_attempt, wait_exponential


@retry(stop=stop_after_attempt(2), wait=wait_exponential(multiplier=0.5, min=0.5, max=2))
def _fetch_info(symbol: str) -> dict:
    """yfinance Ticker.info를 retry 래핑."""
    return yf.Ticker(symbol).info or {}


def run_enrich_stock_info(
    supabase: Any, logger: Any, batch_size: int = 25
) -> dict[str, int]:
    """모든 active stocks의 sector/PER/52w/market_cap 갱신.

    yfinance.Ticker(symbol).info에서:
    - sector
    - trailingPE → per
    - fiftyTwoWeekHigh → fifty_two_week_high
    - fiftyTwoWeekLow → fifty_two_week_low
    - marketCap → market_cap (yfinance가 더 최신일 때)
    """
    # 모든 active stocks 가져오기 (pagination)
    all_symbols: list[str] = []
    offset = 0
    while True:
        rows = (
            supabase.table("stocks")
            .select("symbol")
            .eq("is_active", True)
            .range(offset, offset + 999)
            .execute()
            .data
            or []
        )
        if not rows:
            break
        all_symbols.extend(r["symbol"] for r in rows)
        if len(rows) < 1000:
            break
        offset += 1000

    logger.info("enrich_stock_info.start", count=len(all_symbols))
    now_iso = datetime.now(UTC).isoformat()

    updated = 0
    failed = 0
    with_sector = 0
    with_per = 0
    with_52w = 0

    for idx, symbol in enumerate(all_symbols):
        try:
            info = _fetch_info(symbol)
        except Exception as exc:
            failed += 1
            logger.debug("enrich_stock_info.fetch_failed", symbol=symbol, error=str(exc))
            continue
        if not info:
            failed += 1
            continue

        # 데이터 추출 (NULL이면 skip)
        update: dict[str, Any] = {"updated_at": now_iso}
        sector = info.get("sector")
        if sector:
            update["sector"] = sector
            with_sector += 1
        per = info.get("trailingPE")
        if per is not None and isinstance(per, (int, float)) and per > 0:
            update["per"] = float(per)
            with_per += 1
        h52 = info.get("fiftyTwoWeekHigh")
        l52 = info.get("fiftyTwoWeekLow")
        if h52 is not None and l52 is not None:
            update["fifty_two_week_high"] = float(h52)
            update["fifty_two_week_low"] = float(l52)
            with_52w += 1
        mcap = info.get("marketCap")
        if mcap is not None and mcap > 0:
            update["market_cap"] = float(mcap)

        # 의미 있는 갱신만
        if len(update) <= 1:  # updated_at만 있으면 skip
            continue
        try:
            supabase.table("stocks").update(update).eq("symbol", symbol).execute()
            updated += 1
        except Exception as exc:
            failed += 1
            logger.debug("enrich_stock_info.update_failed", symbol=symbol, error=str(exc))

        if (idx + 1) % batch_size == 0:
            logger.info(
                "enrich_stock_info.progress",
                done=idx + 1,
                total=len(all_symbols),
                updated=updated,
                failed=failed,
            )

    result = {
        "total": len(all_symbols),
        "updated": updated,
        "failed": failed,
        "with_sector": with_sector,
        "with_per": with_per,
        "with_52w": with_52w,
    }
    logger.info("enrich_stock_info.done", **result)
    return result
