"""1시간 주기. expires_at이 next 24h 안인 pending 주문을 찾아 enqueue.

dedup_key='order_expiring:<order_id>'로 1회만 enqueue됨 (notification_queue
unique index). 그래서 매시간 호출돼도 같은 주문 알림은 한 번만 발송.
"""

from datetime import UTC, datetime, timedelta
from typing import Any


def run_notify_expiring_orders(supabase: Any, logger: Any) -> None:
    now = datetime.now(UTC)
    now_iso = now.isoformat()
    in_24h_iso = (now + timedelta(hours=24)).isoformat()

    orders = (
        supabase.table("orders")
        .select("id, symbol, expires_at, portfolios(user_id)")
        .eq("status", "pending")
        .lte("expires_at", in_24h_iso)
        .gte("expires_at", now_iso)
        .execute()
        .data
    )

    enqueued = 0
    for o in orders or []:
        pf = o.get("portfolios")
        if isinstance(pf, list):
            pf = pf[0] if pf else None
        if not pf or not pf.get("user_id"):
            continue
        try:
            supabase.rpc(
                "enqueue_notification",
                {
                    "p_user_id": pf["user_id"],
                    "p_type": "order_expiring_soon",
                    "p_title": f"{o['symbol']} 지정가 주문 곧 만료",
                    "p_body": "24시간 내 만료 — 취소하거나 가격 조정하세요",
                    "p_url": "/app/portfolio/orders",
                    "p_dedup_key": f"order_expiring:{o['id']}",
                },
            ).execute()
            enqueued += 1
        except Exception as exc:
            logger.warning(
                "notify_expiring_orders.failed",
                order_id=o["id"],
                error=str(exc),
            )

    logger.info("notify_expiring_orders.done", enqueued=enqueued)
