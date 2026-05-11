from datetime import UTC, datetime, timedelta
from unittest.mock import MagicMock

from ygworker.jobs.notify_room_lifecycle import run_notify_room_lifecycle


def test_enqueues_for_rooms_starting_in_24h():
    fake = MagicMock()
    in_12h = (datetime.now(UTC) + timedelta(hours=12)).isoformat()

    rooms_resp = MagicMock(
        data=[
            {
                "id": "r1",
                "name": "Test Room",
                "starts_at": in_12h,
                "ends_at": None,
                "room_members": [{"user_id": "u1"}, {"user_id": "u2"}],
            },
        ]
    )
    # 두 번 호출 — starting/ending 별도 쿼리
    chain = (
        fake.table.return_value.select.return_value.eq.return_value.lte.return_value.gte.return_value.execute
    )
    chain.side_effect = [
        rooms_resp,
        MagicMock(data=[]),  # ending side empty
    ]
    logger = MagicMock()

    run_notify_room_lifecycle(fake, logger)

    rpc_calls = fake.rpc.call_args_list
    assert len(rpc_calls) == 2
    user_ids = sorted([c.args[1]["p_user_id"] for c in rpc_calls])
    assert user_ids == ["u1", "u2"]
    assert all(c.args[1]["p_type"] == "room_starting" for c in rpc_calls)


def test_enqueues_for_rooms_ending_in_24h():
    fake = MagicMock()
    in_6h = (datetime.now(UTC) + timedelta(hours=6)).isoformat()

    rooms_resp = MagicMock(
        data=[
            {
                "id": "r2",
                "name": "Ending",
                "starts_at": (
                    datetime.now(UTC) - timedelta(days=7)
                ).isoformat(),
                "ends_at": in_6h,
                "room_members": [{"user_id": "u3"}],
            },
        ]
    )
    chain = (
        fake.table.return_value.select.return_value.eq.return_value.lte.return_value.gte.return_value.execute
    )
    chain.side_effect = [
        MagicMock(data=[]),  # starting 없음
        rooms_resp,
    ]
    logger = MagicMock()

    run_notify_room_lifecycle(fake, logger)

    rpc_calls = fake.rpc.call_args_list
    assert len(rpc_calls) == 1
    assert rpc_calls[0].args[1]["p_type"] == "room_ending"
    assert rpc_calls[0].args[1]["p_dedup_key"] == "room_ending:r2:u3"
