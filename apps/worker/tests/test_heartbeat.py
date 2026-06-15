from unittest.mock import MagicMock

from ygworker.jobs.heartbeat import run_heartbeat


def test_heartbeat_logs_with_supabase_reachable():
    fake_client = MagicMock()
    execute_mock = (
        fake_client.table.return_value.select.return_value.limit.return_value.execute
    )
    execute_mock.return_value.data = []
    logger = MagicMock()

    run_heartbeat(fake_client, logger)

    logger.info.assert_called_once()
    args, kwargs = logger.info.call_args
    assert args[0] == "heartbeat"
    assert kwargs["status"] == "ok"


def test_heartbeat_writes_worker_heartbeat_row():
    """Plan #48: 외부 dead-man monitor용 worker_heartbeat upsert 검증."""
    fake_client = MagicMock()
    select_exec = fake_client.table.return_value.select.return_value.limit.return_value.execute
    select_exec.return_value.data = []
    logger = MagicMock()

    run_heartbeat(fake_client, logger)

    # worker_heartbeat 테이블에 id='worker' 단일 행 upsert 됐는지.
    fake_client.table.assert_any_call("worker_heartbeat")
    upsert_mock = fake_client.table.return_value.upsert
    upsert_mock.assert_called_once()
    args, kwargs = upsert_mock.call_args
    assert args[0]["id"] == "worker"
    assert "ts" in args[0]
    assert kwargs["on_conflict"] == "id"


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
