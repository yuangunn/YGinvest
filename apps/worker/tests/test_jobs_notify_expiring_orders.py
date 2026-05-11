from datetime import UTC, datetime, timedelta
from unittest.mock import MagicMock

from ygworker.jobs.notify_expiring_orders import run_notify_expiring_orders


def test_enqueues_for_orders_expiring_in_next_24h():
    fake = MagicMock()
    now = datetime.now(UTC)
    in_12h = (now + timedelta(hours=12)).isoformat()

    chain = (
        fake.table.return_value.select.return_value.eq.return_value.lte.return_value.gte.return_value.execute
    )
    chain.return_value.data = [
        {
            "id": "o1",
            "symbol": "AAPL",
            "expires_at": in_12h,
            "portfolios": {"user_id": "u1"},
        },
    ]
    logger = MagicMock()
    run_notify_expiring_orders(fake, logger)

    rpc_calls = fake.rpc.call_args_list
    assert len(rpc_calls) == 1
    assert rpc_calls[0].args[0] == "enqueue_notification"
    params = rpc_calls[0].args[1]
    assert params["p_user_id"] == "u1"
    assert params["p_type"] == "order_expiring_soon"
    assert "AAPL" in params["p_title"]
    assert params["p_dedup_key"] == "order_expiring:o1"


def test_skips_when_no_orders_expiring():
    fake = MagicMock()
    chain = (
        fake.table.return_value.select.return_value.eq.return_value.lte.return_value.gte.return_value.execute
    )
    chain.return_value.data = []
    logger = MagicMock()

    run_notify_expiring_orders(fake, logger)

    fake.rpc.assert_not_called()
    logger.info.assert_called_with("notify_expiring_orders.done", enqueued=0)
