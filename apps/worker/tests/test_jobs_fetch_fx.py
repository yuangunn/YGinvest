from unittest.mock import MagicMock, patch

from ygworker.jobs.fetch_fx import run_fetch_fx


@patch("ygworker.jobs.fetch_fx.fetch_usd_krw_rate")
def test_fetch_fx_inserts_row(mock_rate):
    mock_rate.return_value = 1395.42
    fake = MagicMock()
    logger = MagicMock()

    run_fetch_fx(fake, logger)

    insert_call = fake.table.return_value.insert.call_args
    payload = insert_call.args[0] if insert_call.args else insert_call.kwargs.get("rows", [])
    assert payload["base"] == "USD"
    assert payload["quote"] == "KRW"
    assert payload["rate"] == 1395.42
    assert "ts" in payload


@patch("ygworker.jobs.fetch_fx.fetch_usd_krw_rate")
def test_fetch_fx_logs_error_on_failure(mock_rate):
    mock_rate.side_effect = RuntimeError("API down")
    fake = MagicMock()
    logger = MagicMock()

    run_fetch_fx(fake, logger)

    logger.error.assert_called_once()
    fake.table.return_value.insert.assert_not_called()
