import os
import resource
from datetime import UTC, datetime
from typing import Any


def _fd_stats() -> dict[str, int]:
    """현재 프로세스의 열린 파일 디스크립터 수 + soft limit.

    2026-06-05 장애 원인이 FD 누수(Errno 24: too many open files)였다.
    이 값을 heartbeat마다 기록하면 외부 모니터가 고갈 *전에* 경보할 수 있다.
    """
    try:
        fd_open = len(os.listdir("/proc/self/fd"))
    except OSError:
        fd_open = -1
    try:
        soft, _hard = resource.getrlimit(resource.RLIMIT_NOFILE)
    except (ValueError, OSError):
        soft = -1
    return {"fd_open": fd_open, "fd_limit": soft}


def run_heartbeat(supabase: Any, logger: Any) -> None:
    """Supabase 연결 살아있는지 확인 + worker_heartbeat 테이블에 ts/FD 기록.

    매 60초 cron. ts 기록은 워커 *밖*(GitHub Actions dead-man monitor)에서
    워커 생존을 감지하는 신호다 — heartbeat는 시장 시간과 무관하게 항상 돌므로
    ts가 오래되면 = 워커 다운. meta.fd_* 는 FD 누수 조기 경보용. Plan #48 참조.
    """
    fd = _fd_stats()
    # FD가 soft limit의 80%를 넘으면 로그 경고 (누수 조기 신호).
    if fd["fd_limit"] > 0 and fd["fd_open"] >= fd["fd_limit"] * 0.8:
        logger.warning("heartbeat.fd_high", fd_open=fd["fd_open"], fd_limit=fd["fd_limit"])
    try:
        supabase.table("profiles").select("id").limit(1).execute()
        # 외부 dead-man monitor용 생존 신호. 단일 행(id='worker') upsert.
        supabase.table("worker_heartbeat").upsert(
            {"id": "worker", "ts": datetime.now(UTC).isoformat(), "meta": fd},
            on_conflict="id",
        ).execute()
        logger.info("heartbeat", status="ok", fd_open=fd["fd_open"], fd_limit=fd["fd_limit"])
    except Exception as exc:
        logger.error("heartbeat", status="error", error=str(exc))
