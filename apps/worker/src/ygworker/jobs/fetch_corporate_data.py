"""일별 corporate actions fetch.

모든 active stocks를 iterate하면서 yfinance에서 future dividends + splits을
가져와서 dividend_events / corporate_actions에 upsert.

매일 06:00 KST cron (US 장 마감 ~07:00 KST 이후, 다음 장 시작 전).
"""

from datetime import date
from typing import Any

from ygworker.data_sources.yahoo_corporate import fetch_dividends, fetch_splits


def run_fetch_corporate_data(
    supabase: Any, logger: Any, today: date | None = None
) -> None:
    if today is None:
        today = date.today()

    stocks = (
        supabase.table("stocks")
        .select("symbol, currency")
        .eq("is_active", True)
        .execute()
        .data
    )
    if not stocks:
        logger.info("fetch_corporate_data.skip", reason="no_active_stocks")
        return

    logger.info("fetch_corporate_data.start", count=len(stocks))
    div_inserted = 0
    split_inserted = 0
    failed = 0

    for s in stocks:
        symbol = s["symbol"]
        currency = s["currency"]

        # Dividends
        try:
            divs = fetch_dividends(symbol, today)
        except Exception as exc:
            logger.warning(
                "fetch_corporate_data.div_failed", symbol=symbol, error=str(exc)
            )
            failed += 1
            divs = []
        for d in divs:
            try:
                supabase.table("dividend_events").upsert(
                    [
                        {
                            "symbol": symbol,
                            "ex_date": d["ex_date"].isoformat(),
                            "amount_per_share": d["amount_per_share"],
                            "currency": currency,
                        }
                    ],
                    on_conflict="symbol,ex_date",
                ).execute()
                div_inserted += 1
            except Exception as exc:
                logger.warning(
                    "fetch_corporate_data.div_upsert_failed",
                    symbol=symbol,
                    error=str(exc),
                )

        # Splits
        try:
            splits = fetch_splits(symbol, today)
        except Exception as exc:
            logger.warning(
                "fetch_corporate_data.split_failed", symbol=symbol, error=str(exc)
            )
            failed += 1
            splits = []
        for sp in splits:
            try:
                supabase.table("corporate_actions").upsert(
                    [
                        {
                            "symbol": symbol,
                            "action_type": sp["action_type"],
                            "ratio": sp["ratio"],
                            "ex_date": sp["ex_date"].isoformat(),
                        }
                    ],
                    on_conflict="symbol,ex_date,action_type",
                ).execute()
                split_inserted += 1
            except Exception as exc:
                logger.warning(
                    "fetch_corporate_data.split_upsert_failed",
                    symbol=symbol,
                    error=str(exc),
                )

    logger.info(
        "fetch_corporate_data.done",
        dividends_inserted=div_inserted,
        splits_inserted=split_inserted,
        failed=failed,
    )
