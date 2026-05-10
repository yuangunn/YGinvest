from datetime import datetime, timezone
from typing import Any

from ygworker.data_sources.krx import KrxStockMaster, list_top_stocks
from ygworker.data_sources.us_top import US_TOP_100
from ygworker.data_sources.yahoo import YahooQuote, fetch_quote


def run_bootstrap_stocks(
    supabase: Any, logger: Any, kr_limit: int = 100, us_limit: int = 100
) -> None:
    """stocks 테이블이 비어있으면 KR 상위 + US 상위를 prefetch한다."""
    existing = (
        supabase.table("stocks").select("symbol").limit(1).execute().data
    )
    if existing:
        logger.info("bootstrap_stocks.skip", reason="already_populated")
        return

    logger.info("bootstrap_stocks.start", kr_limit=kr_limit, us_limit=us_limit)
    now = datetime.now(timezone.utc).isoformat()

    records: list[dict] = []

    # KR — KOSPI + KOSDAQ
    try:
        kospi = list_top_stocks("KOSPI", limit=kr_limit // 2)
        kosdaq = list_top_stocks("KOSDAQ", limit=kr_limit // 2)
    except Exception as exc:
        logger.error("bootstrap_stocks.kr_master_failed", error=str(exc))
        kospi, kosdaq = [], []

    for masters in (kospi, kosdaq):
        for m in masters:
            quote = _safe_quote(m.symbol, logger)
            records.append(_to_stock_row(m, quote, now))

    # US — top 100 하드코딩 리스트에서 us_limit개
    for symbol in US_TOP_100[:us_limit]:
        quote = _safe_quote(symbol, logger)
        if quote is None:
            continue
        records.append(_us_to_stock_row(symbol, quote, now))

    if records:
        supabase.table("stocks").upsert(records, on_conflict="symbol").execute()
        logger.info("bootstrap_stocks.done", inserted=len(records))
    else:
        logger.warning("bootstrap_stocks.no_records")


def _safe_quote(symbol: str, logger: Any) -> YahooQuote | None:
    try:
        return fetch_quote(symbol)
    except Exception as exc:
        logger.warning("bootstrap_stocks.quote_failed", symbol=symbol, error=str(exc))
        return None


def _to_stock_row(master: KrxStockMaster, quote: YahooQuote | None, now: str) -> dict:
    base = {
        "symbol": master.symbol,
        "market": master.market,
        "currency": "KRW",
        "name": master.name_ko,
        "name_ko": master.name_ko,
        "market_cap": master.market_cap,
        "is_active": True,
        "updated_at": now,
    }
    if quote is not None:
        base.update({
            "name": quote.name or master.name_ko,
            "last_price": quote.price,
            "last_price_at": now,
            "per": quote.per,
            "sector": quote.sector,
            "fifty_two_week_high": quote.fifty_two_week_high,
            "fifty_two_week_low": quote.fifty_two_week_low,
        })
    return base


def _us_to_stock_row(symbol: str, quote: YahooQuote, now: str) -> dict:
    return {
        "symbol": symbol,
        "market": quote.market,
        "currency": quote.currency,
        "name": quote.name,
        "name_ko": None,
        "market_cap": quote.market_cap,
        "per": quote.per,
        "sector": quote.sector,
        "last_price": quote.price,
        "last_price_at": now,
        "fifty_two_week_high": quote.fifty_two_week_high,
        "fifty_two_week_low": quote.fifty_two_week_low,
        "is_active": True,
        "updated_at": now,
    }
