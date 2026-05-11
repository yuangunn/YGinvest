from unittest.mock import MagicMock

from ygworker.jobs.portfolio_snapshot import run_portfolio_snapshot


def test_snapshot_records_for_each_active_portfolio():
    fake = MagicMock()
    portfolios_data = [
        {"id": "p1"},
        {"id": "p2"},
    ]
    fake.table.return_value.select.return_value.eq.return_value.execute.return_value.data = (
        portfolios_data
    )
    fake.rpc.return_value.execute.side_effect = [
        MagicMock(data={"total_value_krw": 100_000_000.0, "return_pct": 0.0}),
        MagicMock(data={"total_value_krw": 120_000_000.0, "return_pct": 20.0}),
    ]
    logger = MagicMock()

    run_portfolio_snapshot(fake, logger)

    insert_call = fake.table.return_value.insert.call_args
    rows = insert_call.args[0] if insert_call.args else []
    assert len(rows) == 2
    assert rows[0]["portfolio_id"] == "p1"
    assert float(rows[0]["total_value_krw"]) == 100_000_000.0
    assert float(rows[1]["return_pct"]) == 20.0


def test_snapshot_skips_when_no_active():
    fake = MagicMock()
    fake.table.return_value.select.return_value.eq.return_value.execute.return_value.data = []
    logger = MagicMock()

    run_portfolio_snapshot(fake, logger)

    fake.rpc.assert_not_called()
    logger.info.assert_called_with(
        "portfolio_snapshot.skip", reason="no_active_portfolios"
    )


def test_snapshot_continues_on_compute_error():
    fake = MagicMock()
    fake.table.return_value.select.return_value.eq.return_value.execute.return_value.data = [
        {"id": "p1"},
        {"id": "p2"},
    ]
    fake.rpc.return_value.execute.side_effect = [
        MagicMock(data={"total_value_krw": 100.0, "return_pct": 0.0}),
        RuntimeError("compute failed"),
    ]
    logger = MagicMock()

    run_portfolio_snapshot(fake, logger)

    insert_call = fake.table.return_value.insert.call_args
    rows = insert_call.args[0] if insert_call.args else []
    assert len(rows) == 1
    assert rows[0]["portfolio_id"] == "p1"
    logger.error.assert_called()
