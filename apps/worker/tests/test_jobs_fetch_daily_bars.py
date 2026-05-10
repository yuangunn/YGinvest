from datetime import datetime, UTC
from unittest.mock import MagicMock, patch

from ygworker.jobs.fetch_daily_bars import run_fetch_daily_bars


@patch("ygworker.jobs.fetch_daily_bars.fetch_daily_history")
def test_fetch_daily_bars_inserts_bars_per_stock(mock_history):
    fake = MagicMock()
    fake.table.return_value.select.return_value.eq.return_value.execute.return_value.data = [
        {"symbol": "AAPL"},
        {"symbol": "005930.KS"},
    ]
    mock_history.side_effect = [
        [
            {"ts": datetime(2026, 5, 8, tzinfo=UTC), "open": 100, "high": 105, "low": 99, "close": 102, "volume": 1000},
            {"ts": datetime(2026, 5, 9, tzinfo=UTC), "open": 102, "high": 108, "low": 101, "close": 107, "volume": 1500},
        ],
        [
            {"ts": datetime(2026, 5, 8, tzinfo=UTC), "open": 70000, "high": 72000, "low": 69000, "close": 71000, "volume": 500},
        ],
    ]
    logger = MagicMock()

    run_fetch_daily_bars(fake, logger)

    upsert_calls = fake.table.return_value.upsert.call_args_list
    inserted = []
    for call in upsert_calls:
        records = call.args[0] if call.args else []
        inserted.extend(records)
    assert len(inserted) == 3
    assert all(r["interval"] == "1d" for r in inserted)


@patch("ygworker.jobs.fetch_daily_bars.fetch_daily_history")
def test_fetch_daily_bars_handles_no_active_symbols(mock_history):
    fake = MagicMock()
    fake.table.return_value.select.return_value.eq.return_value.execute.return_value.data = []
    logger = MagicMock()

    run_fetch_daily_bars(fake, logger)

    mock_history.assert_not_called()
    logger.info.assert_called_with("fetch_daily_bars.skip", reason="no_active_symbols")


@patch("ygworker.jobs.fetch_daily_bars.fetch_daily_history")
def test_fetch_daily_bars_continues_on_per_symbol_failure(mock_history):
    fake = MagicMock()
    fake.table.return_value.select.return_value.eq.return_value.execute.return_value.data = [
        {"symbol": "AAPL"},
        {"symbol": "BAD"},
    ]
    mock_history.side_effect = [
        [{"ts": datetime(2026, 5, 9, tzinfo=UTC), "open": 100, "high": 105, "low": 99, "close": 102, "volume": 1000}],
        RuntimeError("network error"),
    ]
    logger = MagicMock()

    run_fetch_daily_bars(fake, logger)

    upsert_calls = fake.table.return_value.upsert.call_args_list
    inserted = []
    for call in upsert_calls:
        records = call.args[0] if call.args else []
        inserted.extend(records)
    assert len(inserted) == 1
    assert inserted[0]["symbol"] == "AAPL"
    logger.warning.assert_called()
