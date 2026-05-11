from unittest.mock import patch

import pandas as pd

from ygworker.data_sources.fdr import (
    KrListingItem,
    fetch_daily_history,
    fetch_us_close,
    list_kr_top,
)


@patch("ygworker.data_sources.fdr._fetch_listing")
def test_list_kr_top_combines_kospi_and_kosdaq(mock_listing):
    kospi_df = pd.DataFrame(
        {
            "Code": ["005930", "000660"],
            "Name": ["삼성전자", "SK하이닉스"],
            "Marcap": [1_500_000_000_000_000, 1_200_000_000_000_000],
            "Close": [268500.0, 1686000.0],
        }
    )
    kosdaq_df = pd.DataFrame(
        {
            "Code": ["247540"],
            "Name": ["에코프로비엠"],
            "Marcap": [23_000_000_000_000],
            "Close": [237500.0],
        }
    )
    mock_listing.side_effect = [kospi_df, kosdaq_df]

    result = list_kr_top(limit=5)

    assert result == [
        KrListingItem(
            symbol="005930.KS", market="KRX_KS", name_ko="삼성전자",
            market_cap=1_500_000_000_000_000, last_price=268500.0,
        ),
        KrListingItem(
            symbol="000660.KS", market="KRX_KS", name_ko="SK하이닉스",
            market_cap=1_200_000_000_000_000, last_price=1686000.0,
        ),
        KrListingItem(
            symbol="247540.KQ", market="KRX_KQ", name_ko="에코프로비엠",
            market_cap=23_000_000_000_000, last_price=237500.0,
        ),
    ]


@patch("ygworker.data_sources.fdr._fetch_listing")
def test_list_kr_top_skips_empty_rows(mock_listing):
    kospi_df = pd.DataFrame(
        {
            "Code": ["005930", "", "BAD"],
            "Name": ["삼성전자", "이름없음", ""],
            "Marcap": [1_500_000_000_000_000, 1_000_000_000_000_000, 500_000_000_000_000],
            "Close": [268500.0, None, None],
        }
    )
    kosdaq_df = pd.DataFrame()  # 빈 DF
    mock_listing.side_effect = [kospi_df, kosdaq_df]

    result = list_kr_top(limit=10)

    # 빈 Code 또는 빈 Name은 누락
    assert len(result) == 1
    assert result[0].symbol == "005930.KS"


@patch("ygworker.data_sources.fdr.fdr.DataReader")
def test_fetch_us_close_returns_last_close(mock_reader):
    mock_reader.return_value = pd.DataFrame(
        {"Close": [150.0, 155.0, 158.5]},
        index=pd.date_range("2026-05-06", periods=3),
    )
    result = fetch_us_close("AAPL")
    assert result == 158.5


@patch("ygworker.data_sources.fdr.fdr.DataReader")
def test_fetch_us_close_returns_none_when_empty(mock_reader):
    mock_reader.return_value = pd.DataFrame()
    assert fetch_us_close("INVALID") is None


@patch("ygworker.data_sources.fdr.fdr.DataReader")
def test_fetch_daily_history_returns_ohlcv_list(mock_reader):
    df = pd.DataFrame(
        {
            "Open": [100.0, 102.0, 105.0],
            "High": [103.0, 106.0, 108.0],
            "Low": [99.0, 101.0, 104.0],
            "Close": [102.0, 105.0, 107.0],
            "Volume": [1_000_000, 1_200_000, 1_500_000],
        },
        index=pd.to_datetime(["2026-05-08", "2026-05-09", "2026-05-12"]),
    )
    mock_reader.return_value = df

    bars = fetch_daily_history("AAPL", days=10)

    assert len(bars) == 3
    assert bars[0]["ts"].isoformat().startswith("2026-05-08")
    assert bars[0]["open"] == 100.0
    assert bars[0]["high"] == 103.0
    assert bars[0]["low"] == 99.0
    assert bars[0]["close"] == 102.0
    assert bars[0]["volume"] == 1_000_000


@patch("ygworker.data_sources.fdr.fdr.DataReader")
def test_fetch_daily_history_returns_empty_on_no_data(mock_reader):
    mock_reader.return_value = pd.DataFrame()
    assert fetch_daily_history("INVALID", days=10) == []


@patch("ygworker.data_sources.fdr.fdr.DataReader")
def test_fetch_daily_history_strips_kr_suffix_before_fdr_call(mock_reader):
    """FDR은 KR 심볼을 bare code(005930)로 받음 — `.KS`/`.KQ`는 떼어 호출.

    Regression: 종전엔 `.KS`까지 그대로 넘겨 FDR이 'invalid symbol or has no data'
    반환 → KR 일봉이 한 종목도 채워지지 않음.
    """
    df = pd.DataFrame(
        {
            "Open": [268000.0],
            "High": [270000.0],
            "Low": [266000.0],
            "Close": [268500.0],
            "Volume": [12_000_000],
        },
        index=pd.to_datetime(["2026-05-08"]),
    )
    mock_reader.return_value = df

    bars_ks = fetch_daily_history("005930.KS", days=10)
    bars_kq = fetch_daily_history("247540.KQ", days=10)
    bars_us = fetch_daily_history("AAPL", days=10)

    called_symbols = [c.args[0] for c in mock_reader.call_args_list]
    assert called_symbols == ["005930", "247540", "AAPL"]
    assert len(bars_ks) == 1 and len(bars_kq) == 1 and len(bars_us) == 1


@patch("ygworker.data_sources.fdr.fdr.DataReader")
def test_fetch_daily_history_skips_nan_rows(mock_reader):
    df = pd.DataFrame(
        {
            "Open": [100.0, float("nan"), 105.0],
            "High": [103.0, 106.0, 108.0],
            "Low": [99.0, 101.0, 104.0],
            "Close": [102.0, 105.0, 107.0],
            "Volume": [1_000_000, 1_200_000, 1_500_000],
        },
        index=pd.to_datetime(["2026-05-08", "2026-05-09", "2026-05-12"]),
    )
    mock_reader.return_value = df

    bars = fetch_daily_history("AAPL", days=10)
    assert len(bars) == 2
    assert bars[0]["close"] == 102.0
    assert bars[1]["close"] == 107.0
