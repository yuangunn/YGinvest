from unittest.mock import MagicMock

from ygworker.jobs.room_lifecycle import run_room_lifecycle


def test_room_lifecycle_calls_transition_rpc():
    fake = MagicMock()
    fake.rpc.return_value.execute.return_value = MagicMock(
        data={"opened": 2, "ended": 1}
    )
    logger = MagicMock()

    run_room_lifecycle(fake, logger)

    fake.rpc.assert_called_with("transition_room_lifecycle", {})
    logger.info.assert_called_with("room_lifecycle.done", opened=2, ended=1)


def test_room_lifecycle_handles_no_changes():
    fake = MagicMock()
    fake.rpc.return_value.execute.return_value = MagicMock(
        data={"opened": 0, "ended": 0}
    )
    logger = MagicMock()

    run_room_lifecycle(fake, logger)

    logger.info.assert_called_with("room_lifecycle.done", opened=0, ended=0)


def test_room_lifecycle_logs_error_on_failure():
    fake = MagicMock()
    fake.rpc.return_value.execute.side_effect = RuntimeError("DB error")
    logger = MagicMock()

    run_room_lifecycle(fake, logger)

    logger.error.assert_called()
