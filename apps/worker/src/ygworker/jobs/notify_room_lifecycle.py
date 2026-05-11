"""1시간 주기. 24시간 내 시작 또는 종료할 방을 찾아 멤버별 enqueue.

starts_at: status='open'인 방만 (active는 이미 시작됨)
ends_at: status='active' AND ends_at IS NOT NULL인 방
dedup_key는 user별로 (room×user) 1회씩 — 늦게 합류하거나 종료 시 모두 받음.
"""

from datetime import UTC, datetime, timedelta
from typing import Any


def run_notify_room_lifecycle(supabase: Any, logger: Any) -> None:
    now = datetime.now(UTC)
    now_iso = now.isoformat()
    in_24h_iso = (now + timedelta(hours=24)).isoformat()

    enqueued = 0

    # 1) 곧 시작 (open + starts_at in next 24h)
    starting = (
        supabase.table("rooms")
        .select("id, name, starts_at, ends_at, room_members(user_id)")
        .eq("status", "open")
        .lte("starts_at", in_24h_iso)
        .gte("starts_at", now_iso)
        .execute()
        .data
    )
    for room in starting or []:
        for m in room.get("room_members") or []:
            uid = m.get("user_id")
            if not uid:
                continue
            try:
                supabase.rpc(
                    "enqueue_notification",
                    {
                        "p_user_id": uid,
                        "p_type": "room_starting",
                        "p_title": f"방 시작 임박: {room['name']}",
                        "p_body": "24시간 내 시작",
                        "p_url": f"/app/rooms/{room['id']}",
                        "p_dedup_key": f"room_starting:{room['id']}:{uid}",
                    },
                ).execute()
                enqueued += 1
            except Exception as exc:
                logger.warning(
                    "notify_room_lifecycle.start_failed",
                    room_id=room["id"],
                    error=str(exc),
                )

    # 2) 곧 종료 (active + ends_at in next 24h)
    ending = (
        supabase.table("rooms")
        .select("id, name, starts_at, ends_at, room_members(user_id)")
        .eq("status", "active")
        .lte("ends_at", in_24h_iso)
        .gte("ends_at", now_iso)
        .execute()
        .data
    )
    for room in ending or []:
        for m in room.get("room_members") or []:
            uid = m.get("user_id")
            if not uid:
                continue
            try:
                supabase.rpc(
                    "enqueue_notification",
                    {
                        "p_user_id": uid,
                        "p_type": "room_ending",
                        "p_title": f"방 종료 임박: {room['name']}",
                        "p_body": "24시간 내 종료",
                        "p_url": f"/app/rooms/{room['id']}",
                        "p_dedup_key": f"room_ending:{room['id']}:{uid}",
                    },
                ).execute()
                enqueued += 1
            except Exception as exc:
                logger.warning(
                    "notify_room_lifecycle.end_failed",
                    room_id=room["id"],
                    error=str(exc),
                )

    logger.info("notify_room_lifecycle.done", enqueued=enqueued)
