from datetime import UTC, date, datetime
from unittest.mock import MagicMock

from ygworker.jobs.notify_economic_events import _tomorrow_kst, run_notify_economic_events


def test_tomorrow_is_computed_in_kst():
    # 2026-10-10 23:30 UTC = 2026-10-11 08:30 KST → 내일은 10-12 (UTC 기준이면 10-11)
    now = datetime(2026, 10, 10, 23, 30, tzinfo=UTC)
    assert _tomorrow_kst(now) == date(2026, 10, 12)


def test_enqueues_economic_event_for_each_subscriber():
    fake = MagicMock()

    def table(name):
        t = MagicMock()
        if name == "economic_events":
            t.select.return_value.eq.return_value.gte.return_value.execute.return_value.data = [
                {"id": "e1", "kind": "fomc", "title": "FOMC", "description_ko": "금리 결정",
                 "importance": 3}
            ]
        elif name == "notification_settings":
            t.select.return_value.eq.return_value.execute.return_value.data = [
                {"user_id": "u1"},
                {"user_id": "u2"},
            ]
        return t

    fake.table.side_effect = table
    run_notify_economic_events(fake, MagicMock())

    calls = fake.rpc.call_args_list
    assert len(calls) == 2
    assert {c.args[1]["p_user_id"] for c in calls} == {"u1", "u2"}
    assert all(c.args[1]["p_type"] == "economic_event" for c in calls)
    assert calls[0].args[1]["p_dedup_key"] == "econ:e1:u1"
