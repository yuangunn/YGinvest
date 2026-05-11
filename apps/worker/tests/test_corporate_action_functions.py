"""Plan #6 corporate actions PG functions 통합 테스트 (real Postgres)."""

import os
import uuid
from datetime import date, timedelta

import pytest
from dotenv import load_dotenv
from postgrest.exceptions import APIError
from supabase import create_client

load_dotenv()


@pytest.fixture(scope="module")
def admin():
    return create_client(
        os.environ["SUPABASE_URL"], os.environ["SUPABASE_SERVICE_ROLE_KEY"]
    )


@pytest.fixture
def cleanup(admin):
    user_ids: list[str] = []
    symbols: list[str] = []
    yield {"users": user_ids, "symbols": symbols}
    # 사용자 먼저 삭제 (cascade로 portfolios/holdings/orders/dividend_payouts 정리)
    for uid in user_ids:
        try:
            admin.auth.admin.delete_user(uid)
        except Exception:
            pass
    # 종목별 events/actions/orders/holdings를 명시적으로 cleanup
    # (stocks FK는 cascade가 아니라 그대로면 stocks delete가 막힘)
    for sym in symbols:
        try:
            admin.table("dividend_events").delete().eq("symbol", sym).execute()
            admin.table("corporate_actions").delete().eq("symbol", sym).execute()
            admin.table("orders").delete().eq("symbol", sym).execute()
            admin.table("holdings").delete().eq("symbol", sym).execute()
            admin.table("dividend_payouts").delete().eq("symbol", sym).execute()
            admin.table("stocks").delete().eq("symbol", sym).execute()
        except Exception:
            pass


def _make_user_with_holdings(admin, cleanup, symbol: str, qty: float, currency: str):
    """가입 + portfolio에 holding 추가. Returns (user_id, portfolio_id)."""
    email = f"corp-{uuid.uuid4()}@test.com"
    res = admin.auth.admin.create_user(
        {"email": email, "password": "TestPass123!", "email_confirm": True}
    )
    user_id = res.user.id
    cleanup["users"].append(user_id)

    pfl = (
        admin.table("portfolios")
        .select("id")
        .eq("user_id", user_id)
        .is_("room_id", "null")
        .single()
        .execute()
        .data
    )
    admin.table("holdings").insert(
        {
            "portfolio_id": pfl["id"],
            "symbol": symbol,
            "quantity": qty,
            "avg_cost": 100 if currency == "USD" else 50000,
        }
    ).execute()
    return user_id, pfl["id"]


def _seed_stock(admin, cleanup, symbol: str, currency: str, last_price: float):
    admin.table("stocks").upsert(
        {
            "symbol": symbol,
            "name": f"{symbol} Test",
            "market": "NASDAQ" if currency == "USD" else "KRX_KS",
            "currency": currency,
            "last_price": last_price,
            "is_active": True,
        },
        on_conflict="symbol",
    ).execute()
    cleanup["symbols"].append(symbol)


def test_apply_dividend_pays_holders_with_tax(admin, cleanup):
    """배당 적용: 보유 10주 × $0.25 = $2.50 gross, $0.375 tax (15%), $2.125 net."""
    symbol = "TEST_DIV_US"
    _seed_stock(admin, cleanup, symbol, "USD", 150)
    _, pfl_id = _make_user_with_holdings(admin, cleanup, symbol, 10, "USD")

    yesterday = (date.today() - timedelta(days=1)).isoformat()
    ev = (
        admin.table("dividend_events")
        .insert(
            {
                "symbol": symbol,
                "ex_date": yesterday,
                "amount_per_share": 0.25,
                "currency": "USD",
            }
        )
        .execute()
        .data[0]
    )

    initial = (
        admin.table("portfolios")
        .select("usd_balance")
        .eq("id", pfl_id)
        .single()
        .execute()
        .data
    )
    initial_usd = float(initial["usd_balance"])

    res = admin.rpc("apply_dividend", {"p_event_id": ev["id"]}).execute()
    body = res.data
    assert body["holders"] == 1
    assert abs(float(body["total_net"]) - 2.125) < 0.01  # $2.50 - $0.375

    after = (
        admin.table("portfolios")
        .select("usd_balance")
        .eq("id", pfl_id)
        .single()
        .execute()
        .data
    )
    delta = float(after["usd_balance"]) - initial_usd
    assert abs(delta - 2.125) < 0.01

    payouts = (
        admin.table("dividend_payouts")
        .select("*")
        .eq("portfolio_id", pfl_id)
        .eq("symbol", symbol)
        .execute()
        .data
    )
    assert len(payouts) == 1
    assert abs(float(payouts[0]["gross"]) - 2.50) < 0.01
    assert abs(float(payouts[0]["tax"]) - 0.375) < 0.01

    ev_after = (
        admin.table("dividend_events")
        .select("applied")
        .eq("id", ev["id"])
        .single()
        .execute()
        .data
    )
    assert ev_after["applied"] is True


def test_apply_dividend_kr_uses_15_4_percent_tax(admin, cleanup):
    """KR 배당 세율 15.4% 적용."""
    symbol = "TEST_DIV_KR"
    _seed_stock(admin, cleanup, symbol, "KRW", 50000)
    _, pfl_id = _make_user_with_holdings(admin, cleanup, symbol, 10, "KRW")

    yesterday = (date.today() - timedelta(days=1)).isoformat()
    ev = (
        admin.table("dividend_events")
        .insert(
            {
                "symbol": symbol,
                "ex_date": yesterday,
                "amount_per_share": 1000,
                "currency": "KRW",
            }
        )
        .execute()
        .data[0]
    )

    res = admin.rpc("apply_dividend", {"p_event_id": ev["id"]}).execute()
    # 10 × 1000 = 10,000 gross; 10,000 × 0.154 = 1,540 tax; 8,460 net
    assert abs(float(res.data["total_net"]) - 8460) < 1


def test_apply_dividend_rejects_double_apply(admin, cleanup):
    symbol = "TEST_DIV_DBL"
    _seed_stock(admin, cleanup, symbol, "USD", 100)
    _make_user_with_holdings(admin, cleanup, symbol, 5, "USD")

    yesterday = (date.today() - timedelta(days=1)).isoformat()
    ev = (
        admin.table("dividend_events")
        .insert(
            {
                "symbol": symbol,
                "ex_date": yesterday,
                "amount_per_share": 0.5,
                "currency": "USD",
            }
        )
        .execute()
        .data[0]
    )

    admin.rpc("apply_dividend", {"p_event_id": ev["id"]}).execute()
    with pytest.raises(APIError) as exc:
        admin.rpc("apply_dividend", {"p_event_id": ev["id"]}).execute()
    assert "already_applied" in str(exc.value)


def test_apply_corporate_action_2_to_1_split(admin, cleanup):
    """2:1 forward split: 보유 10주 → 20주, avg_cost 절반."""
    symbol = "TEST_SPLIT_US"
    _seed_stock(admin, cleanup, symbol, "USD", 150)
    _, pfl_id = _make_user_with_holdings(admin, cleanup, symbol, 10, "USD")

    yesterday = (date.today() - timedelta(days=1)).isoformat()
    act = (
        admin.table("corporate_actions")
        .insert(
            {
                "symbol": symbol,
                "action_type": "split",
                "ratio": 2.0,
                "ex_date": yesterday,
            }
        )
        .execute()
        .data[0]
    )

    initial = (
        admin.table("portfolios")
        .select("usd_balance")
        .eq("id", pfl_id)
        .single()
        .execute()
        .data
    )
    initial_usd = float(initial["usd_balance"])

    res = admin.rpc("apply_corporate_action", {"p_action_id": act["id"]}).execute()
    assert res.data["holders"] == 1

    holding = (
        admin.table("holdings")
        .select("quantity, avg_cost")
        .eq("portfolio_id", pfl_id)
        .eq("symbol", symbol)
        .single()
        .execute()
        .data
    )
    assert float(holding["quantity"]) == 20
    assert abs(float(holding["avg_cost"]) - 50) < 0.01  # 100/2

    # 정확한 분할이라 leftover_cash = 0
    after = (
        admin.table("portfolios")
        .select("usd_balance")
        .eq("id", pfl_id)
        .single()
        .execute()
        .data
    )
    assert abs(float(after["usd_balance"]) - initial_usd) < 0.01


def test_apply_corporate_action_1_to_2_merge_with_leftover(admin, cleanup):
    """1:2 reverse split (ratio=0.5): 보유 5주 → 2주, leftover 0.5주는 cash 환원."""
    symbol = "TEST_MERGE_US"
    _seed_stock(admin, cleanup, symbol, "USD", 100)
    _, pfl_id = _make_user_with_holdings(admin, cleanup, symbol, 5, "USD")

    yesterday = (date.today() - timedelta(days=1)).isoformat()
    act = (
        admin.table("corporate_actions")
        .insert(
            {
                "symbol": symbol,
                "action_type": "reverse_split",
                "ratio": 0.5,
                "ex_date": yesterday,
            }
        )
        .execute()
        .data[0]
    )

    initial = (
        admin.table("portfolios")
        .select("usd_balance")
        .eq("id", pfl_id)
        .single()
        .execute()
        .data
    )
    initial_usd = float(initial["usd_balance"])

    admin.rpc("apply_corporate_action", {"p_action_id": act["id"]}).execute()

    holding = (
        admin.table("holdings")
        .select("quantity")
        .eq("portfolio_id", pfl_id)
        .eq("symbol", symbol)
        .single()
        .execute()
        .data
    )
    assert float(holding["quantity"]) == 2  # floor(5 * 0.5) = 2

    # leftover: 5 * 0.5 - 2 = 0.5주 × $100 = $50
    after = (
        admin.table("portfolios")
        .select("usd_balance")
        .eq("id", pfl_id)
        .single()
        .execute()
        .data
    )
    delta = float(after["usd_balance"]) - initial_usd
    assert abs(delta - 50) < 0.01


def test_apply_corporate_action_full_dilution_deletes_holding(admin, cleanup):
    """1:10 reverse split with single share: floor(1*0.1)=0 → holdings row 삭제."""
    symbol = "TEST_FULL_DILUTE"
    _seed_stock(admin, cleanup, symbol, "USD", 200)
    _, pfl_id = _make_user_with_holdings(admin, cleanup, symbol, 1, "USD")

    yesterday = (date.today() - timedelta(days=1)).isoformat()
    act = (
        admin.table("corporate_actions")
        .insert(
            {
                "symbol": symbol,
                "action_type": "reverse_split",
                "ratio": 0.1,
                "ex_date": yesterday,
            }
        )
        .execute()
        .data[0]
    )

    initial = (
        admin.table("portfolios")
        .select("usd_balance")
        .eq("id", pfl_id)
        .single()
        .execute()
        .data
    )
    initial_usd = float(initial["usd_balance"])

    admin.rpc("apply_corporate_action", {"p_action_id": act["id"]}).execute()

    # holdings row 삭제됨 (quantity > 0 CHECK이라 0 row 못 둠)
    holding_q = (
        admin.table("holdings")
        .select("quantity")
        .eq("portfolio_id", pfl_id)
        .eq("symbol", symbol)
        .execute()
    )
    assert holding_q.data == []

    # 전량 leftover: 1 * 0.1 = 0.1주 × $200 = $20
    after = (
        admin.table("portfolios")
        .select("usd_balance")
        .eq("id", pfl_id)
        .single()
        .execute()
        .data
    )
    delta = float(after["usd_balance"]) - initial_usd
    assert abs(delta - 20) < 0.01


def test_apply_corporate_action_rebalances_pending_buy_order(admin, cleanup):
    """2:1 forward split with a pending BUY limit order:
    수량 2배, limit_price 절반, reserved_amount는 동일 (수학적으로 보존)."""
    symbol = "TEST_SPLIT_ORDER"
    _seed_stock(admin, cleanup, symbol, "USD", 150)
    _, pfl_id = _make_user_with_holdings(admin, cleanup, symbol, 1, "USD")
    # holdings는 액션 적용을 위해 필요 (위 함수가 그 행도 처리)

    # 펜딩 BUY 지정가 주문 시드 (워커가 직접 raw INSERT — place_limit_order는 auth.uid() 필요)
    # 시드 reserved: 10주 × $100 × (1 + 0.0005) = $1000.50
    order = (
        admin.table("orders")
        .insert(
            {
                "portfolio_id": pfl_id,
                "symbol": symbol,
                "side": "buy",
                "order_type": "limit",
                "quantity": 10,
                "limit_price": 100,
                "status": "pending",
                "reserved_amount": 1000.50,
                "reserved_currency": "USD",
            }
        )
        .execute()
        .data[0]
    )

    yesterday = (date.today() - timedelta(days=1)).isoformat()
    act = (
        admin.table("corporate_actions")
        .insert(
            {
                "symbol": symbol,
                "action_type": "split",
                "ratio": 2.0,
                "ex_date": yesterday,
            }
        )
        .execute()
        .data[0]
    )

    initial = (
        admin.table("portfolios")
        .select("usd_balance")
        .eq("id", pfl_id)
        .single()
        .execute()
        .data
    )
    initial_usd = float(initial["usd_balance"])

    res = admin.rpc("apply_corporate_action", {"p_action_id": act["id"]}).execute()
    assert res.data["orders_adjusted"] == 1
    assert res.data["orders_cancelled"] == 0

    o_after = (
        admin.table("orders")
        .select("quantity, limit_price, reserved_amount, status")
        .eq("id", order["id"])
        .single()
        .execute()
        .data
    )
    assert float(o_after["quantity"]) == 20  # 10 * 2
    assert abs(float(o_after["limit_price"]) - 50) < 0.01  # 100 / 2
    # new reserved = 20 * 50 * 1.0005 = $1000.50 (정확히 동일)
    assert abs(float(o_after["reserved_amount"]) - 1000.50) < 0.01
    assert o_after["status"] == "pending"

    # 잔고 차이는 holdings leftover(0) + 주문 reserved 차이(0) = 0
    after = (
        admin.table("portfolios")
        .select("usd_balance")
        .eq("id", pfl_id)
        .single()
        .execute()
        .data
    )
    assert abs(float(after["usd_balance"]) - initial_usd) < 0.01
