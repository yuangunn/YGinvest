from datetime import date
from unittest.mock import MagicMock, patch

from ygworker.jobs.fetch_corporate_data import run_fetch_corporate_data


@patch("ygworker.jobs.fetch_corporate_data.fetch_splits")
@patch("ygworker.jobs.fetch_corporate_data.fetch_dividends")
def test_fetch_iterates_all_active_stocks_and_upserts(mock_div, mock_split):
    fake = MagicMock()
    fake.table.return_value.select.return_value.eq.return_value.execute.return_value.data = [
        {"symbol": "AAPL", "currency": "USD"},
        {"symbol": "005930.KS", "currency": "KRW"},
    ]
    mock_div.side_effect = [
        [{"ex_date": date(2026, 8, 15), "amount_per_share": 0.25}],
        [],  # 삼성 future dividend 없음
    ]
    mock_split.side_effect = [
        [],
        [{"ex_date": date(2026, 7, 1), "ratio": 2.0, "action_type": "split"}],
    ]
    logger = MagicMock()

    run_fetch_corporate_data(fake, logger, today=date(2026, 5, 11))

    # dividend upsert는 AAPL용 1건
    div_upsert_calls = [
        c
        for c in fake.table.return_value.upsert.call_args_list
        if c.args and c.args[0] and "amount_per_share" in c.args[0][0]
    ]
    assert len(div_upsert_calls) == 1
    assert div_upsert_calls[0].args[0][0]["symbol"] == "AAPL"
    assert div_upsert_calls[0].args[0][0]["amount_per_share"] == 0.25

    # split upsert는 삼성용 1건
    split_upsert_calls = [
        c
        for c in fake.table.return_value.upsert.call_args_list
        if c.args and c.args[0] and "ratio" in c.args[0][0]
    ]
    assert len(split_upsert_calls) == 1
    assert split_upsert_calls[0].args[0][0]["symbol"] == "005930.KS"
    assert split_upsert_calls[0].args[0][0]["ratio"] == 2.0


@patch("ygworker.jobs.fetch_corporate_data.fetch_splits")
@patch("ygworker.jobs.fetch_corporate_data.fetch_dividends")
def test_fetch_skips_when_no_active_stocks(mock_div, mock_split):
    fake = MagicMock()
    fake.table.return_value.select.return_value.eq.return_value.execute.return_value.data = []
    logger = MagicMock()

    run_fetch_corporate_data(fake, logger)

    mock_div.assert_not_called()
    mock_split.assert_not_called()
    logger.info.assert_called_with(
        "fetch_corporate_data.skip", reason="no_active_stocks"
    )


@patch("ygworker.jobs.fetch_corporate_data.fetch_splits")
@patch("ygworker.jobs.fetch_corporate_data.fetch_dividends")
def test_fetch_continues_on_per_symbol_failure(mock_div, mock_split):
    fake = MagicMock()
    fake.table.return_value.select.return_value.eq.return_value.execute.return_value.data = [
        {"symbol": "AAPL", "currency": "USD"},
        {"symbol": "BAD", "currency": "USD"},
    ]
    mock_div.side_effect = [
        [{"ex_date": date(2026, 8, 15), "amount_per_share": 0.25}],
        RuntimeError("network"),
    ]
    mock_split.side_effect = [[], RuntimeError("network")]
    logger = MagicMock()

    run_fetch_corporate_data(fake, logger, today=date(2026, 5, 11))

    # AAPL 배당은 들어감
    div_calls = [
        c
        for c in fake.table.return_value.upsert.call_args_list
        if c.args and c.args[0] and "amount_per_share" in c.args[0][0]
    ]
    assert any(c.args[0][0]["symbol"] == "AAPL" for c in div_calls)
    logger.warning.assert_called()
