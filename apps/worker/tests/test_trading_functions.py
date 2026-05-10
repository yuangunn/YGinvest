"""Plan #3 PG 함수 통합 테스트. 로컬 Supabase 가동 중이어야 통과."""

import os
import uuid
from datetime import UTC, datetime

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
def cleanup_user(admin):
    user_ids: list[str] = []
    yield user_ids
    for uid in user_ids:
        try:
            admin.auth.admin.delete_user(uid)
        except Exception:
            pass


def _make_user_with_portfolio(admin, cleanup_user) -> tuple[str, str, str]:
    """가입 → 자동 생성된 글로벌 portfolio_id 반환. (user_id, email, portfolio_id)"""
    email = f"trade-{uuid.uuid4()}@test.com"
    res = admin.auth.admin.create_user(
        {"email": email, "password": "TestPass123!", "email_confirm": True}
    )
    user_id = res.user.id
    cleanup_user.append(user_id)
    portfolio = (
        admin.table("portfolios")
        .select("id")
        .eq("user_id", user_id)
        .is_("room_id", "null")
        .single()
        .execute()
        .data
    )
    return user_id, email, portfolio["id"]


def _ensure_stock(
    admin,
    symbol: str,
    currency: str = "USD",
    market: str = "NASDAQ",
    price: float = 100.0,
):
    """테스트용 종목을 stocks에 upsert. last_price_at은 현재 시각."""
    now = datetime.now(UTC).isoformat()
    admin.table("stocks").upsert(
        {
            "symbol": symbol,
            "market": market,
            "currency": currency,
            "name": f"{symbol} Test",
            "last_price": price,
            "last_price_at": now,
            "is_active": True,
        },
        on_conflict="symbol",
    ).execute()


def _user_client(admin, email: str):
    """user JWT로 호출하는 client. password sign-in."""
    url = os.environ["SUPABASE_URL"]
    anon_key = os.environ["SUPABASE_ANON_KEY"]
    user_client = create_client(url, anon_key)
    user_client.auth.sign_in_with_password({"email": email, "password": "TestPass123!"})
    return user_client


def test_market_buy_updates_balance_and_holdings(admin, cleanup_user):
    user_id, email, pid = _make_user_with_portfolio(admin, cleanup_user)
    _ensure_stock(admin, "TEST_AAPL", currency="USD", price=100.0)
    # USD 잔고 채우기
    admin.table("portfolios").update({"usd_balance": 10000}).eq("id", pid).execute()

    user_client = _user_client(admin, email)
    res = user_client.rpc(
        "place_market_order",
        {
            "p_portfolio_id": pid,
            "p_symbol": "TEST_AAPL",
            "p_side": "buy",
            "p_quantity": 10,
        },
    ).execute()
    body = res.data
    assert float(body["filled_avg_price"]) == 100.0
    expected_fee = 10 * 100.0 * 0.0005  # 0.05% US buy
    assert abs(float(body["fee"]) - expected_fee) < 0.01

    portfolio = (
        admin.table("portfolios").select("*").eq("id", pid).single().execute().data
    )
    assert abs(float(portfolio["usd_balance"]) - (10000 - 1000 - expected_fee)) < 0.01

    holding = (
        admin.table("holdings")
        .select("*")
        .eq("portfolio_id", pid)
        .eq("symbol", "TEST_AAPL")
        .single()
        .execute()
        .data
    )
    assert float(holding["quantity"]) == 10
    assert float(holding["avg_cost"]) == 100.0


def test_market_buy_rejects_insufficient_balance(admin, cleanup_user):
    _, email, pid = _make_user_with_portfolio(admin, cleanup_user)
    _ensure_stock(admin, "TEST_RICH", currency="USD", price=1_000_000)

    user_client = _user_client(admin, email)
    with pytest.raises(APIError) as exc:
        user_client.rpc(
            "place_market_order",
            {
                "p_portfolio_id": pid,
                "p_symbol": "TEST_RICH",
                "p_side": "buy",
                "p_quantity": 1,
            },
        ).execute()
    assert "insufficient_balance" in str(exc.value)


def test_market_sell_after_buy_returns_balance(admin, cleanup_user):
    _, email, pid = _make_user_with_portfolio(admin, cleanup_user)
    _ensure_stock(admin, "TEST_SELL", currency="USD", price=50.0)
    admin.table("portfolios").update({"usd_balance": 1000}).eq("id", pid).execute()
    uc = _user_client(admin, email)
    uc.rpc(
        "place_market_order",
        {
            "p_portfolio_id": pid,
            "p_symbol": "TEST_SELL",
            "p_side": "buy",
            "p_quantity": 5,
        },
    ).execute()

    # Sell 5 at 50 => +250 - 0.05% fee
    uc.rpc(
        "place_market_order",
        {
            "p_portfolio_id": pid,
            "p_symbol": "TEST_SELL",
            "p_side": "sell",
            "p_quantity": 5,
        },
    ).execute()

    p = admin.table("portfolios").select("*").eq("id", pid).single().execute().data
    # 1000 - 250 - 0.125(buy fee) + 250 - 0.125(sell fee) = 999.75
    assert abs(float(p["usd_balance"]) - 999.75) < 0.01

    holding = (
        admin.table("holdings")
        .select("*")
        .eq("portfolio_id", pid)
        .eq("symbol", "TEST_SELL")
        .execute()
        .data
    )
    assert holding == []


def test_limit_buy_reserves_balance(admin, cleanup_user):
    _, email, pid = _make_user_with_portfolio(admin, cleanup_user)
    _ensure_stock(admin, "TEST_LIM", currency="USD", price=100.0)
    admin.table("portfolios").update({"usd_balance": 10000}).eq("id", pid).execute()

    uc = _user_client(admin, email)
    res = uc.rpc(
        "place_limit_order",
        {
            "p_portfolio_id": pid,
            "p_symbol": "TEST_LIM",
            "p_side": "buy",
            "p_quantity": 10,
            "p_limit_price": 90,
        },
    ).execute()
    reserved = float(res.data["reserved_amount"])
    # 10 * 90 * 1.0005 = 900.45
    assert abs(reserved - 900.45) < 0.01

    p = admin.table("portfolios").select("*").eq("id", pid).single().execute().data
    assert abs(float(p["usd_balance"]) - (10000 - 900.45)) < 0.01

    order = (
        admin.table("orders")
        .select("*")
        .eq("id", res.data["order_id"])
        .single()
        .execute()
        .data
    )
    assert order["status"] == "pending"


def test_cancel_pending_restores_balance(admin, cleanup_user):
    _, email, pid = _make_user_with_portfolio(admin, cleanup_user)
    _ensure_stock(admin, "TEST_CXL", currency="USD", price=100.0)
    admin.table("portfolios").update({"usd_balance": 10000}).eq("id", pid).execute()

    uc = _user_client(admin, email)
    order_id = (
        uc.rpc(
            "place_limit_order",
            {
                "p_portfolio_id": pid,
                "p_symbol": "TEST_CXL",
                "p_side": "buy",
                "p_quantity": 10,
                "p_limit_price": 90,
            },
        )
        .execute()
        .data["order_id"]
    )
    uc.rpc("cancel_order", {"p_order_id": order_id}).execute()

    p = admin.table("portfolios").select("*").eq("id", pid).single().execute().data
    assert abs(float(p["usd_balance"]) - 10000) < 0.01
    o = admin.table("orders").select("*").eq("id", order_id).single().execute().data
    assert o["status"] == "cancelled"


def test_match_limit_order_fills_when_price_reaches(admin, cleanup_user):
    _, email, pid = _make_user_with_portfolio(admin, cleanup_user)
    _ensure_stock(admin, "TEST_MATCH", currency="USD", price=100.0)
    admin.table("portfolios").update({"usd_balance": 10000}).eq("id", pid).execute()

    uc = _user_client(admin, email)
    order_id = (
        uc.rpc(
            "place_limit_order",
            {
                "p_portfolio_id": pid,
                "p_symbol": "TEST_MATCH",
                "p_side": "buy",
                "p_quantity": 10,
                "p_limit_price": 110,
            },
        )
        .execute()
        .data["order_id"]
    )

    # 현재가 100 ≤ limit 110 → 체결되어야 함
    res = admin.rpc("match_limit_order", {"p_order_id": order_id}).execute()
    assert res.data["matched"] is True

    o = admin.table("orders").select("*").eq("id", order_id).single().execute().data
    assert o["status"] == "filled"


def test_exchange_krw_to_usd(admin, cleanup_user):
    _, email, pid = _make_user_with_portfolio(admin, cleanup_user)
    # FX rate 시드
    admin.table("fx_rates").insert(
        {
            "base": "USD",
            "quote": "KRW",
            "rate": 1400,
            "ts": datetime.now(UTC).isoformat(),
        }
    ).execute()

    uc = _user_client(admin, email)
    res = uc.rpc(
        "exchange_currency",
        {
            "p_portfolio_id": pid,
            "p_from_currency": "KRW",
            "p_to_currency": "USD",
            "p_from_amount": 1_400_000,
        },
    ).execute()
    body = res.data
    # 1,400,000 / 1400 / 1.005 = 995.024...
    assert abs(float(body["to_amount"]) - 995.02) < 0.5

    p = admin.table("portfolios").select("*").eq("id", pid).single().execute().data
    assert abs(float(p["krw_balance"]) - (100_000_000 - 1_400_000)) < 0.01
    assert float(p["usd_balance"]) > 990
