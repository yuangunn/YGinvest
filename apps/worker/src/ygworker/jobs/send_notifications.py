"""1분 주기. notification_queue의 pending 행을 dispatch.

각 사용자의 모든 push_subscriptions에 발송. 410 Gone이면 구독 삭제.
모든 발송이 실패해도 alert 마킹은 `failed` (재발송하지 않음).
"""

from datetime import UTC, datetime
from typing import Any

from ygworker.data_sources.notify import NotificationGone, send_one


def run_send_notifications(
    supabase: Any,
    logger: Any,
    *,
    vapid_private_key: str,
    vapid_subject: str,
    batch_size: int = 100,
) -> None:
    pending = (
        supabase.table("notification_queue")
        .select("id, user_id, title, body, url")
        .eq("status", "pending")
        .order("created_at")
        .limit(batch_size)
        .execute()
        .data
    )
    if not pending:
        logger.info("send_notifications.skip", reason="no_pending")
        return

    logger.info("send_notifications.start", count=len(pending))
    vapid_claims = {"sub": vapid_subject}
    sent_count = 0
    no_sub_count = 0
    failed_count = 0

    for n in pending:
        user_id = n["user_id"]
        subs = (
            supabase.table("push_subscriptions")
            .select("id, endpoint, p256dh, auth")
            .eq("user_id", user_id)
            .execute()
            .data
        )
        if not subs:
            supabase.table("notification_queue").update(
                {
                    "status": "no_subscription",
                    "sent_at": datetime.now(UTC).isoformat(),
                }
            ).eq("id", n["id"]).execute()
            no_sub_count += 1
            continue

        payload = {"title": n["title"], "body": n["body"], "url": n.get("url")}
        any_success = False
        for sub in subs:
            try:
                send_one(
                    sub,
                    payload,
                    vapid_private_key=vapid_private_key,
                    vapid_claims=vapid_claims,
                )
                any_success = True
            except NotificationGone:
                supabase.table("push_subscriptions").delete().eq(
                    "id", sub["id"]
                ).execute()
                logger.info(
                    "send_notifications.subscription_gone", sub_id=sub["id"]
                )
            except Exception as exc:
                logger.warning(
                    "send_notifications.send_failed",
                    sub_id=sub["id"],
                    error=str(exc),
                )

        final_status = "sent" if any_success else "failed"
        supabase.table("notification_queue").update(
            {"status": final_status, "sent_at": datetime.now(UTC).isoformat()}
        ).eq("id", n["id"]).execute()
        if any_success:
            sent_count += 1
        else:
            failed_count += 1

    logger.info(
        "send_notifications.done",
        sent=sent_count,
        no_subscription=no_sub_count,
        failed=failed_count,
    )
