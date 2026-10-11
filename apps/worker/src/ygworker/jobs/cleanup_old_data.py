"""Plan #27 A5: 오래된 데이터 자동 정리.

Supabase 디스크 / 인덱스 크기 통제. 매일 02:00 KST 1회 실행.

정리 대상:
- stock_bars 15m/1h: 90일 이전 (인트라데이는 차트용 cache라 장기 보존 불필요)
- notification_queue: 처리 끝난 상태(sent/failed/no_subscription) & 30일 이전
  (quick-fix #11: 예전엔 존재하지 않는 `dispatched` 열을 필터해 매일 밤 실패, 큐 무한 성장)
- recommendation_clicks: 60일 이전 (집계는 별도 테이블에서 보존)
- client_errors: 30일 이전 (B4에서 추가될 테이블)
- health_alerts: 90일 이전 (Plan #47 운영 알림 로그)

portfolio_snapshots 는 여기서 지우지 않는다. 리더보드 MV 와 수익률 차트가 원본
스냅샷을 그대로 쓰므로, 시간·일 단위 롤업(M1)이 먼저 들어와야 보존 정책을 둘 수 있다.
"""
from datetime import UTC, datetime, timedelta
from typing import Any

# notification_queue 에서 정리해도 되는 종료 상태 (pending 은 send_notifications 가 처리)
QUEUE_DONE_STATUSES = ("sent", "failed", "no_subscription")


def run_cleanup_old_data(supabase: Any, logger: Any) -> None:
    now = datetime.now(UTC)
    intraday_cutoff = (now - timedelta(days=90)).isoformat()
    queue_cutoff = (now - timedelta(days=30)).isoformat()
    clicks_cutoff = (now - timedelta(days=60)).isoformat()
    errors_cutoff = (now - timedelta(days=30)).isoformat()
    health_cutoff = (now - timedelta(days=90)).isoformat()

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

    # 2) 처리 끝난 notification_queue 30일 이전
    try:
        res = (
            supabase.table("notification_queue")
            .delete()
            .in_("status", list(QUEUE_DONE_STATUSES))
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

    # 5) health_alerts 90일 이전 (운영 알림 로그)
    try:
        res = (
            supabase.table("health_alerts")
            .delete()
            .lt("ts", health_cutoff)
            .execute()
        )
        totals["health_alerts"] = len(res.data or [])
    except Exception as exc:
        totals["health_alerts_error"] = str(exc)[:80]

    logger.info("cleanup_old_data.done", **totals)
