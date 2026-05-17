"""Plan #46: leaderboard_rankings materialized view 매일 04:00 KST refresh.

opt-in 사용자의 종합/30일/Sharpe 수익률을 미리 계산해서 빠른 조회.
"""

from typing import Any


def run_refresh_leaderboard(supabase: Any, logger: Any) -> None:
    """leaderboard_rankings MV refresh.

    매일 portfolio_snapshot 직후 (04:00 KST). concurrent refresh라 락 없이 진행.
    """
    try:
        supabase.rpc("refresh_leaderboard_rankings", {}).execute()
        logger.info("refresh_leaderboard.done")
    except Exception as exc:
        logger.error("refresh_leaderboard.failed", error=str(exc))
