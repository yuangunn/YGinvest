from dataclasses import dataclass
from datetime import date as date_type
from datetime import timedelta
from typing import Literal

from pykrx import stock
from tenacity import retry, stop_after_attempt, wait_exponential

Market = Literal["KOSPI", "KOSDAQ"]
_MARKET_TO_ENUM = {"KOSPI": "KRX_KS", "KOSDAQ": "KRX_KQ"}
_MARKET_TO_SUFFIX = {"KOSPI": ".KS", "KOSDAQ": ".KQ"}


@dataclass(frozen=True)
class KrxStockMaster:
    symbol: str       # 005930.KS
    market: str       # KRX_KS / KRX_KQ
    name_ko: str
    market_cap: float


def _find_business_date_with_data(market: str, max_lookback_days: int = 7) -> tuple[str, "pd.DataFrame"]:
    """오늘부터 거꾸로 가며 KRX가 데이터를 주는 영업일을 찾는다.

    Saturday/Sunday/공휴일에는 빈 DataFrame을 반환하므로 직전 영업일까지 거슬러간다.
    """
    today = date_type.today()
    for offset in range(max_lookback_days):
        candidate = today - timedelta(days=offset)
        date_str = candidate.strftime("%Y%m%d")
        try:
            df = stock.get_market_cap_by_ticker(date_str, market=market)
            if not df.empty:
                return date_str, df
        except Exception:
            # pykrx가 응답을 받지 못한 경우 (휴장일 등). 다음 날 시도.
            continue
    raise RuntimeError(
        f"pykrx가 최근 {max_lookback_days}일 동안 {market} 데이터를 반환하지 않음"
    )


@retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=1, min=1, max=8))
def list_top_stocks(
    market: Market, limit: int = 100, date: str | None = None
) -> list[KrxStockMaster]:
    """KOSPI/KOSDAQ 시가총액 상위 N개 마스터 정보."""
    if date:
        cap_df = stock.get_market_cap_by_ticker(date, market=market)
    else:
        # date=None: 최근 영업일을 자동 검색 (주말·공휴일 회피)
        _, cap_df = _find_business_date_with_data(market)

    cap_df = cap_df.sort_values("시가총액", ascending=False).head(limit)

    out: list[KrxStockMaster] = []
    suffix = _MARKET_TO_SUFFIX[market]
    market_enum = _MARKET_TO_ENUM[market]
    for ticker, row in cap_df.iterrows():
        name_ko = stock.get_market_ticker_name(ticker)
        out.append(
            KrxStockMaster(
                symbol=f"{ticker}{suffix}",
                market=market_enum,
                name_ko=name_ko,
                market_cap=float(row["시가총액"]),
            )
        )
    return out
