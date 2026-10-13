from unittest.mock import MagicMock

from ygworker.jobs.check_price_alerts import run_check_price_alerts


def _fake(alerts, stocks):
    fake = MagicMock()

    def table(name):
        t = MagicMock()
        if name == "price_alerts":
            t.select.return_value.eq.return_value.execute.return_value.data = alerts
        elif name == "stocks":
            t.select.return_value.in_.return_value.execute.return_value.data = stocks
        return t

    fake.table.side_effect = table
    return fake


def test_enqueues_before_marking_triggered():
    alerts = [
        {"id": "a1", "user_id": "u1", "symbol": "AAPL", "condition": "above", "trigger_price": 100}
    ]
    stocks = [{"symbol": "AAPL", "last_price": 101, "name": "Apple", "currency": "USD"}]
    fake = _fake(alerts, stocks)
    order: list[str] = []
    fake.rpc.side_effect = lambda *a, **k: order.append("rpc") or MagicMock()

    # price_alerts.update 호출 순서를 기록
    pa_table = fake.table("price_alerts")
    pa_table.update.side_effect = lambda *a, **k: order.append("update") or MagicMock()
    fake.table.side_effect = lambda name: pa_table if name == "price_alerts" else _fake(
        alerts, stocks
    ).table(name)

    run_check_price_alerts(fake, MagicMock())

    assert order == ["rpc", "update"]
    params = fake.rpc.call_args.args[1]
    assert params["p_type"] == "price_alert"
    assert params["p_dedup_key"] == "price_alert:a1"


def test_enqueue_failure_leaves_alert_active():
    alerts = [
        {"id": "a1", "user_id": "u1", "symbol": "AAPL", "condition": "below", "trigger_price": 100}
    ]
    stocks = [{"symbol": "AAPL", "last_price": 90, "name": "Apple", "currency": "USD"}]
    fake = _fake(alerts, stocks)
    fake.rpc.return_value.execute.side_effect = RuntimeError("check constraint")
    pa_table = fake.table("price_alerts")
    fake.table.side_effect = lambda name: pa_table if name == "price_alerts" else _fake(
        alerts, stocks
    ).table(name)
    logger = MagicMock()

    run_check_price_alerts(fake, logger)

    pa_table.update.assert_not_called()
    logger.warning.assert_called_once()
    assert logger.warning.call_args.args[0] == "check_price_alerts.notify_failed"


def test_no_hit_does_nothing():
    alerts = [
        {"id": "a1", "user_id": "u1", "symbol": "AAPL", "condition": "above", "trigger_price": 100}
    ]
    stocks = [{"symbol": "AAPL", "last_price": 99, "name": "Apple", "currency": "USD"}]
    fake = _fake(alerts, stocks)
    run_check_price_alerts(fake, MagicMock())
    fake.rpc.assert_not_called()
