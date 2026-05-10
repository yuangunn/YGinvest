from unittest.mock import patch

import pandas as pd

from ygworker.data_sources.fdr import (
    KrListingItem,
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
