from datetime import UTC, datetime

import yfinance as yf
from tenacity import retry, stop_after_attempt, wait_exponential

from ygworker.data_sources.yf_session import get_yf_session


@retry(stop=stop_after_attempt(2), wait=wait_exponential(multiplier=0.5, min=0.5, max=2))
def fetch_news(symbol: str, limit: int = 10) -> list[dict]:
    """yfinance Ticker.news 래핑. Returns list of dicts with title/link/publisher/published_at.

    yfinance가 응답 shape를 변경(2025?): 종전엔 `{title, link, publisher, providerPublishTime}`
    가 top-level이었으나, 현재는 `{id, content: {title, provider, clickThroughUrl, pubDate, ...}}`
    구조. 두 shape 모두 지원하도록 폴백을 둠.
    """
    raw = yf.Ticker(symbol, session=get_yf_session()).news or []
    out: list[dict] = []
    for item in raw[:limit]:
        try:
            # 신 shape: nested under "content"
            content = item.get("content") if isinstance(item.get("content"), dict) else None

            if content is not None:
                title = content.get("title", "") or ""
                provider = content.get("provider")
                provider_d = provider if isinstance(provider, dict) else {}
                publisher = provider_d.get("displayName", "") or ""

                click_through = content.get("clickThroughUrl")
                click_d = click_through if isinstance(click_through, dict) else {}
                canonical = content.get("canonicalUrl")
                canonical_d = canonical if isinstance(canonical, dict) else {}
                link = click_d.get("url") or canonical_d.get("url") or ""

                pub_date = content.get("pubDate") or content.get("displayTime")
                published_at = _normalize_pub_date(pub_date)
            else:
                # 구 shape: top-level keys
                ts = item.get("providerPublishTime")
                published_at = (
                    datetime.fromtimestamp(ts, tz=UTC).isoformat() if ts else None
                )
                title = item.get("title", "") or ""
                link = item.get("link", "") or ""
                publisher = item.get("publisher", "") or ""

            # 모두 빈 string이면 skip (parse 실패한 경우)
            if not title and not link:
                continue

            out.append({
                "title": title,
                "link": link,
                "publisher": publisher,
                "published_at": published_at,
            })
        except (ValueError, TypeError, AttributeError):
            continue
    return out


def _normalize_pub_date(value: object) -> str | None:
    """yfinance new shape의 pubDate는 ISO 8601 문자열(`2026-05-10T10:42:34Z`).
    구 shape의 providerPublishTime은 epoch int. 둘 다 ISO 문자열로 정규화.
    """
    if value is None:
        return None
    if isinstance(value, (int, float)):
        try:
            return datetime.fromtimestamp(float(value), tz=UTC).isoformat()
        except (ValueError, OSError):
            return None
    if isinstance(value, str):
        return value  # 이미 ISO
    return None


@retry(stop=stop_after_attempt(2), wait=wait_exponential(multiplier=0.5, min=0.5, max=2))
def fetch_key_metrics(symbol: str) -> dict:
    """yfinance Ticker.info에서 핵심 재무 지표만 추출."""
    info = yf.Ticker(symbol, session=get_yf_session()).info or {}
    return {
        "trailing_eps": info.get("trailingEps"),
        "forward_pe": info.get("forwardPE"),
        "dividend_yield": info.get("dividendYield"),
        "beta": info.get("beta"),
        "profit_margin": info.get("profitMargins"),
        "roe": info.get("returnOnEquity"),
        "debt_to_equity": info.get("debtToEquity"),
    }
