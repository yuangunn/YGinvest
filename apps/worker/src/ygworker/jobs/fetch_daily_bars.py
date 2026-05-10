from typing import Any

from ygworker.data_sources.fdr import fetch_daily_history


def run_fetch_daily_bars(supabase: Any, logger: Any, days: int = 365) -> None:
    """is_active 종목 전체의 일봉 OHLCV를 fetch + upsert.

    매일 KR 장 마감 후(16:00 KST) + US 장 마감 후(07:00 KST) 1회씩 호출.
    """
    rows = (
        supabase.table("stocks")
        .select("symbol")
        .eq("is_active", True)
        .execute()
        .data
    )
    symbols = [r["symbol"] for r in rows]
    if not symbols:
        logger.info("fetch_daily_bars.skip", reason="no_active_symbols")
        return

    logger.info("fetch_daily_bars.start", count=len(symbols), days=days)
    total_inserted = 0
    failed = 0

    for sym in symbols:
        try:
            bars = fetch_daily_history(sym, days=days)
        except Exception as exc:
            logger.warning("fetch_daily_bars.failed", symbol=sym, error=str(exc))
            failed += 1
            continue
        if not bars:
            continue

        records = [
            {
                "symbol": sym,
                "interval": "1d",
                "ts": b["ts"].isoformat() if hasattr(b["ts"], "isoformat") else b["ts"],
                "open": b["open"],
                "high": b["high"],
                "low": b["low"],
                "close": b["close"],
                "volume": b["volume"],
            }
            for b in bars
        ]
        try:
            supabase.table("stock_bars").upsert(records, on_conflict="symbol,interval,ts").execute()
            total_inserted += len(records)
        except Exception as exc:
            logger.warning("fetch_daily_bars.upsert_failed", symbol=sym, error=str(exc))
            failed += 1

    logger.info("fetch_daily_bars.done", inserted=total_inserted, failed=failed)
