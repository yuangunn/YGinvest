from unittest.mock import MagicMock, patch

from ygworker.data_sources.fdr import KrListingItem
from ygworker.jobs.bootstrap_stocks import run_bootstrap_stocks


@patch("ygworker.jobs.bootstrap_stocks.fetch_us_close")
@patch("ygworker.jobs.bootstrap_stocks.list_kr_top")
def test_bootstrap_skips_if_table_not_empty(mock_kr, mock_us):
    fake_supabase = MagicMock()
    select_mock = (
        fake_supabase.table.return_value.select.return_value.limit.return_value.execute
    )
    select_mock.return_value.data = [{"symbol": "AAPL"}]
    logger = MagicMock()

    run_bootstrap_stocks(fake_supabase, logger)

    mock_kr.assert_not_called()
    mock_us.assert_not_called()
    logger.info.assert_called_with("bootstrap_stocks.skip", reason="already_populated")


@patch("ygworker.jobs.bootstrap_stocks.fetch_us_close")
@patch("ygworker.jobs.bootstrap_stocks.list_kr_top")
def test_bootstrap_inserts_kr_top_and_us_top(mock_kr, mock_us):
    fake_supabase = MagicMock()
    select_mock = (
        fake_supabase.table.return_value.select.return_value.limit.return_value.execute
    )
    select_mock.return_value.data = []
    upsert_mock = fake_supabase.table.return_value.upsert.return_value.execute
    upsert_mock.return_value.data = []
    logger = MagicMock()

    mock_kr.return_value = [
        KrListingItem("005930.KS", "KRX_KS", "삼성전자", 1.5e15, 268500.0),
    ]
    mock_us.side_effect = lambda sym: {"AAPL": 158.5, "MSFT": 380.0}.get(sym)

    run_bootstrap_stocks(fake_supabase, logger, kr_limit=1, us_limit=2)

    upsert_calls = fake_supabase.table.return_value.upsert.call_args_list
    inserted_records = []
    for call in upsert_calls:
        records = call.args[0] if call.args else call.kwargs.get("records", [])
        if isinstance(records, list):
            inserted_records.extend(records)

    by_symbol = {r["symbol"]: r for r in inserted_records}
    assert "005930.KS" in by_symbol
    assert by_symbol["005930.KS"]["last_price"] == 268500.0
    assert by_symbol["005930.KS"]["name_ko"] == "삼성전자"
    assert "AAPL" in by_symbol
    assert by_symbol["AAPL"]["last_price"] == 158.5
    assert "MSFT" in by_symbol
    assert by_symbol["MSFT"]["last_price"] == 380.0


@patch("ygworker.jobs.bootstrap_stocks.fetch_us_close")
@patch("ygworker.jobs.bootstrap_stocks.list_kr_top")
def test_bootstrap_inserts_us_with_null_price_on_fetch_failure(mock_kr, mock_us):
    fake_supabase = MagicMock()
    select_mock = (
        fake_supabase.table.return_value.select.return_value.limit.return_value.execute
    )
    select_mock.return_value.data = []
    logger = MagicMock()

    mock_kr.return_value = []
    mock_us.side_effect = RuntimeError("Yahoo down")

    run_bootstrap_stocks(fake_supabase, logger, kr_limit=0, us_limit=1)

    upsert_call = fake_supabase.table.return_value.upsert.call_args
    records = upsert_call.args[0] if upsert_call.args else []
    # AAPL은 들어가지만 last_price=None
    assert len(records) == 1
    assert records[0]["symbol"] == "AAPL"
    assert records[0]["last_price"] is None
