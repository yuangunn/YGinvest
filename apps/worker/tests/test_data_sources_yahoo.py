from unittest.mock import patch

import pytest

from ygworker.data_sources.yahoo import (
    YahooQuote,
    fetch_quote,
    fetch_quotes,
)


@patch("ygworker.data_sources.yahoo.yf.Ticker")
def test_fetch_quote_us_apple(mock_ticker):
    mock_ticker.return_value.info = {
        "longName": "Apple Inc.",
        "currency": "USD",
        "marketCap": 2_500_000_000_000,
        "trailingPE": 28.5,
        "regularMarketPrice": 158.5,
        "fiftyTwoWeekHigh": 200.0,
        "fiftyTwoWeekLow": 120.0,
        "sector": "Technology",
        "exchange": "NMS",
    }

    quote = fetch_quote("AAPL")

    assert quote == YahooQuote(
        symbol="AAPL",
        name="Apple Inc.",
        currency="USD",
        market="NASDAQ",
        price=158.5,
        market_cap=2_500_000_000_000,
        per=28.5,
        sector="Technology",
        fifty_two_week_high=200.0,
        fifty_two_week_low=120.0,
    )


@patch("ygworker.data_sources.yahoo.yf.Ticker")
def test_fetch_quote_kr_samsung(mock_ticker):
    mock_ticker.return_value.info = {
        "longName": "Samsung Electronics Co., Ltd.",
        "currency": "KRW",
        "marketCap": 400_000_000_000_000,
        "trailingPE": 12.3,
        "regularMarketPrice": 70000,
        "exchange": "KSC",  # KOSPI
    }

    quote = fetch_quote("005930.KS")

    assert quote.market == "KRX_KS"
    assert quote.currency == "KRW"
    assert quote.price == 70000


@patch("ygworker.data_sources.yahoo.yf.Ticker")
def test_fetch_quote_invalid_symbol_returns_none(mock_ticker):
    mock_ticker.return_value.info = {}  # yfinance 빈 dict 반환 시
    assert fetch_quote("INVALID_XXX") is None


@patch("ygworker.data_sources.yahoo.yf.Ticker")
def test_fetch_quote_raises_after_retries(mock_ticker):
    mock_ticker.side_effect = RuntimeError("Yahoo down")
    # tenacity는 마지막 실패를 RetryError로 wrapping. 어떤 예외든 발생하면 OK
    with pytest.raises(Exception):
        fetch_quote("AAPL")


@patch("ygworker.data_sources.yahoo.fetch_quote")
def test_fetch_quotes_batches(mock_fq):
    mock_fq.side_effect = [
        YahooQuote("AAPL", "Apple Inc.", "USD", "NASDAQ", 158.5, None, None, None, None, None),
        None,
        YahooQuote("MSFT", "Microsoft", "USD", "NASDAQ", 380.0, None, None, None, None, None),
    ]
    quotes = fetch_quotes(["AAPL", "BAD", "MSFT"])
    assert [q.symbol for q in quotes] == ["AAPL", "MSFT"]
