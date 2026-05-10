from unittest.mock import patch

from ygworker.data_sources.yahoo_news import fetch_key_metrics, fetch_news


@patch("ygworker.data_sources.yahoo_news.yf.Ticker")
def test_fetch_news_returns_titles_and_links(mock_ticker):
    mock_ticker.return_value.news = [
        {
            "title": "Apple announces new iPhone",
            "link": "https://example.com/news/1",
            "publisher": "Reuters",
            "providerPublishTime": 1715000000,
        },
        {
            "title": "AAPL stock surges",
            "link": "https://example.com/news/2",
            "publisher": "CNBC",
            "providerPublishTime": 1714900000,
        },
    ]
    news = fetch_news("AAPL", limit=5)
    assert len(news) == 2
    assert news[0]["title"] == "Apple announces new iPhone"
    assert news[0]["link"] == "https://example.com/news/1"
    assert news[0]["publisher"] == "Reuters"
    assert "published_at" in news[0]


@patch("ygworker.data_sources.yahoo_news.yf.Ticker")
def test_fetch_news_respects_limit(mock_ticker):
    mock_ticker.return_value.news = [
        {
            "title": f"News {i}",
            "link": f"https://example.com/{i}",
            "publisher": "X",
            "providerPublishTime": 1700000000 + i,
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
