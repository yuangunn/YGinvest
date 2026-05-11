import asyncio
import logging
import signal
from typing import Any

import structlog
import uvicorn
from apscheduler.schedulers.asyncio import AsyncIOScheduler

from ygworker.config import load_settings
from ygworker.jobs.apply_corporate_events import run_apply_corporate_events
from ygworker.jobs.bootstrap_stocks import run_bootstrap_stocks
from ygworker.jobs.fetch_corporate_data import run_fetch_corporate_data
from ygworker.jobs.fetch_daily_bars import run_fetch_daily_bars
from ygworker.jobs.fetch_fx import run_fetch_fx
from ygworker.jobs.fetch_prices import run_fetch_prices
from ygworker.jobs.heartbeat import run_heartbeat
from ygworker.jobs.matching_engine import run_matching_engine
from ygworker.jobs.portfolio_snapshot import run_portfolio_snapshot
from ygworker.jobs.room_lifecycle import run_room_lifecycle
from ygworker.market_hours import is_any_market_open
from ygworker.rpc.app import build_app
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


def _wrap_in_thread(fn, *args):
    """sync 잡을 asyncio 이벤트 루프에서 안전하게 실행."""

    async def runner():
        return await asyncio.to_thread(fn, *args)

    return runner


async def main_async() -> None:
    settings = load_settings()
    logger = _make_logger(settings.log_level)
    supabase = make_client(settings)

    logger.info(
        "worker.starting",
        supabase_url=settings.supabase_url,
        rpc_port=settings.rpc_port,
    )

    # 부팅 시 1회: 종목 마스터 prefetch
    await asyncio.to_thread(run_bootstrap_stocks, supabase, logger)

    scheduler = AsyncIOScheduler(timezone="Asia/Seoul")
    scheduler.add_job(
        _wrap_in_thread(run_heartbeat, supabase, logger),
        trigger="interval",
        seconds=60,
        id="heartbeat",
        replace_existing=True,
    )
    scheduler.add_job(
        _gated_fetch_prices(supabase, logger),
        trigger="interval",
        seconds=60,
        id="fetch_prices",
        replace_existing=True,
    )
    scheduler.add_job(
        _wrap_in_thread(run_fetch_fx, supabase, logger),
        trigger="interval",
        minutes=30,
        id="fetch_fx",
        replace_existing=True,
    )
    scheduler.add_job(
        _wrap_in_thread(run_matching_engine, supabase, logger),
        trigger="interval",
        seconds=60,
        id="matching_engine",
        replace_existing=True,
    )
    # KR 장 마감 후 (16:00 KST). Scheduler는 timezone="Asia/Seoul"이라 hour=16 = KST 16:00.
    scheduler.add_job(
        _wrap_in_thread(run_fetch_daily_bars, supabase, logger),
        trigger="cron",
        hour=16,
        minute=0,
        id="fetch_daily_bars_kr",
        replace_existing=True,
    )
    # US 장 마감 후 (다음날 07:00 KST 안전 마진)
    scheduler.add_job(
        _wrap_in_thread(run_fetch_daily_bars, supabase, logger),
        trigger="cron",
        hour=7,
        minute=0,
        id="fetch_daily_bars_us",
        replace_existing=True,
    )
    # 5분 주기: 모든 active 포트폴리오 가치 스냅샷 (리더보드/차트용)
    scheduler.add_job(
        _wrap_in_thread(run_portfolio_snapshot, supabase, logger),
        trigger="interval",
        minutes=5,
        id="portfolio_snapshot",
        replace_existing=True,
    )
    # 1분 주기: 방 status 전이 (open→active, active→ended + 펜딩 환원/취소)
    scheduler.add_job(
        _wrap_in_thread(run_room_lifecycle, supabase, logger),
        trigger="interval",
        minutes=1,
        id="room_lifecycle",
        replace_existing=True,
    )
    # 매일 06:00 KST: yfinance에서 dividends + splits fetch
    scheduler.add_job(
        _wrap_in_thread(run_fetch_corporate_data, supabase, logger),
        trigger="cron",
        hour=6,
        minute=0,
        id="fetch_corporate_data",
        replace_existing=True,
    )
    # 매일 09:00 KST: ex_date 도달한 dividend/action 적용
    scheduler.add_job(
        _wrap_in_thread(run_apply_corporate_events, supabase, logger),
        trigger="cron",
        hour=9,
        minute=0,
        id="apply_corporate_events",
        replace_existing=True,
    )
    scheduler.start()
    logger.info("worker.scheduler_started")

    # 부팅 직후 한 번 fx 갱신
    # NOTE: run_fetch_fx 내부에서 예외를 catch + log하므로 외부 API 일시 장애여도
    #       워커 부팅이 죽지 않음. 다음 30분 사이클에 자동 재시도.
    await asyncio.to_thread(run_fetch_fx, supabase, logger)

    # stock_bars가 비어있으면 부팅 시 1회 일봉 backfill
    bars_check = supabase.table("stock_bars").select("symbol").limit(1).execute()
    if not bars_check.data:
        logger.info("worker.bootstrap_daily_bars")
        await asyncio.to_thread(run_fetch_daily_bars, supabase, logger)

    # FastAPI 시작
    app = build_app(supabase=supabase, secret=settings.rpc_secret)
    config = uvicorn.Config(
        app,
        host="0.0.0.0",
        port=settings.rpc_port,
        log_config=None,
        lifespan="off",
    )
    server = uvicorn.Server(config)

    # SIGTERM/SIGINT 핸들러
    loop = asyncio.get_running_loop()
    stop_event = asyncio.Event()

    def _stop():
        logger.info("worker.stopping")
        stop_event.set()

    for sig in (signal.SIGINT, getattr(signal, "SIGTERM", signal.SIGINT)):
        try:
            loop.add_signal_handler(sig, _stop)
        except NotImplementedError:
            # Windows에서는 add_signal_handler 미지원 → 그냥 KeyboardInterrupt에 의존
            pass

    server_task = asyncio.create_task(server.serve())
    stop_task = asyncio.create_task(stop_event.wait())

    await asyncio.wait(
        {server_task, stop_task}, return_when=asyncio.FIRST_COMPLETED
    )
    if stop_event.is_set():
        server.should_exit = True
        await server_task
    scheduler.shutdown(wait=False)


def _gated_fetch_prices(supabase: Any, logger: Any):
    async def runner():
        if not is_any_market_open():
            logger.debug("fetch_prices.gated", reason="no_market_open")
            return
        await asyncio.to_thread(run_fetch_prices, supabase, logger)

    return runner


def main() -> None:
    asyncio.run(main_async())


if __name__ == "__main__":
    main()
