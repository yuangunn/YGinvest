"""ex_date 도달한 dividend_events + corporate_actions를 atomically 적용.

PG functions (apply_dividend, apply_corporate_action)이 모든 holders/orders
변경을 single transaction으로 처리. 워커는 단순 dispatcher.

매일 09:00 KST cron (KR 장 시작 직후, US 장 마감 직후).
"""

from datetime import date
from typing import Any


def run_apply_corporate_events(
    supabase: Any, logger: Any, today: date | None = None
) -> None:
    if today is None:
        today = date.today()
    today_iso = today.isoformat()

    div_applied = 0
    act_applied = 0
    failed = 0

    # 1) 미적용 배당 events
    events = (
        supabase.table("dividend_events")
        .select("id")
        .eq("applied", False)
        .lte("ex_date", today_iso)
        .execute()
        .data
    )
    for ev in events or []:
        try:
            supabase.rpc("apply_dividend", {"p_event_id": ev["id"]}).execute()
            div_applied += 1
        except Exception as exc:
            failed += 1
            logger.warning(
                "apply_corporate_events.dividend_failed",
                event_id=ev["id"],
                error=str(exc),
            )

    # 2) 미적용 corporate actions
    actions = (
        supabase.table("corporate_actions")
        .select("id")
        .eq("applied", False)
        .lte("ex_date", today_iso)
        .execute()
        .data
    )
    for act in actions or []:
        try:
            supabase.rpc(
                "apply_corporate_action", {"p_action_id": act["id"]}
            ).execute()
            act_applied += 1
        except Exception as exc:
            failed += 1
            logger.warning(
                "apply_corporate_events.action_failed",
                action_id=act["id"],
                error=str(exc),
            )

    logger.info(
        "apply_corporate_events.done",
        dividends_applied=div_applied,
        actions_applied=act_applied,
        failed=failed,
    )
