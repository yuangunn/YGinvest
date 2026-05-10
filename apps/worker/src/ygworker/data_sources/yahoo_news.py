from datetime import UTC, datetime

import yfinance as yf
from tenacity import retry, stop_after_attempt, wait_exponential


@retry(stop=stop_after_attempt(2), wait=wait_exponential(multiplier=0.5, min=0.5, max=2))
def fetch_news(symbol: str, limit: int = 10) -> list[dict]:
    """yfinance Ticker.news 래핑. Returns list of dicts with title/link/publisher/published_at."""
    raw = yf.Ticker(symbol).news or []
    out: list[dict] = []
    for item in raw[:limit]:
        try:
            ts = item.get("providerPublishTime")
            published_at = datetime.fromtimestamp(ts, tz=UTC).isoformat() if ts else None
            out.append({
                "title": item.get("title", ""),
                "link": item.get("link", ""),
                "publisher": item.get("publisher", ""),
                "published_at": published_at,
            })
        except (ValueError, TypeError):
            continue
    return out


@retry(stop=stop_after_attempt(2), wait=wait_exponential(multiplier=0.5, min=0.5, max=2))
def fetch_key_metrics(symbol: str) -> dict:
    """yfinance Ticker.info에서 핵심 재무 지표만 추출."""
    info = yf.Ticker(symbol).info or {}
    return {
        "trailing_eps": info.get("trailingEps"),
        "forward_pe": info.get("forwardPE"),
        "dividend_yield": info.get("dividendYield"),
        "beta": info.get("beta"),
        "profit_margin": info.get("profitMargins"),
        "roe": info.get("returnOnEquity"),
        "debt_to_equity": info.get("debtToEquity"),
    }
