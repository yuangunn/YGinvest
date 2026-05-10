from datetime import UTC, datetime
from typing import Any

from ygworker.data_sources.kr_top import KR_TOP_100
from ygworker.data_sources.us_top import US_TOP_100
from ygworker.data_sources.yahoo import YahooQuote, fetch_quote


def run_bootstrap_stocks(
    supabase: Any, logger: Any, kr_limit: int = 100, us_limit: int = 100
) -> None:
    """stocks 테이블이 비어있으면 KR 상위 + US 상위를 prefetch한다.

    yfinance 호출이 실패해도 메타데이터(symbol, market, name)는 항상 삽입.
    가격(last_price)은 실패 시 NULL → fetch_prices 잡이 이후 갱신.
    """
    existing = (
        supabase.table("stocks").select("symbol").limit(1).execute().data
    )
    if existing:
        logger.info("bootstrap_stocks.skip", reason="already_populated")
        return

    logger.info("bootstrap_stocks.start", kr_limit=kr_limit, us_limit=us_limit)
    now = datetime.now(UTC).isoformat()

    records: list[dict] = []

    # KR
    for symbol, market_enum, name_ko in KR_TOP_100[:kr_limit]:
        quote = _safe_quote(symbol, logger)
        records.append(_kr_to_stock_row(symbol, market_enum, name_ko, quote, now))

    # US
    for symbol, market_enum, name in US_TOP_100[:us_limit]:
        quote = _safe_quote(symbol, logger)
        records.append(_us_to_stock_row(symbol, market_enum, name, quote, now))

    if records:
        supabase.table("stocks").upsert(records, on_conflict="symbol").execute()
        with_price = sum(1 for r in records if r.get("last_price") is not None)
        logger.info(
            "bootstrap_stocks.done",
            inserted=len(records),
            with_price=with_price,
            without_price=len(records) - with_price,
        )
    else:
        logger.warning("bootstrap_stocks.no_records")


def _safe_quote(symbol: str, logger: Any) -> YahooQuote | None:
    try:
        return fetch_quote(symbol)
    except Exception as exc:
        logger.warning(
            "bootstrap_stocks.quote_failed", symbol=symbol, error=str(exc)
        )
        return None


def _kr_to_stock_row(
    symbol: str, market_enum: str, name_ko: str, quote: YahooQuote | None, now: str
) -> dict:
    base = {
        "symbol": symbol,
        "market": market_enum,
        "currency": "KRW",
        "name": name_ko,
        "name_ko": name_ko,
        "is_active": True,
        "updated_at": now,
    }
    if quote is not None:
        base.update({
            "name": quote.name or name_ko,
            "last_price": quote.price,
            "last_price_at": now,
            "market_cap": quote.market_cap,
            "per": quote.per,
            "sector": quote.sector,
            "fifty_two_week_high": quote.fifty_two_week_high,
            "fifty_two_week_low": quote.fifty_two_week_low,
        })
    return base


def _us_to_stock_row(
    symbol: str, market_enum: str, name: str, quote: YahooQuote | None, now: str
) -> dict:
    base = {
        "symbol": symbol,
        "market": market_enum,
        "currency": "USD",
        "name": name,
        "name_ko": None,
        "is_active": True,
        "updated_at": now,
    }
    if quote is not None:
        base.update({
            "name": quote.name or name,
            "market": quote.market or market_enum,
            "last_price": quote.price,
            "last_price_at": now,
            "market_cap": quote.market_cap,
            "per": quote.per,
            "sector": quote.sector,
            "fifty_two_week_high": quote.fifty_two_week_high,
            "fifty_two_week_low": quote.fifty_two_week_low,
        })
    return base
