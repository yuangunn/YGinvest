from unittest.mock import patch

from ygworker.data_sources.yahoo_news import fetch_key_metrics, fetch_news


@patch("ygworker.data_sources.yahoo_news.yf.Ticker")
def test_fetch_news_new_shape_extracts_nested_content(mock_ticker):
    """yfinance 신 shape: 모든 메타가 `content` dict에 nested."""
    mock_ticker.return_value.news = [
        {
            "id": "abc-123",
            "content": {
                "title": "Apple announces new iPhone",
                "provider": {"displayName": "Reuters"},
                "clickThroughUrl": {"url": "https://example.com/news/1"},
                "pubDate": "2026-05-10T10:42:34Z",
            },
        },
        {
            "id": "def-456",
            "content": {
                "title": "AAPL stock surges",
                "provider": {"displayName": "CNBC"},
                "canonicalUrl": {"url": "https://example.com/news/2"},
                "pubDate": "2026-05-09T08:00:00Z",
            },
        },
    ]
    news = fetch_news("AAPL", limit=5)
    assert len(news) == 2
    assert news[0]["title"] == "Apple announces new iPhone"
    assert news[0]["link"] == "https://example.com/news/1"
    assert news[0]["publisher"] == "Reuters"
    assert news[0]["published_at"] == "2026-05-10T10:42:34Z"
    # canonicalUrl 폴백 검증
    assert news[1]["link"] == "https://example.com/news/2"


@patch("ygworker.data_sources.yahoo_news.yf.Ticker")
def test_fetch_news_old_shape_still_supported(mock_ticker):
    """legacy yfinance shape (top-level title/link/publisher)도 호환."""
    mock_ticker.return_value.news = [
        {
            "title": "Old style news",
            "link": "https://example.com/old",
            "publisher": "Reuters",
            "providerPublishTime": 1715000000,
        },
    ]
    news = fetch_news("AAPL", limit=5)
    assert len(news) == 1
    assert news[0]["title"] == "Old style news"
    assert news[0]["link"] == "https://example.com/old"
    assert news[0]["publisher"] == "Reuters"
    assert news[0]["published_at"] is not None


@patch("ygworker.data_sources.yahoo_news.yf.Ticker")
def test_fetch_news_skips_empty_items(mock_ticker):
    """title도 link도 비어있는 아이템은 결과에서 제외."""
    mock_ticker.return_value.news = [
        {"id": "empty", "content": {"title": "", "provider": {}}},
        {
            "id": "ok",
            "content": {
                "title": "Real news",
                "provider": {"displayName": "Reuters"},
                "clickThroughUrl": {"url": "https://example.com/ok"},
                "pubDate": "2026-05-10T10:00:00Z",
            },
        },
    ]
    news = fetch_news("AAPL", limit=5)
    assert len(news) == 1
    assert news[0]["title"] == "Real news"


@patch("ygworker.data_sources.yahoo_news.yf.Ticker")
def test_fetch_news_respects_limit(mock_ticker):
    mock_ticker.return_value.news = [
        {
            "id": f"id-{i}",
            "content": {
                "title": f"News {i}",
                "provider": {"displayName": "X"},
                "clickThroughUrl": {"url": f"https://example.com/{i}"},
                "pubDate": "2026-05-10T10:00:00Z",
            },
        }
        for i in range(20)
    ]
    news = fetch_news("AAPL", limit=5)
    assert len(news) == 5


@patch("ygworker.data_sources.yahoo_news.yf.Ticker")
def test_fetch_key_metrics_returns_subset(mock_ticker):
    mock_ticker.return_value.info = {
        "trailingEps": 6.32,
        "forwardPE": 28.5,
        "dividendYield": 0.0042,
        "beta": 1.21,
        "profitMargins": 0.247,
        "returnOnEquity": 1.43,
        "debtToEquity": 195.0,
        "regularMarketPrice": 158.5,
    }
    metrics = fetch_key_metrics("AAPL")
    assert metrics["trailing_eps"] == 6.32
    assert metrics["forward_pe"] == 28.5
    assert metrics["dividend_yield"] == 0.0042
    assert metrics["beta"] == 1.21
    assert metrics["profit_margin"] == 0.247
    assert metrics["roe"] == 1.43
    assert metrics["debt_to_equity"] == 195.0


@patch("ygworker.data_sources.yahoo_news.yf.Ticker")
def test_fetch_key_metrics_handles_missing_fields(mock_ticker):
    mock_ticker.return_value.info = {"trailingEps": 6.32}
    metrics = fetch_key_metrics("AAPL")
    assert metrics["trailing_eps"] == 6.32
    assert metrics["forward_pe"] is None
    assert metrics["beta"] is None
