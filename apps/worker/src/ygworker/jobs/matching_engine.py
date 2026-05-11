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
                # 체결 알림 enqueue (실패해도 매칭 결과는 보존)
                try:
                    order_detail = (
                        supabase.table("orders")
                        .select("symbol, portfolios(user_id)")
                        .eq("id", order_id)
                        .single()
                        .execute()
                        .data
                    )
                    pf = order_detail.get("portfolios")
                    if isinstance(pf, list):
                        pf = pf[0] if pf else None
                    if pf and pf.get("user_id"):
                        supabase.rpc(
                            "enqueue_notification",
                            {
                                "p_user_id": pf["user_id"],
                                "p_type": "order_filled",
                                "p_title": f"{order_detail['symbol']} 체결됨",
                                "p_body": "지정가 주문이 체결되었습니다",
                                "p_url": "/app/portfolio/orders",
                                "p_dedup_key": f"order_filled:{order_id}",
                            },
                        ).execute()
                except Exception as enq_exc:
                    logger.warning(
                        "matching_engine.enqueue_failed",
                        order_id=order_id,
                        error=str(enq_exc),
                    )
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
