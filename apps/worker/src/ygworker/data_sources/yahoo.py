from dataclasses import dataclass

import yfinance as yf
from tenacity import retry, stop_after_attempt, wait_exponential

from ygworker.data_sources.yf_session import get_yf_session

# Yahoo의 exchange 코드 → 우리 market enum 매핑
_EXCHANGE_TO_MARKET: dict[str, str] = {
    "NMS": "NASDAQ",     # NASDAQ Global Select
    "NGM": "NASDAQ",     # NASDAQ Global Market
    "NCM": "NASDAQ",     # NASDAQ Capital Market
    "NYQ": "NYSE",       # NYSE
    "KSC": "KRX_KS",     # KOSPI
    "KOE": "KRX_KQ",     # KOSDAQ (yfinance 일부 표기)
    "KQE": "KRX_KQ",     # KOSDAQ
}


@dataclass(frozen=True)
class YahooQuote:
    symbol: str
    name: str
    currency: str
    market: str
    price: float
    market_cap: float | None
    per: float | None
    sector: str | None
    fifty_two_week_high: float | None
    fifty_two_week_low: float | None


def _market_from_info(info: dict, symbol: str) -> str:
    exchange = info.get("exchange", "")
    if exchange in _EXCHANGE_TO_MARKET:
        return _EXCHANGE_TO_MARKET[exchange]
    # 폴백: 심볼 suffix
    if symbol.endswith(".KS"):
        return "KRX_KS"
    if symbol.endswith(".KQ"):
        return "KRX_KQ"
    return "NASDAQ"  # default for US tickers without exchange


# 외부 API 응답이 자주 일시 실패하는데, 재시도 대기를 짧게 — 부팅 시 200개 호출이
# 누적 대기로 너무 느려지면 안 됨. 실패한 종목은 fetch_prices 잡이 1분마다 재시도.
@retry(stop=stop_after_attempt(2), wait=wait_exponential(multiplier=0.5, min=0.5, max=2))
def fetch_quote(symbol: str) -> YahooQuote | None:
    """yfinance에서 1개 종목 시세를 가져옴. 빈/유효하지 않은 응답은 None 반환."""
    info = yf.Ticker(symbol, session=get_yf_session()).info
    if not info or not info.get("regularMarketPrice"):
        return None

    name = info.get("longName") or info.get("shortName") or symbol
    return YahooQuote(
        symbol=symbol,
        name=name,
        currency=info.get("currency", "USD"),
        market=_market_from_info(info, symbol),
        price=float(info["regularMarketPrice"]),
        market_cap=info.get("marketCap"),
        per=info.get("trailingPE"),
        sector=info.get("sector"),
        fifty_two_week_high=info.get("fiftyTwoWeekHigh"),
        fifty_two_week_low=info.get("fiftyTwoWeekLow"),
    )


def fetch_quotes(symbols: list[str]) -> list[YahooQuote]:
    """여러 심볼을 순차 호출. None은 제외하여 반환."""
    out: list[YahooQuote] = []
    for s in symbols:
        try:
            q = fetch_quote(s)
            if q is not None:
                out.append(q)
        except Exception:
            # 호출 실패는 로그만 하고 계속 (호출자가 logger 주입)
            continue
    return out


def fetch_closes_batch(symbols: list[str]) -> dict[str, float]:
    """Batch download 최근 종가 — yfinance.download은 한 번 호출로 수백개 심볼 처리.

    Plan #20.2 hotfix: per-symbol fdr.DataReader는 506 종목 × 0.25s = 125s.
    yf.download은 같은 506개를 ~5-10s에 끝낸다.

    Returns: {symbol: latest_close}. 실패한 심볼은 dict에 없음.
    """
    if not symbols:
        return {}
    try:
        df = yf.download(
            tickers=symbols,
            period="5d",
            interval="1d",
            group_by="ticker",
            threads=True,
            progress=False,
            auto_adjust=True,
            session=get_yf_session(),
        )
    except Exception:
        return {}
    if df is None or getattr(df, "empty", True):
        return {}

    out: dict[str, float] = {}
    single = len(symbols) == 1

    for symbol in symbols:
        try:
            if single:
                close_series = df.get("Close")
            else:
                # multi-symbol: columns is MultiIndex (ticker, field)
                if symbol not in df.columns.get_level_values(0):
                    continue
                close_series = df[symbol].get("Close")
            if close_series is None:
                continue
            cleaned = close_series.dropna()
            if cleaned.empty:
                continue
            close = cleaned.iloc[-1]
            if close is None or (isinstance(close, float) and close != close):
                continue
            out[symbol] = float(close)
        except (KeyError, IndexError, AttributeError):
            continue
    return out


@retry(stop=stop_after_attempt(2), wait=wait_exponential(multiplier=0.5, min=0.5, max=2))
def fetch_history(symbol: str, period: str = "60d", interval: str = "15m") -> list[dict]:
    """yfinance Ticker.history() 래핑.

    period: '1d', '5d', '60d', '1y', '2y', '5y', '10y', 'max'
    interval: '15m', '1h', '1d'
    """
    df = yf.Ticker(symbol, session=get_yf_session()).history(period=period, interval=interval)
    if df is None or df.empty:
        return []
    out: list[dict] = []
    for idx, row in df.iterrows():
        try:
            volume = row.get("Volume")
            volume_int = 0 if volume is None or volume != volume else int(volume)
            out.append({
                "ts": idx.to_pydatetime() if hasattr(idx, "to_pydatetime") else idx,
                "open": float(row["Open"]),
                "high": float(row["High"]),
                "low": float(row["Low"]),
                "close": float(row["Close"]),
                "volume": volume_int,
            })
        except (ValueError, TypeError, KeyError):
            continue
    return out
