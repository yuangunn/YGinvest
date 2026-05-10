from unittest.mock import MagicMock, patch

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


@patch("ygworker.jobs.bootstrap_stocks.fetch_quote")
def test_bootstrap_skips_if_table_not_empty(mock_quote):
    fake_supabase = MagicMock()
    fake_supabase.table.return_value.select.return_value.limit.return_value.execute.return_value.data = [
        {"symbol": "AAPL"}
    ]
    logger = MagicMock()

    run_bootstrap_stocks(fake_supabase, logger)

    mock_quote.assert_not_called()
    logger.info.assert_called_with("bootstrap_stocks.skip", reason="already_populated")


@patch("ygworker.jobs.bootstrap_stocks.fetch_quote")
def test_bootstrap_inserts_kr_top_and_us_top(mock_quote):
    fake_supabase = MagicMock()
    fake_supabase.table.return_value.select.return_value.limit.return_value.execute.return_value.data = []
    fake_supabase.table.return_value.upsert.return_value.execute.return_value.data = []
    logger = MagicMock()

    # 모든 yfinance 호출에 가짜 quote 반환
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
    # KR top 1: 005930.KS (삼성전자)
    assert "005930.KS" in inserted_symbols
    # US top은 US_TOP_100 첫 2개
    assert "AAPL" in inserted_symbols
    assert "MSFT" in inserted_symbols
