"""Plan #47.7: 매크로 지수 실시간 fetch (5분 간격).

yfinance `Ticker.fast_info.last_price` 활용 → 거의 실시간 (1-2분 지연).
일봉(macro_indicators)와 별개 테이블 (macro_intraday)에 5분봉 시계열로 저장.

대상 (10개):
  - KR 인덱스: KOSPI (^KS11), KOSDAQ (^KQ11)
  - US 인덱스: SP500 (^GSPC), NASDAQ (^IXIC), VIX (^VIX)
  - 환율/금융: USDKRW (KRW=X), DXY (DX-Y.NYB)
  - 원자재: OIL_WTI (CL=F), GOLD (GC=F)
  - 암호화폐: BTC_USD (BTC-USD)

장중만 fetch (KR/US 둘 다 휴장이면 skip).
"""

from __future__ import annotations

from datetime import UTC, datetime, timedelta
from typing import Any

import yfinance as yf

# 우리 symbol → yfinance ticker 매핑 (fetch_macro_indicators와 동일)
INTRADAY_SYMBOLS: dict[str, str] = {
    "KOSPI": "^KS11",
    "KOSDAQ": "^KQ11",
    "SP500": "^GSPC",
    "NASDAQ": "^IXIC",
    "VIX": "^VIX",
    "USDKRW": "KRW=X",
    "DXY": "DX-Y.NYB",
    "OIL_WTI": "CL=F",
    "GOLD": "GC=F",
    "BTC_USD": "BTC-USD",
}

# 7일 이상 데이터 자동 cleanup
RETENTION_DAYS = 7


def _safe_price(ticker: yf.Ticker) -> float | None:
    """fast_info.last_price 안전 추출."""
    try:
        fi = ticker.fast_info
        price = fi.last_price
        if price is None:
            return None
        f = float(price)
        if f != f or f <= 0:  # NaN or invalid
            return None
        return f
    except Exception:
        return None


def run_fetch_macro_intraday(supabase: Any, logger: Any) -> None:
    """5분 cron — 실시간 매크로 fetch + DB insert + 7일 retention."""
    now = datetime.now(UTC)
    now_iso = now.isoformat()
    rows: list[dict[str, Any]] = []
    failed: list[str] = []

    for our_sym, yf_sym in INTRADAY_SYMBOLS.items():
        try:
            price = _safe_price(yf.Ticker(yf_sym))
            if price is None:
                failed.append(our_sym)
                continue
            rows.append({"symbol": our_sym, "ts": now_iso, "value": price})
        except Exception as e:
            logger.warning("macro_intraday.fetch_fail", symbol=our_sym, error=str(e))
            failed.append(our_sym)

    if rows:
        try:
            # upsert: 같은 (symbol, ts) 충돌 시 update (보통은 ts가 다르니 insert)
            supabase.table("macro_intraday").upsert(
                rows, on_conflict="symbol,ts"
            ).execute()
        except Exception as e:
            logger.error("macro_intraday.insert_fail", error=str(e))
            return

    # Retention cleanup (7일 이상 데이터 삭제)
    try:
        cutoff = (now - timedelta(days=RETENTION_DAYS)).isoformat()
        supabase.table("macro_intraday").delete().lt("ts", cutoff).execute()
    except Exception as e:
        logger.debug("macro_intraday.cleanup_fail", error=str(e))

    logger.info(
        "macro_intraday.done",
        inserted=len(rows),
        failed=len(failed),
        failed_symbols=failed[:5] if failed else None,
    )
