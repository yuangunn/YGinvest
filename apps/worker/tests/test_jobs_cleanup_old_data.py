from unittest.mock import MagicMock

from ygworker.jobs.cleanup_old_data import QUEUE_DONE_STATUSES, run_cleanup_old_data


def test_notification_queue_cleanup_filters_by_status_not_dispatched():
    fake = MagicMock()
    run_cleanup_old_data(fake, MagicMock())

    queue_calls = [c for c in fake.table.call_args_list if c.args == ("notification_queue",)]
    assert queue_calls, "notification_queue 정리가 호출되어야 함"

    delete_chain = fake.table.return_value.delete.return_value
    # 존재하지 않는 dispatched 열은 더 이상 쓰지 않는다
    assert not any(c.args[:1] == ("dispatched",) for c in delete_chain.eq.call_args_list)
    delete_chain.in_.assert_any_call("status", list(QUEUE_DONE_STATUSES))


def test_health_alerts_retention_is_applied():
    fake = MagicMock()
    run_cleanup_old_data(fake, MagicMock())
    assert any(c.args == ("health_alerts",) for c in fake.table.call_args_list)
