"""FinanceDataReader 기반 종목 마스터 + 가격 어댑터.

KR: `fdr.StockListing('KOSPI'/'KOSDAQ')`은 한 번의 호출로 모든 상장 종목의
    Code/Name/Marcap/Close를 반환. pykrx보다 안정적이고 한국어명 포함.

US: `fdr.DataReader(symbol)`은 종목 1개의 시계열을 반환.
    yfinance와 같은 데이터지만 다른 transport라서 SSL/rate-limit 이슈 회피.
"""

from dataclasses import dataclass
from typing import Any

import FinanceDataReader as fdr  # noqa: N813 — FDR 라이브러리 관행적으로 'fdr' alias
from tenacity import retry, stop_after_attempt, wait_exponential


@dataclass(frozen=True)
class KrListingItem:
    symbol: str       # 005930.KS
    market: str       # KRX_KS / KRX_KQ
    name_ko: str
    market_cap: float
    last_price: float | None


@retry(stop=stop_after_attempt(2), wait=wait_exponential(multiplier=0.5, min=0.5, max=2))
def _fetch_listing(market: str) -> Any:
    """`fdr.StockListing(market)`을 retry로 wrapping. KOSPI 또는 KOSDAQ."""
    return fdr.StockListing(market)


def list_kr_top(limit: int = 100) -> list[KrListingItem]:
    """KOSPI + KOSDAQ 통합한 시가총액 상위 N개 반환."""
    out: list[KrListingItem] = []

    for market_name, suffix, market_enum in (
        ("KOSPI", ".KS", "KRX_KS"),
        ("KOSDAQ", ".KQ", "KRX_KQ"),
    ):
        df = _fetch_listing(market_name)
        if df is None or df.empty:
            continue
        # Marcap desc 정렬
        df = df.sort_values("Marcap", ascending=False).head(limit)
        for _, row in df.iterrows():
            code = str(row.get("Code", "")).strip()
            name = str(row.get("Name", "")).strip()
            marcap = float(row.get("Marcap", 0) or 0)
            close = row.get("Close")
            close_val = float(close) if close is not None and not _is_nan(close) else None
            if not code or not name:
                continue
            out.append(
                KrListingItem(
                    symbol=f"{code}{suffix}",
                    market=market_enum,
                    name_ko=name,
                    market_cap=marcap,
                    last_price=close_val,
                )
            )

    # KOSPI + KOSDAQ 합쳐서 marcap desc 재정렬, 상위 limit
    out.sort(key=lambda x: x.market_cap, reverse=True)
    return out[:limit]


@retry(stop=stop_after_attempt(2), wait=wait_exponential(multiplier=0.5, min=0.5, max=2))
def fetch_us_close(symbol: str) -> float | None:
    """US 심볼 1개의 최근 종가."""
    # FDR.DataReader는 시작 날짜를 받음. 약 7일치 fetch 후 마지막 행.
    from datetime import date, timedelta

    start = (date.today() - timedelta(days=10)).strftime("%Y-%m-%d")
    df = fdr.DataReader(symbol, start)
    if df is None or df.empty:
        return None
    last = df.iloc[-1]
    close = last.get("Close")
    if close is None or _is_nan(close):
        return None
    return float(close)


def _is_nan(value: Any) -> bool:
    try:
        return value != value  # NaN 체크
    except Exception:
        return False
