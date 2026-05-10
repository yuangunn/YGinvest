from dataclasses import dataclass
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


@retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=1, min=1, max=8))
def list_top_stocks(market: Market, limit: int = 100, date: str | None = None) -> list[KrxStockMaster]:
    """KOSPI/KOSDAQ 시가총액 상위 N개 마스터 정보."""
    # date=None이면 pykrx가 가장 최근 영업일 사용
    cap_df = stock.get_market_cap_by_ticker(date or "", market=market)
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
