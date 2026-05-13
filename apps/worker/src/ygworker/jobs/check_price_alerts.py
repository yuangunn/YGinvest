"""Plan #23: 가격 알림 체크 — 매분 활성 알림을 last_price와 비교, trigger 시 push 전송.

알고리즘:
1. price_alerts where status='active' 가져오기
2. 각 alert의 symbol → stocks.last_price와 비교
3. 조건 만족 시 status='triggered', push notification 전송
"""
from datetime import UTC, datetime
from typing import Any


def run_check_price_alerts(supabase: Any, logger: Any) -> None:
    alerts = (
        supabase.table("price_alerts")
        .select("id, user_id, symbol, condition, trigger_price")
        .eq("status", "active")
        .execute()
        .data
        or []
    )
    if not alerts:
        logger.debug("check_price_alerts.skip", reason="no_active")
        return

    # Group by symbol to batch-fetch prices
    symbols = list({a["symbol"] for a in alerts})
    stocks = (
        supabase.table("stocks")
        .select("symbol, last_price, name, name_ko, currency")
        .in_("symbol", symbols)
        .execute()
        .data
        or []
    )
    by_symbol = {s["symbol"]: s for s in stocks}

    now_iso = datetime.now(UTC).isoformat()
    triggered = 0

    for alert in alerts:
        stock = by_symbol.get(alert["symbol"])
        if not stock or stock["last_price"] is None:
            continue
        price = float(stock["last_price"])
        trigger = float(alert["trigger_price"])
        cond = alert["condition"]

        hit = (cond == "above" and price >= trigger) or (
            cond == "below" and price <= trigger
        )
        if not hit:
            continue

        # Mark triggered
        try:
            supabase.table("price_alerts").update(
                {
                    "status": "triggered",
                    "triggered_at": now_iso,
                    "triggered_price": price,
                }
            ).eq("id", alert["id"]).execute()
        except Exception as exc:
            logger.warning(
                "check_price_alerts.update_failed",
                alert_id=alert["id"],
                error=str(exc),
            )
            continue

        # Enqueue push notification via RPC
        display_name = stock.get("name_ko") or stock.get("name") or alert["symbol"]
        currency = stock.get("currency", "KRW")
        cond_label = "이상 도달" if cond == "above" else "이하 도달"
        title = f"🔔 {display_name}"
        body = f"{trigger:,.0f}{currency} {cond_label} (현재 {price:,.0f})"
        try:
            supabase.rpc(
                "enqueue_notification",
                {
                    "p_user_id": alert["user_id"],
                    "p_type": "price_alert",
                    "p_title": title,
                    "p_body": body,
                    "p_url": f"/app/trade/{alert['symbol']}",
                    "p_dedup_key": f"price_alert:{alert['id']}",
                },
            ).execute()
            triggered += 1
        except Exception as exc:
            logger.warning(
                "check_price_alerts.notify_failed",
                alert_id=alert["id"],
                error=str(exc),
            )

    logger.info(
        "check_price_alerts.done", checked=len(alerts), triggered=triggered
    )
