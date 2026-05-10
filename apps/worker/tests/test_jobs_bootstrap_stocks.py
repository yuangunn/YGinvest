from unittest.mock import MagicMock, patch

from ygworker.data_sources.krx import KrxStockMaster
from ygworker.data_sources.yahoo import YahooQuote
from ygworker.jobs.bootstrap_stocks import run_bootstrap_stocks


def _yq(symbol: str, market: str, currency: str = "USD", price: float = 100.0) -> YahooQuote:
    return YahooQuote(
        symbol=symbol,
        name=f"{symbol} Corp",
        currency=currency,
        market=market,
        price=price,
        market_cap=1e12,
        per=20.0,
        sector="Tech",
        fifty_two_week_high=120.0,
        fifty_two_week_low=80.0,
    )


@patch("ygworker.jobs.bootstrap_stocks.list_top_stocks")
@patch("ygworker.jobs.bootstrap_stocks.fetch_quote")
def test_bootstrap_skips_if_table_not_empty(mock_quote, mock_top):
    fake_supabase = MagicMock()
    fake_supabase.table.return_value.select.return_value.limit.return_value.execute.return_value.data = [
        {"symbol": "AAPL"}
    ]
    logger = MagicMock()

    run_bootstrap_stocks(fake_supabase, logger)

    mock_top.assert_not_called()
    mock_quote.assert_not_called()
    logger.info.assert_called_with("bootstrap_stocks.skip", reason="already_populated")


@patch("ygworker.jobs.bootstrap_stocks.fetch_quote")
@patch("ygworker.jobs.bootstrap_stocks.list_top_stocks")
def test_bootstrap_inserts_kr_top_and_us_top(mock_top, mock_quote):
    fake_supabase = MagicMock()
    fake_supabase.table.return_value.select.return_value.limit.return_value.execute.return_value.data = []
    fake_supabase.table.return_value.upsert.return_value.execute.return_value.data = []
    logger = MagicMock()

    mock_top.side_effect = [
        [KrxStockMaster("005930.KS", "KRX_KS", "삼성전자", 4e14)],     # KOSPI
        [KrxStockMaster("247540.KQ", "KRX_KQ", "에코프로비엠", 5e13)],  # KOSDAQ
    ]
    mock_quote.side_effect = lambda s: _yq(
        s,
        "KRX_KS"
        if s.endswith(".KS")
        else "KRX_KQ"
        if s.endswith(".KQ")
        else "NASDAQ",
        "KRW" if s.endswith((".KS", ".KQ")) else "USD",
    )

    run_bootstrap_stocks(fake_supabase, logger, kr_limit=1, us_limit=2)

    upsert_calls = fake_supabase.table.return_value.upsert.call_args_list
    inserted_symbols = []
    for call in upsert_calls:
        records = call.args[0] if call.args else call.kwargs.get("records", [])
        if isinstance(records, list):
            inserted_symbols.extend([r["symbol"] for r in records])
    assert "005930.KS" in inserted_symbols
    assert "247540.KQ" in inserted_symbols
    # US top은 us_top.US_TOP_100 첫 2개
    assert "AAPL" in inserted_symbols
    assert "MSFT" in inserted_symbols
