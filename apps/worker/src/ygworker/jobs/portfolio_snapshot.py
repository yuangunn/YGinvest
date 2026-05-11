from datetime import UTC, datetime
from typing import Any


def run_portfolio_snapshot(supabase: Any, logger: Any) -> None:
    """5분 주기. 모든 active portfolio의 가치 계산 + portfolio_snapshots에 기록.

    글로벌(room_id=NULL) portfolio도 status='active'로 시작되므로 함께 포함됨.
    방 portfolio는 transition_room_lifecycle이 방 종료 시 status='ended'로
    cascade하므로 자연스럽게 스냅샷에서 제외.
    """
    portfolios = (
        supabase.table("portfolios")
        .select("id")
        .eq("status", "active")
        .execute()
        .data
    )
    if not portfolios:
        logger.info("portfolio_snapshot.skip", reason="no_active_portfolios")
        return

    logger.info("portfolio_snapshot.start", count=len(portfolios))
    now_iso = datetime.now(UTC).isoformat()
    rows: list[dict] = []
    failed = 0

    for p in portfolios:
        try:
            result = supabase.rpc(
                "compute_portfolio_value", {"p_portfolio_id": p["id"]}
            ).execute()
            data = result.data if hasattr(result, "data") else result
            rows.append(
                {
                    "portfolio_id": p["id"],
                    "ts": now_iso,
                    "total_value_krw": data["total_value_krw"],
                    "return_pct": data["return_pct"],
                }
            )
        except Exception as exc:
            failed += 1
            logger.error(
                "portfolio_snapshot.compute_failed",
                portfolio_id=p["id"],
                error=str(exc),
            )

    if rows:
        try:
            supabase.table("portfolio_snapshots").insert(rows).execute()
        except Exception as exc:
            logger.error("portfolio_snapshot.insert_failed", error=str(exc))
            return

    logger.info("portfolio_snapshot.done", inserted=len(rows), failed=failed)
