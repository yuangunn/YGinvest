"""Plan #27 C4: 경제 일정 D-1 알림.

매일 오전 08:00 KST 실행 — 내일 일정 중 importance>=2인 이벤트를 모든
사용자(설정 켠 사람)에게 1회 push.
"""
from datetime import datetime, timedelta
from typing import Any
from zoneinfo import ZoneInfo

KST = ZoneInfo("Asia/Seoul")

KIND_ICON = {
    "fomc": "🏦",
    "kr_mpc": "🇰🇷",
    "cpi": "📊",
    "employment": "👷",
    "earnings_szn": "💼",
}


def _tomorrow_kst(now: datetime | None = None):
    now_kst = (now or datetime.now(KST)).astimezone(KST)
    return (now_kst + timedelta(days=1)).date()


def run_notify_economic_events(supabase: Any, logger: Any) -> None:
    # 내일 = KST 기준 now + 1d. event_date 는 KST 날짜라서 UTC 로 계산하면
    # 08:00 KST(= 23:00 UTC 전날) 실행 시 "내일"이 오늘이 되어 당일 이벤트를 알렸다.
    tomorrow = _tomorrow_kst().isoformat()

    rows = (
        supabase.table("economic_events")
        .select("id, event_date, country, kind, title, description_ko, importance")
        .eq("event_date", tomorrow)
        .gte("importance", 2)
        .execute()
        .data
        or []
    )
    if not rows:
        logger.info("notify_economic_events.no_events", date=tomorrow)
        return

    # 알림 받을 사용자: notification_settings.economic_events_enabled=true
    users = (
        supabase.table("notification_settings")
        .select("user_id")
        .eq("economic_events_enabled", True)
        .execute()
        .data
        or []
    )
    if not users:
        logger.info("notify_economic_events.no_subscribers", events=len(rows))
        return

    enqueued = 0
    for u in users:
        uid = u.get("user_id")
        if not uid:
            continue
        for e in rows:
            icon = KIND_ICON.get(e.get("kind", "other"), "📅")
            try:
                supabase.rpc(
                    "enqueue_notification",
                    {
                        "p_user_id": uid,
                        "p_type": "economic_event",
                        "p_title": f"{icon} 내일 경제 일정: {e['title']}",
                        "p_body": e.get("description_ko") or "주요 경제 이벤트",
                        "p_url": "/app/macro/calendar",
                        "p_dedup_key": f"econ:{e['id']}:{uid}",
                    },
                ).execute()
                enqueued += 1
            except Exception as exc:
                logger.warning(
                    "notify_economic_events.failed",
                    user_id=uid,
                    event_id=e.get("id"),
                    error=str(exc),
                )
    logger.info(
        "notify_economic_events.done",
        events=len(rows),
        users=len(users),
        enqueued=enqueued,
    )
