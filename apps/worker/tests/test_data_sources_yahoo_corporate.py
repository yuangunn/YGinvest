from datetime import date
from unittest.mock import patch

import pandas as pd

from ygworker.data_sources.yahoo_corporate import fetch_dividends, fetch_splits


@patch("ygworker.data_sources.yahoo_corporate.yf.Ticker")
def test_fetch_dividends_returns_future_events(mock_ticker):
    """yfinance dividends Series에서 ex-date >= today만 반환."""
    today = date(2026, 5, 11)
    past = pd.Timestamp("2026-05-01")
    future = pd.Timestamp("2026-08-15")

    series = pd.Series([0.24, 0.25], index=[past, future])
    mock_ticker.return_value.dividends = series

    out = fetch_dividends("AAPL", today=today)
    # past는 제외, future만
    assert len(out) == 1
    assert out[0]["ex_date"] == date(2026, 8, 15)
    assert out[0]["amount_per_share"] == 0.25


@patch("ygworker.data_sources.yahoo_corporate.yf.Ticker")
def test_fetch_dividends_skips_zero(mock_ticker):
    """배당 금액이 0이거나 NaN인 행은 제외."""
    future = pd.Timestamp("2026-08-15")
    other = pd.Timestamp("2026-09-15")

    series = pd.Series([0.0, 0.50], index=[future, other])
    mock_ticker.return_value.dividends = series

    out = fetch_dividends("AAPL", today=date(2026, 5, 11))
    assert len(out) == 1
    assert out[0]["amount_per_share"] == 0.50


@patch("ygworker.data_sources.yahoo_corporate.yf.Ticker")
def test_fetch_dividends_empty_series_returns_empty_list(mock_ticker):
    mock_ticker.return_value.dividends = pd.Series([], dtype=float)
    assert fetch_dividends("ZZZZ", today=date(2026, 5, 11)) == []


@patch("ygworker.data_sources.yahoo_corporate.yf.Ticker")
def test_fetch_splits_returns_forward_split(mock_ticker):
    """ratio > 1은 forward split."""
    future = pd.Timestamp("2026-06-01")
    series = pd.Series([2.0], index=[future])
    mock_ticker.return_value.splits = series

    out = fetch_splits("AAPL", today=date(2026, 5, 11))
    assert len(out) == 1
    assert out[0]["ex_date"] == date(2026, 6, 1)
    assert out[0]["ratio"] == 2.0
    assert out[0]["action_type"] == "split"


@patch("ygworker.data_sources.yahoo_corporate.yf.Ticker")
def test_fetch_splits_returns_reverse_split(mock_ticker):
    """ratio < 1은 reverse split."""
    future = pd.Timestamp("2026-06-01")
    series = pd.Series([0.5], index=[future])
    mock_ticker.return_value.splits = series

    out = fetch_splits("XYZ", today=date(2026, 5, 11))
    assert len(out) == 1
    assert out[0]["ratio"] == 0.5
    assert out[0]["action_type"] == "reverse_split"


@patch("ygworker.data_sources.yahoo_corporate.yf.Ticker")
def test_fetch_splits_skips_ratio_one(mock_ticker):
    """ratio == 1은 의미 없음. 제외."""
    series = pd.Series([1.0], index=[pd.Timestamp("2026-06-01")])
    mock_ticker.return_value.splits = series

    assert fetch_splits("FOO", today=date(2026, 5, 11)) == []
