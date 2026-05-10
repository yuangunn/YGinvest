from unittest.mock import patch

import pandas as pd

from ygworker.data_sources.krx import KrxStockMaster, list_top_stocks


@patch("ygworker.data_sources.krx.stock.get_market_cap_by_ticker")
@patch("ygworker.data_sources.krx.stock.get_market_ticker_name")
def test_list_top_stocks_kospi_top_3(mock_name, mock_cap):
    cap_df = pd.DataFrame(
        {
            "시가총액": [400_000_000_000_000, 200_000_000_000_000, 100_000_000_000_000],
        },
        index=["005930", "000660", "035420"],
    )
    mock_cap.return_value = cap_df
    mock_name.side_effect = lambda code: {
        "005930": "삼성전자",
        "000660": "SK하이닉스",
        "035420": "NAVER",
    }[code]

    result = list_top_stocks(market="KOSPI", limit=3)

    assert result == [
        KrxStockMaster(
            symbol="005930.KS",
            market="KRX_KS",
            name_ko="삼성전자",
            market_cap=400_000_000_000_000,
        ),
        KrxStockMaster(
            symbol="000660.KS",
            market="KRX_KS",
            name_ko="SK하이닉스",
            market_cap=200_000_000_000_000,
        ),
        KrxStockMaster(
            symbol="035420.KS",
            market="KRX_KS",
            name_ko="NAVER",
            market_cap=100_000_000_000_000,
        ),
    ]


@patch("ygworker.data_sources.krx.stock.get_market_cap_by_ticker")
@patch("ygworker.data_sources.krx.stock.get_market_ticker_name")
def test_list_top_stocks_kosdaq_uses_kq_suffix(mock_name, mock_cap):
    cap_df = pd.DataFrame(
        {"시가총액": [50_000_000_000_000]},
        index=["247540"],
    )
    mock_cap.return_value = cap_df
    mock_name.return_value = "에코프로비엠"

    result = list_top_stocks(market="KOSDAQ", limit=1)

    assert result[0].symbol == "247540.KQ"
    assert result[0].market == "KRX_KQ"
