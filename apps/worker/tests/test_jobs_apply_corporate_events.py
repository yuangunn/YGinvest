from unittest.mock import MagicMock

from ygworker.jobs.apply_corporate_events import run_apply_corporate_events


def test_apply_unapplied_dividends_and_actions():
    fake = MagicMock()
    div_rows = [{"id": "d1"}, {"id": "d2"}]
    action_rows = [{"id": "a1"}]

    # select chain returns (different .data on consecutive calls)
    select_responses = [
        MagicMock(data=div_rows),
        MagicMock(data=action_rows),
    ]
    select_chain = (
        fake.table.return_value.select.return_value.eq.return_value.lte.return_value.execute
    )
    select_chain.side_effect = select_responses

    fake.rpc.return_value.execute.side_effect = [
        MagicMock(data={"holders": 3, "total_net": 100}),
        MagicMock(data={"holders": 3, "total_net": 200}),
        MagicMock(data={"holders": 2, "orders_adjusted": 1, "orders_cancelled": 0}),
    ]

    logger = MagicMock()
    run_apply_corporate_events(fake, logger)

    rpc_calls = fake.rpc.call_args_list
    assert len(rpc_calls) == 3
    rpc_names = [c.args[0] for c in rpc_calls]
    assert rpc_names.count("apply_dividend") == 2
    assert rpc_names.count("apply_corporate_action") == 1


def test_apply_handles_no_unapplied():
    fake = MagicMock()
    select_chain = (
        fake.table.return_value.select.return_value.eq.return_value.lte.return_value.execute
    )
    select_chain.return_value.data = []
    logger = MagicMock()

    run_apply_corporate_events(fake, logger)

    fake.rpc.assert_not_called()
    logger.info.assert_called_with(
        "apply_corporate_events.done",
        dividends_applied=0,
        actions_applied=0,
        failed=0,
    )


def test_apply_continues_on_per_event_failure():
    fake = MagicMock()
    select_responses = [
        MagicMock(data=[{"id": "d1"}, {"id": "d2"}]),
        MagicMock(data=[]),  # actions 없음
    ]
    select_chain = (
        fake.table.return_value.select.return_value.eq.return_value.lte.return_value.execute
    )
    select_chain.side_effect = select_responses
    fake.rpc.return_value.execute.side_effect = [
        RuntimeError("event_not_found"),  # d1 실패
        MagicMock(data={"holders": 2, "total_net": 50}),  # d2 성공
    ]
    logger = MagicMock()

    run_apply_corporate_events(fake, logger)

    assert fake.rpc.call_count == 2
    logger.warning.assert_called()
