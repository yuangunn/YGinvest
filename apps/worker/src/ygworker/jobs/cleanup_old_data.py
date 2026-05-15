"""Plan #27 A5: 오래된 데이터 자동 정리.

Supabase 디스크 / 인덱스 크기 통제. 매일 02:00 KST 1회 실행.

정리 대상:
- stock_bars 15m/1h: 90일 이전 (인트라데이는 차트용 cache라 장기 보존 불필요)
- notification_queue: dispatched=true & 30일 이전 (이미 전송된 알림)
- recommendation_clicks: 60일 이전 (집계는 별도 테이블에서 보존)
- client_errors: 30일 이전 (B4에서 추가될 테이블)
"""
from datetime import UTC, datetime, timedelta
from typing import Any


def run_cleanup_old_data(supabase: Any, logger: Any) -> None:
    now = datetime.now(UTC)
    intraday_cutoff = (now - timedelta(days=90)).isoformat()
    queue_cutoff = (now - timedelta(days=30)).isoformat()
    clicks_cutoff = (now - timedelta(days=60)).isoformat()
    errors_cutoff = (now - timedelta(days=30)).isoformat()

    totals: dict[str, int | str] = {}

    # 1) 인트라데이 바 (15m + 1h) 90일 이전 삭제
    try:
        for interval in ("15m", "1h"):
            res = (
                supabase.table("stock_bars")
                .delete()
                .eq("interval", interval)
                .lt("ts", intraday_cutoff)
                .execute()
            )
            count = len(res.data or [])
            totals[f"stock_bars_{interval}"] = count
    except Exception as exc:
        totals["stock_bars_error"] = str(exc)

    # 2) 송신 완료된 notification_queue 30일 이전
    try:
        res = (
            supabase.table("notification_queue")
            .delete()
            .eq("dispatched", True)
            .lt("created_at", queue_cutoff)
            .execute()
        )
        totals["notification_queue"] = len(res.data or [])
    except Exception as exc:
        totals["notification_queue_error"] = str(exc)

    # 3) recommendation_clicks 60일 이전 raw 삭제
    try:
        res = (
            supabase.table("recommendation_clicks")
            .delete()
            .lt("clicked_at", clicks_cutoff)
            .execute()
        )
        totals["recommendation_clicks"] = len(res.data or [])
    except Exception as exc:
        totals["recommendation_clicks_error"] = str(exc)

    # 4) client_errors 30일 이전
    try:
        res = (
            supabase.table("client_errors")
            .delete()
            .lt("created_at", errors_cutoff)
            .execute()
        )
        totals["client_errors"] = len(res.data or [])
    except Exception as exc:
        # client_errors 테이블 미생성 환경에서도 graceful skip
        totals["client_errors_skipped"] = str(exc)[:80]

    logger.info("cleanup_old_data.done", **totals)
