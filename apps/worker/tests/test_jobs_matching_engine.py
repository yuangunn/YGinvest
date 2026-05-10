from unittest.mock import MagicMock

from ygworker.jobs.matching_engine import run_matching_engine


def _pending_order(id_: str, symbol: str = "AAPL"):
    return {"id": id_, "symbol": symbol}


def test_matching_engine_calls_match_for_each_pending():
    fake = MagicMock()
    # First select: expired query (lt expires_at) returns []
    expired_result = MagicMock()
    expired_result.data = []
    # Second select: status=pending returns 2 orders
    pending_result = MagicMock()
    pending_result.data = [
        _pending_order("o1", "AAPL"),
        _pending_order("o2", "005930.KS"),
    ]
    # Mock chain: first .lt() call returns expired_result, second .execute() returns pending_result
    select_chain = fake.table.return_value.select.return_value.eq.return_value
    select_chain.lt.return_value.execute.return_value = expired_result
    select_chain.execute.return_value = pending_result

    fake.rpc.return_value.execute.side_effect = [
        MagicMock(data={"matched": True, "price": 158.5}),
        MagicMock(data={"matched": False, "reason": "price_not_reached"}),
    ]
    logger = MagicMock()

    run_matching_engine(fake, logger)

    rpc_calls = fake.rpc.call_args_list
    assert len(rpc_calls) == 2
    # Each call should pass match_limit_order with order_id
    for call in rpc_calls:
        assert call.args[0] == "match_limit_order"
        assert call.args[1] == {"p_order_id": "o1"} or call.args[1] == {"p_order_id": "o2"}


def test_matching_engine_handles_no_pending():
    fake = MagicMock()
    select_chain = fake.table.return_value.select.return_value.eq.return_value
    # Both expired and pending are empty
    expired_result = MagicMock(data=[])
    pending_result = MagicMock(data=[])
    select_chain.lt.return_value.execute.return_value = expired_result
    select_chain.execute.return_value = pending_result
    logger = MagicMock()

    run_matching_engine(fake, logger)

    fake.rpc.assert_not_called()
    logger.info.assert_called_with("matching_engine.skip", reason="no_pending")


def test_matching_engine_continues_on_rpc_error():
    fake = MagicMock()
    select_chain = fake.table.return_value.select.return_value.eq.return_value
    expired_result = MagicMock(data=[])
    pending_result = MagicMock(data=[_pending_order("o1"), _pending_order("o2")])
    select_chain.lt.return_value.execute.return_value = expired_result
    select_chain.execute.return_value = pending_result

    fake.rpc.return_value.execute.side_effect = [
        RuntimeError("DB connection lost"),
        MagicMock(data={"matched": True}),
    ]
    logger = MagicMock()

    run_matching_engine(fake, logger)

    # Both orders attempted (errors don't stop the loop)
    assert fake.rpc.call_count == 2
    logger.error.assert_called()


def test_matching_engine_expires_old_orders():
    fake = MagicMock()
    select_chain = fake.table.return_value.select.return_value.eq.return_value
    # 1 expired order
    expired_result = MagicMock(data=[{"id": "expired-1"}])
    pending_result = MagicMock(data=[])
    select_chain.lt.return_value.execute.return_value = expired_result
    select_chain.execute.return_value = pending_result

    fake.rpc.return_value.execute.return_value = MagicMock(data={"expired": True})
    logger = MagicMock()

    run_matching_engine(fake, logger)

    # Should call expire_pending_order on the expired one
    rpc_calls = fake.rpc.call_args_list
    assert len(rpc_calls) == 1
    assert rpc_calls[0].args[0] == "expire_pending_order"
    assert rpc_calls[0].args[1] == {"p_order_id": "expired-1"}
