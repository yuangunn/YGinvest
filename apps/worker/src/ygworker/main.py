import logging
import signal
import sys
from typing import Any

import structlog
from apscheduler.schedulers.blocking import BlockingScheduler

from ygworker.config import load_settings
from ygworker.jobs.heartbeat import run_heartbeat
from ygworker.supabase_client import make_client


def _make_logger(level: str) -> Any:
    structlog.configure(
        processors=[
            structlog.processors.add_log_level,
            structlog.processors.TimeStamper(fmt="iso"),
            structlog.processors.JSONRenderer(),
        ],
        wrapper_class=structlog.make_filtering_bound_logger(getattr(logging, level)),
    )
    return structlog.get_logger()


def main() -> None:
    settings = load_settings()
    logger = _make_logger(settings.log_level)
    supabase = make_client(settings)

    logger.info("worker.starting", supabase_url=settings.supabase_url)

    scheduler = BlockingScheduler(timezone="Asia/Seoul")
    scheduler.add_job(
        run_heartbeat,
        trigger="interval",
        seconds=60,
        args=[supabase, logger],
        id="heartbeat",
        replace_existing=True,
        next_run_time=None,  # 즉시 시작은 안 함, 60초 후 첫 실행
    )

    def _shutdown(signum: int, frame: Any) -> None:
        logger.info("worker.stopping", signal=signum)
        scheduler.shutdown(wait=False)
        sys.exit(0)

    signal.signal(signal.SIGINT, _shutdown)
    if hasattr(signal, "SIGTERM"):
        signal.signal(signal.SIGTERM, _shutdown)

    logger.info("worker.scheduler_started")
    # 부팅 직후 1회 즉시 heartbeat (헬스체크용)
    run_heartbeat(supabase, logger)
    scheduler.start()


if __name__ == "__main__":
    main()
