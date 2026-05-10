from datetime import datetime, timezone
from typing import Any

from ygworker.data_sources.fx import fetch_usd_krw_rate


def run_fetch_fx(supabase: Any, logger: Any) -> None:
    """exchangerate.host에서 USD/KRW 환율을 가져와 fx_rates에 INSERT."""
    try:
        rate = fetch_usd_krw_rate()
    except Exception as exc:
        logger.error("fetch_fx.failed", error=str(exc))
        return

    supabase.table("fx_rates").insert(
        {
            "base": "USD",
            "quote": "KRW",
            "rate": rate,
            "ts": datetime.now(timezone.utc).isoformat(),
        }
    ).execute()
    logger.info("fetch_fx.done", rate=rate)
