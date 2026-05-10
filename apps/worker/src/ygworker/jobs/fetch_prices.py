from datetime import datetime, timezone
from typing import Any

from ygworker.data_sources.yahoo import fetch_quotes


def run_fetch_prices(supabase: Any, logger: Any) -> None:
    """is_active=true인 모든 stocks의 last_price/last_price_at을 갱신한다.

    NOTE: Plan #3 이후에는 보유/펜딩/관심 종목만으로 좁힐 예정.
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
        logger.info("fetch_prices.skip", reason="no_active_symbols")
        return

    logger.info("fetch_prices.start", count=len(symbols))
    quotes = fetch_quotes(symbols)
    now = datetime.now(timezone.utc).isoformat()

    for q in quotes:
        supabase.table("stocks").update(
            {"last_price": q.price, "last_price_at": now, "updated_at": now}
        ).eq("symbol", q.symbol).execute()

    logger.info(
        "fetch_prices.done",
        fetched=len(quotes),
        missing=len(symbols) - len(quotes),
    )
