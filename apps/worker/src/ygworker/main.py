import asyncio
import logging
import signal
from typing import Any

import structlog
import uvicorn
from apscheduler.schedulers.asyncio import AsyncIOScheduler

from ygworker.config import load_settings
from ygworker.jobs.apply_corporate_events import run_apply_corporate_events
from ygworker.jobs.bootstrap_etfs import run_bootstrap_etfs
from ygworker.jobs.bootstrap_stocks import run_bootstrap_stocks
from ygworker.jobs.check_price_alerts import run_check_price_alerts
from ygworker.jobs.cleanup_old_data import run_cleanup_old_data
from ygworker.jobs.compute_recommendations import run_compute_recommendations
from ygworker.jobs.enrich_etfs import run_enrich_etfs
from ygworker.jobs.enrich_stock_info import run_enrich_stock_info
from ygworker.jobs.fetch_real_estate_index import run_fetch_real_estate_index
from ygworker.jobs.fetch_corporate_data import run_fetch_corporate_data
from ygworker.jobs.fetch_daily_bars import run_fetch_daily_bars
from ygworker.jobs.fetch_earnings import run_fetch_earnings
from ygworker.jobs.fetch_fx import run_fetch_fx
from ygworker.jobs.fetch_macro_indicators import run_fetch_macro_indicators
from ygworker.jobs.fetch_prices import run_fetch_prices
from ygworker.jobs.heartbeat import run_heartbeat
from ygworker.jobs.matching_engine import run_matching_engine
from ygworker.jobs.notify_economic_events import run_notify_economic_events
from ygworker.jobs.notify_expiring_orders import run_notify_expiring_orders
from ygworker.jobs.notify_room_lifecycle import run_notify_room_lifecycle
from ygworker.jobs.portfolio_snapshot import run_portfolio_snapshot
from ygworker.jobs.room_lifecycle import run_room_lifecycle
from ygworker.jobs.send_notifications import run_send_notifications
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


def _wrap_in_thread(fn, *args, **kwargs):
    """sync 잡을 asyncio 이벤트 루프에서 안전하게 실행."""

    async def runner():
        return await asyncio.to_thread(fn, *args, **kwargs)

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
    # Plan #32: 부팅 시 1회 — ETF 마스터 prefetch (큐레이션 50 + KR 자동 상위)
    await asyncio.to_thread(run_bootstrap_etfs, supabase, logger)

    scheduler = AsyncIOScheduler(timezone="Asia/Seoul")
    scheduler.add_job(
        _wrap_in_thread(run_heartbeat, supabase, logger),
        trigger="interval",
        seconds=60,
        id="heartbeat",
        replace_existing=True,
    )
    # Plan #23: fetch_prices를 1분 → 5분으로 늘림 (Railway 비용/리소스 절감).
    # 가격이 분 단위로 결정적이지 않은 시뮬이라 5분 갱신으로 충분.
    scheduler.add_job(
        _gated_fetch_prices(supabase, logger),
        trigger="interval",
        minutes=5,
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
    # Plan #27: 매칭 엔진 1분 → 2분 (시뮬레이션이라 1분 결정성 불필요).
    scheduler.add_job(
        _wrap_in_thread(run_matching_engine, supabase, logger),
        trigger="interval",
        minutes=2,
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
    # Plan #27: 방 status 전이 — 1분 → 5분 (시뮬이라 즉시성 불필요)
    scheduler.add_job(
        _wrap_in_thread(run_room_lifecycle, supabase, logger),
        trigger="interval",
        minutes=5,
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
    # Plan #22 hotfix — 매일 05:30 KST: sector/PER/52w 갱신 (장 시작 전)
    scheduler.add_job(
        _wrap_in_thread(run_enrich_stock_info, supabase, logger),
        trigger="cron",
        hour=5,
        minute=30,
        id="enrich_stock_info",
        replace_existing=True,
    )
    # Plan #32: 매일 05:45 KST — ETF 메타 (운용보수/AUM/holdings) 갱신
    scheduler.add_job(
        _wrap_in_thread(run_enrich_etfs, supabase, logger),
        trigger="cron",
        hour=5,
        minute=45,
        id="enrich_etfs",
        replace_existing=True,
    )
    # Plan #32: 매일 02:30 KST — KR ETF 거래량 상위 자동 수집 (cleanup 후 → enrich 전)
    scheduler.add_job(
        _wrap_in_thread(run_bootstrap_etfs, supabase, logger),
        trigger="cron",
        hour=2,
        minute=30,
        id="bootstrap_etfs_daily",
        replace_existing=True,
    )
    # Plan #33: 매주 월요일 07:00 KST — 한국부동산원 R-ONE 주간지수 fetch (게임용)
    # REB_API_KEY 환경변수 없으면 graceful skip.
    scheduler.add_job(
        _wrap_in_thread(run_fetch_real_estate_index, supabase, logger),
        trigger="cron",
        day_of_week="mon",
        hour=7,
        minute=0,
        id="fetch_real_estate_index_weekly",
        replace_existing=True,
    )
    # Plan #27: 가격 알림 체크 — 1분 → 5분
    scheduler.add_job(
        _wrap_in_thread(run_check_price_alerts, supabase, logger),
        trigger="interval",
        minutes=5,
        id="check_price_alerts",
        replace_existing=True,
    )
    # Plan #24: 실적 발표 일정 fetch — 매일 04:00 KST (top 500 stocks)
    scheduler.add_job(
        _wrap_in_thread(run_fetch_earnings, supabase, logger),
        trigger="cron",
        hour=4,
        minute=0,
        id="fetch_earnings",
        replace_existing=True,
    )
    # Plan #26: 거시경제 지표 fetch — 매일 03:30 KST (시장 종료 후 + earnings 전)
    scheduler.add_job(
        _wrap_in_thread(run_fetch_macro_indicators, supabase, logger),
        trigger="cron",
        hour=3,
        minute=30,
        id="fetch_macro_indicators",
        replace_existing=True,
    )
    # Plan #27 A5: 매일 02:00 KST 오래된 데이터 정리
    scheduler.add_job(
        _wrap_in_thread(run_cleanup_old_data, supabase, logger),
        trigger="cron",
        hour=2,
        minute=0,
        id="cleanup_old_data",
        replace_existing=True,
    )
    # Plan #27 C4: 매일 08:00 KST 내일 경제 일정 push
    scheduler.add_job(
        _wrap_in_thread(run_notify_economic_events, supabase, logger),
        trigger="cron",
        hour=8,
        minute=0,
        id="notify_economic_events",
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
    # Plan #27: notification_queue dispatch — 1분 → 5분
    scheduler.add_job(
        _wrap_in_thread(
            run_send_notifications,
            supabase,
            logger,
            vapid_private_key=settings.vapid_private_key,
            vapid_subject=settings.vapid_subject,
        ),
        trigger="interval",
        minutes=5,
        id="send_notifications",
        replace_existing=True,
    )
    # 1시간 주기: 만료 임박 주문 스캔
    scheduler.add_job(
        _wrap_in_thread(run_notify_expiring_orders, supabase, logger),
        trigger="interval",
        hours=1,
        id="notify_expiring_orders",
        replace_existing=True,
    )
    # 1시간 주기: 방 시작/종료 임박 스캔
    scheduler.add_job(
        _wrap_in_thread(run_notify_room_lifecycle, supabase, logger),
        trigger="interval",
        hours=1,
        id="notify_room_lifecycle",
        replace_existing=True,
    )
    # 1시간 주기: 룰 기반 종목 추천 재계산
    scheduler.add_job(
        _wrap_in_thread(run_compute_recommendations, supabase, logger),
        trigger="interval",
        hours=1,
        id="compute_recommendations",
        replace_existing=True,
    )
    scheduler.start()
    logger.info("worker.scheduler_started")

    # 부팅 직후 한 번 fx 갱신
    # NOTE: run_fetch_fx 내부에서 예외를 catch + log하므로 외부 API 일시 장애여도
    #       워커 부팅이 죽지 않음. 다음 30분 사이클에 자동 재시도.
    await asyncio.to_thread(run_fetch_fx, supabase, logger)

    # 부팅 시 일봉 backfill — US가 있어도 KR이 없으면 fetch 실행.
    # Plan #4.5 FDR `.KS`/`.KQ` suffix 버그로 prod에 KR bars가 누락된 환경 보호.
    us_bars = (
        supabase.table("stock_bars")
        .select("symbol")
        .not_.like("symbol", "%.KS")
        .not_.like("symbol", "%.KQ")
        .limit(1)
        .execute()
    )
    kr_bars = (
        supabase.table("stock_bars")
        .select("symbol")
        .like("symbol", "%.KS")
        .limit(1)
        .execute()
    )
    if not us_bars.data or not kr_bars.data:
        logger.info(
            "worker.bootstrap_daily_bars",
            us_missing=not us_bars.data,
            kr_missing=not kr_bars.data,
        )
        await asyncio.to_thread(run_fetch_daily_bars, supabase, logger)

    # 부팅 시 1회: 추천 즉시 계산 (UI에 빈 추천 섹션 방지)
    # stocks/stock_bars가 비어있으면 잡 내부에서 자체 skip
    await asyncio.to_thread(run_compute_recommendations, supabase, logger)

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
