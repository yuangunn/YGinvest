from datetime import UTC, datetime
from typing import Any

from ygworker.data_sources.fdr import _fetch_listing
from ygworker.data_sources.yahoo import fetch_closes_batch

# US batch chunk size — yfinance.download은 500+개 한번에 가능하지만
# HTTP 메모리 안정성을 위해 200개씩 끊는다.
US_BATCH_SIZE = 200


def run_fetch_prices(supabase: Any, logger: Any) -> None:
    """is_active=true인 모든 stocks의 last_price/last_price_at을 갱신.

    KR (.KS, .KQ): KOSPI/KOSDAQ listing을 한 번에 fetch한 뒤 in-memory join.
    US: Plan #20.2 — yfinance.download() batch (200개씩). 이전엔 종목별
        fdr.DataReader (506종목 × 0.25s = 125s overrun) → batch로 ~10s.
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

    # US: yfinance batch (chunked) — 한 번에 200개씩 다운로드
    if us_symbols:
        us_closes: dict[str, float] = {}
        for i in range(0, len(us_symbols), US_BATCH_SIZE):
            chunk = us_symbols[i:i + US_BATCH_SIZE]
            try:
                batch = fetch_closes_batch(chunk)
            except Exception as exc:
                logger.warning(
                    "fetch_prices.us_batch_failed",
                    chunk_start=i,
                    error=str(exc),
                )
                continue
            us_closes.update(batch)
            logger.debug(
                "fetch_prices.us_batch_done",
                chunk_start=i,
                got=len(batch),
                total_so_far=len(us_closes),
            )

        for sym, close in us_closes.items():
            try:
                supabase.table("stocks").update(
                    {"last_price": close, "last_price_at": now, "updated_at": now}
                ).eq("symbol", sym).execute()
                updated += 1
            except Exception as exc:
                logger.warning(
                    "fetch_prices.us_update_failed", symbol=sym, error=str(exc)
                )

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
