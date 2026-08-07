"""Plan #24: 실적 발표일 fetch.

각 active stock의 향후 12개월 + 과거 4분기 실적 데이터를 yfinance에서 가져와
earnings_events 테이블에 upsert.
"""
from datetime import UTC, datetime
from typing import Any

import yfinance as yf

from ygworker.data_sources.yf_session import get_yf_session


def _to_iso_date(ts: Any) -> str | None:
    """timestamp/datetime을 ISO date string으로."""
    if ts is None:
        return None
    try:
        if hasattr(ts, "to_pydatetime"):
            return ts.to_pydatetime().date().isoformat()
        if hasattr(ts, "date"):
            return ts.date().isoformat()
        return None
    except Exception:
        return None


def _to_float(v: Any) -> float | None:
    if v is None:
        return None
    try:
        f = float(v)
        if f != f:  # NaN check
            return None
        return f
    except (TypeError, ValueError):
        return None


def run_fetch_earnings(supabase: Any, logger: Any, batch_size: int = 20) -> None:
    """top market_cap stocks 우선으로 earnings dates fetch.

    너무 많이 호출하지 않도록 시가총액 상위 N개로 제한 (기본 500).
    """
    rows = (
        supabase.table("stocks")
        .select("symbol")
        .eq("is_active", True)
        .order("market_cap", desc=True, nullsfirst=False)
        .limit(500)
        .execute()
        .data
        or []
    )
    symbols = [r["symbol"] for r in rows]
    logger.info("fetch_earnings.start", count=len(symbols))

    records: list[dict] = []
    fetched = 0
    failed = 0

    for sym in symbols:
        try:
            ticker = yf.Ticker(sym, session=get_yf_session())
            # earnings_dates: date-indexed DF; cols: EPS Estimate, Reported EPS, Surprise(%)
            df = ticker.earnings_dates
        except Exception as exc:
            failed += 1
            logger.debug("fetch_earnings.fetch_failed", symbol=sym, error=str(exc))
            continue
        if df is None or df.empty:
            continue
        try:
            for idx, row in df.iterrows():
                date_iso = _to_iso_date(idx)
                if not date_iso:
                    continue
                eps_est = _to_float(row.get("EPS Estimate"))
                eps_act = _to_float(row.get("Reported EPS"))
                surprise = _to_float(row.get("Surprise(%)"))
                records.append(
                    {
                        "symbol": sym,
                        "report_date": date_iso,
                        "eps_estimate": eps_est,
                        "eps_actual": eps_act,
                        "surprise_pct": surprise,
                        "fetched_at": datetime.now(UTC).isoformat(),
                    }
                )
            fetched += 1
        except Exception as exc:
            failed += 1
            logger.debug("fetch_earnings.parse_failed", symbol=sym, error=str(exc))

        if fetched % batch_size == 0 and fetched > 0:
            logger.info("fetch_earnings.progress", fetched=fetched, failed=failed)

    if records:
        # Chunk for upsert (Supabase REST size limit)
        chunk = 200
        for i in range(0, len(records), chunk):
            try:
                supabase.table("earnings_events").upsert(
                    records[i : i + chunk], on_conflict="symbol,report_date"
                ).execute()
            except Exception as exc:
                logger.warning(
                    "fetch_earnings.upsert_failed",
                    chunk=i,
                    error=str(exc),
                )
    logger.info(
        "fetch_earnings.done",
        fetched=fetched,
        failed=failed,
        records=len(records),
    )
