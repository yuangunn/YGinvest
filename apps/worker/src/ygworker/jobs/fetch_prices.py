from datetime import UTC, datetime
from typing import Any

from ygworker.data_sources.fdr import _fetch_listing, fetch_us_close


def run_fetch_prices(supabase: Any, logger: Any) -> None:
    """is_active=true인 모든 stocks의 last_price/last_price_at을 갱신.

    KR (.KS, .KQ): KOSPI/KOSDAQ listing을 한 번에 fetch한 뒤 in-memory join.
    US: 종목별 fdr.DataReader 호출 (~0.25s/심볼).

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

    kr_symbols = [s for s in symbols if s.endswith((".KS", ".KQ"))]
    us_symbols = [s for s in symbols if not s.endswith((".KS", ".KQ"))]
    logger.info(
        "fetch_prices.start", kr=len(kr_symbols), us=len(us_symbols)
    )

    now = datetime.now(UTC).isoformat()
    updated = 0

    # KR: 두 번의 listing 호출로 모든 prices를 한번에
    if kr_symbols:
        kr_prices = _build_kr_price_map(logger)
        for sym in kr_symbols:
            price = kr_prices.get(sym)
            if price is not None:
                supabase.table("stocks").update(
                    {"last_price": price, "last_price_at": now, "updated_at": now}
                ).eq("symbol", sym).execute()
                updated += 1

    # US: 종목별 호출
    for sym in us_symbols:
        try:
            close = fetch_us_close(sym)
        except Exception as exc:
            logger.warning("fetch_prices.us_failed", symbol=sym, error=str(exc))
            continue
        if close is not None:
            supabase.table("stocks").update(
                {"last_price": close, "last_price_at": now, "updated_at": now}
            ).eq("symbol", sym).execute()
            updated += 1

    logger.info(
        "fetch_prices.done",
        updated=updated,
        missing=len(symbols) - updated,
    )


def _build_kr_price_map(logger: Any) -> dict[str, float]:
    """KOSPI + KOSDAQ listing을 fetch하여 symbol → close 매핑."""
    out: dict[str, float] = {}
    for market_name, suffix in (("KOSPI", ".KS"), ("KOSDAQ", ".KQ")):
        try:
            df = _fetch_listing(market_name)
        except Exception as exc:
            logger.warning(
                "fetch_prices.kr_listing_failed", market=market_name, error=str(exc)
            )
            continue
        if df is None or df.empty:
            continue
        for _, row in df.iterrows():
            code = str(row.get("Code", "")).strip()
            close = row.get("Close")
            if code and close is not None and close == close:  # NaN 체크
                out[f"{code}{suffix}"] = float(close)
    return out
