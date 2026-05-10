from unittest.mock import MagicMock

from ygworker.jobs.heartbeat import run_heartbeat


def test_heartbeat_logs_with_supabase_reachable():
    fake_client = MagicMock()
    fake_client.table.return_value.select.return_value.limit.return_value.execute.return_value.data = []
    logger = MagicMock()

    run_heartbeat(fake_client, logger)

    logger.info.assert_called_once()
    args, kwargs = logger.info.call_args
    assert args[0] == "heartbeat"
    assert kwargs["status"] == "ok"


def test_heartbeat_logs_error_when_supabase_unreachable():
    fake_client = MagicMock()
    fake_client.table.return_value.select.return_value.limit.return_value.execute.side_effect = (
        RuntimeError("connection refused")
    )
    logger = MagicMock()

    run_heartbeat(fake_client, logger)

    logger.error.assert_called_once()
    args, kwargs = logger.error.call_args
    assert args[0] == "heartbeat"
    assert kwargs["status"] == "error"
    assert "connection refused" in kwargs["error"]
