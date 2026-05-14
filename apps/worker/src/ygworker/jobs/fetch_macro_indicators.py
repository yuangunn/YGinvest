"""Plan #26: 거시경제 지표 fetch.

매일 새벽 yfinance에서 주요 지표를 fetch:
- 금리: ^TNX (US 10Y), ^IRX (US 3M)
- FX: KRW=X, DX-Y.NYB
- 원자재: CL=F (WTI), GC=F (Gold)
- 위험: ^VIX
- 지수: ^KS11 (KOSPI), ^GSPC (S&P500), ^IXIC (NASDAQ)

한국은행 기준금리는 yfinance에 없어 별도 메뉴얼 seed로 관리.
"""
from datetime import UTC, datetime, timedelta
from typing import Any

import yfinance as yf


def _safe_float(v: Any) -> float | None:
    if v is None:
        return None
    try:
        f = float(v)
        if f != f:  # NaN
            return None
        return f
    except (TypeError, ValueError):
        return None


def run_fetch_macro_indicators(supabase: Any, logger: Any) -> None:
    """모든 활성 macro_meta 항목을 yfinance에서 fetch해 macro_indicators에 upsert."""
    meta_rows = (
        supabase.table("macro_meta")
        .select("symbol, yf_ticker, value_multiplier")
        .execute()
        .data
        or []
    )
    if not meta_rows:
        logger.warning("fetch_macro.empty_meta")
        return

    logger.info("fetch_macro.start", count=len(meta_rows))

    # 과거 60일 backfill (워밍업) + 향후 daily 업데이트
    end = datetime.now(UTC).date() + timedelta(days=1)
    start = end - timedelta(days=90)

    records: list[dict] = []
    success = 0
    failed = 0

    for meta in meta_rows:
        yf_ticker = meta["yf_ticker"]
        if not yf_ticker:
            # KR_BASE_RATE 같은 manually seeded 항목
            continue
        sym = meta["symbol"]
        mult = float(meta.get("value_multiplier") or 1)
        try:
            df = yf.download(
                yf_ticker,
                start=start.isoformat(),
                end=end.isoformat(),
                progress=False,
                auto_adjust=False,
                threads=False,
            )
        except Exception as exc:
            failed += 1
            logger.debug("fetch_macro.dl_failed", symbol=sym, error=str(exc))
            continue
        if df is None or df.empty:
            failed += 1
            continue
        # yfinance 1-symbol 결과: Close 컬럼은 단일 또는 multi-index
        if "Close" not in df.columns:
            failed += 1
            continue
        close_col = df["Close"]
        # multi-symbol 케이스가 아니라 단일 ticker이므로 Series거나 single-column DF
        if hasattr(close_col, "iloc") and close_col.ndim == 2:
            close_col = close_col.iloc[:, 0]

        for idx, val in close_col.items():
            v = _safe_float(val)
            if v is None:
                continue
            date_iso = idx.date().isoformat() if hasattr(idx, "date") else str(idx)[:10]
            records.append(
                {
                    "symbol": sym,
                    "ts": date_iso,
                    "value": v * mult,
                    "fetched_at": datetime.now(UTC).isoformat(),
                }
            )
        success += 1

    if records:
        chunk = 500
        for i in range(0, len(records), chunk):
            try:
                supabase.table("macro_indicators").upsert(
                    records[i : i + chunk], on_conflict="symbol,ts"
                ).execute()
            except Exception as exc:
                logger.warning("fetch_macro.upsert_failed", chunk=i, error=str(exc))

    logger.info(
        "fetch_macro.done",
        success=success,
        failed=failed,
        records=len(records),
    )
