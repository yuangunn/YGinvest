from unittest.mock import MagicMock, patch

import pytest
from fastapi.testclient import TestClient

from ygworker.data_sources.yahoo import YahooQuote
from ygworker.rpc.app import build_app


def _yq(symbol="AAPL"):
    return YahooQuote(
        symbol=symbol,
        name="Apple Inc.",
        currency="USD",
        market="NASDAQ",
        price=158.5,
        market_cap=2.5e12,
        per=28.5,
        sector="Technology",
        fifty_two_week_high=200.0,
        fifty_two_week_low=120.0,
    )


@pytest.fixture
def client():
    fake_supabase = MagicMock()
    app = build_app(supabase=fake_supabase, secret="test-secret")
    return TestClient(app), fake_supabase


def test_lookup_unauthenticated_returns_401(client):
    c, _ = client
    r = c.post("/rpc/stocks/lookup", json={"symbol": "AAPL"})
    assert r.status_code == 401


def test_lookup_wrong_secret_returns_401(client):
    c, _ = client
    r = c.post(
        "/rpc/stocks/lookup",
        json={"symbol": "AAPL"},
        headers={"X-Worker-Secret": "wrong"},
    )
    assert r.status_code == 401


@patch("ygworker.rpc.stocks.fetch_quote")
def test_lookup_returns_quote_and_upserts(mock_quote, client):
    c, fake_supabase = client
    mock_quote.return_value = _yq("AAPL")
    r = c.post(
        "/rpc/stocks/lookup",
        json={"symbol": "AAPL"},
        headers={"X-Worker-Secret": "test-secret"},
    )
    assert r.status_code == 200
    body = r.json()
    assert body["symbol"] == "AAPL"
    assert body["name"] == "Apple Inc."
    assert body["price"] == 158.5
    assert body["market"] == "NASDAQ"
    fake_supabase.table.assert_called_with("stocks")


@patch("ygworker.rpc.stocks.fetch_quote")
def test_lookup_unknown_symbol_returns_404(mock_quote, client):
    c, _ = client
    mock_quote.return_value = None
    r = c.post(
        "/rpc/stocks/lookup",
        json={"symbol": "INVALID"},
        headers={"X-Worker-Secret": "test-secret"},
    )
    assert r.status_code == 404


@patch("ygworker.rpc.stocks.fetch_history")
def test_bars_returns_ohlcv(mock_history, client):
    c, _ = client
    mock_history.return_value = [
        {
            "ts": "2026-05-08T13:30:00+00:00",
            "open": 100, "high": 105, "low": 99, "close": 102, "volume": 1_000_000,
        },
    ]
    r = c.post(
        "/rpc/stocks/bars",
        json={"symbol": "AAPL", "interval": "15m", "period": "60d"},
        headers={"X-Worker-Secret": "test-secret"},
    )
    assert r.status_code == 200
    body = r.json()
    assert body["symbol"] == "AAPL"
    assert body["interval"] == "15m"
    assert len(body["bars"]) == 1
    mock_history.assert_called_with("AAPL", period="60d", interval="15m")


def test_bars_unauthenticated_401(client):
    c, _ = client
    r = c.post("/rpc/stocks/bars", json={"symbol": "AAPL", "interval": "15m"})
    assert r.status_code == 401


@patch("ygworker.rpc.stocks.fetch_news")
def test_news_returns_items(mock_news, client):
    c, _ = client
    mock_news.return_value = [
        {
            "title": "Apple news",
            "link": "https://example.com/1",
            "publisher": "Reuters",
            "published_at": "2026-05-08T00:00:00+00:00",
        },
    ]
    r = c.post(
        "/rpc/stocks/news",
        json={"symbol": "AAPL", "limit": 5},
        headers={"X-Worker-Secret": "test-secret"},
    )
    assert r.status_code == 200
    assert r.json()["news"][0]["title"] == "Apple news"


@patch("ygworker.rpc.stocks.fetch_key_metrics")
def test_financials_returns_metrics(mock_metrics, client):
    c, _ = client
    mock_metrics.return_value = {
        "trailing_eps": 6.32,
        "forward_pe": 28.5,
        "dividend_yield": 0.0042,
        "beta": 1.21,
        "profit_margin": 0.247,
        "roe": 1.43,
        "debt_to_equity": 195.0,
    }
    r = c.post(
        "/rpc/stocks/financials",
        json={"symbol": "AAPL"},
        headers={"X-Worker-Secret": "test-secret"},
    )
    assert r.status_code == 200
    body = r.json()
    assert body["trailing_eps"] == 6.32
    assert body["forward_pe"] == 28.5
