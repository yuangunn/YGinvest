from datetime import UTC, datetime
from typing import Any

from ygworker.data_sources.fdr import fetch_us_close, list_kr_top
from ygworker.data_sources.us_top import US_TOP_100


def run_bootstrap_stocks(
    supabase: Any, logger: Any, kr_limit: int = 2000, us_limit: int = 500
) -> None:
    """stocks 테이블이 비어있으면 KR 상위 + US 상위를 prefetch한다.

    KR: FinanceDataReader StockListing — KOSPI + KOSDAQ 시가총액 상위 N개. 1번 호출로 가격까지.
    US: us_top.US_TOP_100 (하드코딩 큐레이션) + FDR DataReader로 종가 fetch.

    NOTE: 부팅 시 1회만 실행. 이후 universe 확장은 fill_universe.py 스크립트나
    fill_missing_stocks job (TODO)으로 처리.
    """
    existing_count = (
        supabase.table("stocks")
        .select("symbol", count="exact")
        .limit(1)
        .execute()
        .count
    )
    if existing_count and existing_count >= 100:
        logger.info(
            "bootstrap_stocks.skip",
            reason="already_populated",
            existing=existing_count,
        )
        return

    logger.info("bootstrap_stocks.start", kr_limit=kr_limit, us_limit=us_limit)
    now = datetime.now(UTC).isoformat()

    records: list[dict] = []

    # KR: 한 번의 FDR 호출로 list + 가격 + 한국어명
    try:
        kr_items = list_kr_top(limit=kr_limit)
    except Exception as exc:
        logger.error("bootstrap_stocks.kr_listing_failed", error=str(exc))
        kr_items = []

    for item in kr_items:
        records.append({
            "symbol": item.symbol,
            "market": item.market,
            "currency": "KRW",
            "name": item.name_ko,
            "name_ko": item.name_ko,
            "market_cap": item.market_cap,
            "last_price": item.last_price,
            "last_price_at": now if item.last_price is not None else None,
            "is_active": True,
            "updated_at": now,
        })

    # US: 하드코딩 마스터 + FDR로 가격
    for symbol, market_enum, name in US_TOP_100[:us_limit]:
        try:
            close = fetch_us_close(symbol)
        except Exception as exc:
            logger.warning(
                "bootstrap_stocks.us_close_failed", symbol=symbol, error=str(exc)
            )
            close = None
        records.append({
            "symbol": symbol,
            "market": market_enum,
            "currency": "USD",
            "name": name,
            "name_ko": None,
            "last_price": close,
            "last_price_at": now if close is not None else None,
            "is_active": True,
            "updated_at": now,
        })

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
