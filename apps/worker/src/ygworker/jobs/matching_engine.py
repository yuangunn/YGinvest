from datetime import UTC, datetime
from typing import Any


def run_matching_engine(supabase: Any, logger: Any) -> None:
    """Pending 지정가 주문을 한 번씩 match_limit_order로 처리 + 만료 주문 정리.

    1) expires_at < now() 인 pending 주문 → expire_pending_order로 만료 처리 + 잔고 환원
    2) 남은 pending 주문에 match_limit_order 호출 — 가격 도달 시 체결
    """
    now_iso = datetime.now(UTC).isoformat()

    # 1) 만료된 주문 자동 취소 (잔고 환원)
    expired = (
        supabase.table("orders")
        .select("id")
        .eq("status", "pending")
        .lt("expires_at", now_iso)
        .execute()
        .data
    )
    expired_count = 0
    for row in expired or []:
        try:
            supabase.rpc("expire_pending_order", {"p_order_id": row["id"]}).execute()
            expired_count += 1
        except Exception as exc:
            logger.error(
                "matching_engine.expire_failed", order_id=row["id"], error=str(exc)
            )

    # 2) 매칭 시도
    rows = (
        supabase.table("orders")
        .select("id, symbol")
        .eq("status", "pending")
        .execute()
        .data
    )
    if not rows:
        if expired_count == 0:
            logger.info("matching_engine.skip", reason="no_pending")
        else:
            logger.info(
                "matching_engine.done",
                matched=0,
                skipped=0,
                errored=0,
                expired=expired_count,
            )
        return

    logger.info("matching_engine.start", count=len(rows), expired=expired_count)
    matched, skipped, errored = 0, 0, 0

    for row in rows:
        order_id = row["id"]
        try:
            result = (
                supabase.rpc("match_limit_order", {"p_order_id": order_id}).execute()
            )
            data = result.data if hasattr(result, "data") else result
            if data and data.get("matched"):
                matched += 1
            else:
                skipped += 1
        except Exception as exc:
            errored += 1
            logger.error(
                "matching_engine.rpc_failed", order_id=order_id, error=str(exc)
            )

    logger.info(
        "matching_engine.done",
        matched=matched,
        skipped=skipped,
        errored=errored,
        expired=expired_count,
    )
