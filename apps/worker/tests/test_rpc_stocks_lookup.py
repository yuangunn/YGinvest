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
