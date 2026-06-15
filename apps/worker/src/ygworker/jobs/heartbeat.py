from datetime import UTC, datetime
from typing import Any


def run_heartbeat(supabase: Any, logger: Any) -> None:
    """Supabase 연결 살아있는지 확인 + worker_heartbeat 테이블에 ts 기록.

    매 60초 cron. ts 기록은 워커 *밖*(GitHub Actions dead-man monitor)에서
    워커 생존을 감지하는 신호다 — heartbeat는 시장 시간과 무관하게 항상 돌므로
    ts가 오래되면 = 워커 다운. Plan #48 참조.
    """
    try:
        supabase.table("profiles").select("id").limit(1).execute()
        # 외부 dead-man monitor용 생존 신호. 단일 행(id='worker') upsert.
        supabase.table("worker_heartbeat").upsert(
            {"id": "worker", "ts": datetime.now(UTC).isoformat()},
            on_conflict="id",
        ).execute()
        logger.info("heartbeat", status="ok")
    except Exception as exc:
        logger.error("heartbeat", status="error", error=str(exc))
