from typing import Any


def run_heartbeat(supabase: Any, logger: Any) -> None:
    """Supabase 연결 살아있는지만 확인. profiles 테이블 1행 SELECT."""
    try:
        supabase.table("profiles").select("id").limit(1).execute()
        logger.info("heartbeat", status="ok")
    except Exception as exc:
        logger.error("heartbeat", status="error", error=str(exc))
