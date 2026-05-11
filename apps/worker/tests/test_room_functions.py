"""Plan #5 PG 함수 통합 테스트 (rooms + leaderboard)."""

import os
import uuid
from datetime import UTC, datetime, timedelta

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


def _make_user(admin, cleanup_user) -> tuple[str, str]:
    email = f"room-{uuid.uuid4()}@test.com"
    res = admin.auth.admin.create_user(
        {"email": email, "password": "TestPass123!", "email_confirm": True}
    )
    cleanup_user.append(res.user.id)
    return res.user.id, email


def _user_client(email: str):
    url = os.environ["SUPABASE_URL"]
    anon_key = os.environ["SUPABASE_ANON_KEY"]
    c = create_client(url, anon_key)
    c.auth.sign_in_with_password({"email": email, "password": "TestPass123!"})
    return c


def _seed_fx(admin):
    admin.table("fx_rates").upsert(
        {
            "base": "USD",
            "quote": "KRW",
            "rate": 1400,
            "ts": datetime.now(UTC).isoformat(),
        },
        on_conflict="base,quote,ts",
    ).execute()


def test_create_room_returns_invite_code(admin, cleanup_user):
    _seed_fx(admin)
    _, email = _make_user(admin, cleanup_user)
    c = _user_client(email)

    res = c.rpc(
        "create_room",
        {
            "p_name": "Test Room",
            "p_starting_krw": 100_000_000,
            "p_starting_usd": 0,
            "p_starts_at": (datetime.now(UTC) + timedelta(hours=1)).isoformat(),
            "p_ends_at": (datetime.now(UTC) + timedelta(days=30)).isoformat(),
            "p_max_members": 10,
            "p_late_join_until": None,
        },
    ).execute()
    body = res.data
    assert "room_id" in body
    assert "invite_code" in body
    assert len(body["invite_code"]) == 6


def test_join_room_creates_portfolio(admin, cleanup_user):
    _seed_fx(admin)
    _, host_email = _make_user(admin, cleanup_user)
    _, member_email = _make_user(admin, cleanup_user)

    host_c = _user_client(host_email)
    create = host_c.rpc(
        "create_room",
        {
            "p_name": "Join Test",
            "p_starting_krw": 50_000_000,
            "p_starting_usd": 1000,
            "p_starts_at": datetime.now(UTC).isoformat(),
            "p_ends_at": None,
            "p_max_members": 5,
            "p_late_join_until": None,
        },
    ).execute()
    invite_code = create.data["invite_code"]

    member_c = _user_client(member_email)
    join_res = member_c.rpc(
        "join_room", {"p_invite_code": invite_code}
    ).execute()
    body = join_res.data
    assert "portfolio_id" in body
    assert float(body["starting_krw"]) == 50_000_000
    assert float(body["starting_usd"]) == 1000

    # member의 room portfolio 검증
    member_user_id = admin.auth.get_user(
        member_c.auth.get_session().access_token
    ).user.id
    room_pfl = (
        admin.table("portfolios")
        .select("*")
        .eq("user_id", member_user_id)
        .eq("id", body["portfolio_id"])
        .single()
        .execute()
        .data
    )
    assert room_pfl["status"] == "active"
    assert float(room_pfl["krw_balance"]) == 50_000_000


def test_join_room_invalid_code(admin, cleanup_user):
    _, email = _make_user(admin, cleanup_user)
    c = _user_client(email)
    with pytest.raises(APIError) as exc:
        c.rpc("join_room", {"p_invite_code": "ZZZZZZ"}).execute()
    assert "room_not_found" in str(exc.value)


def test_join_room_twice_rejects(admin, cleanup_user):
    _seed_fx(admin)
    _, host_email = _make_user(admin, cleanup_user)
    host_c = _user_client(host_email)
    create = host_c.rpc(
        "create_room",
        {
            "p_name": "Dup",
            "p_starting_krw": 100,
            "p_starting_usd": 0,
            "p_starts_at": datetime.now(UTC).isoformat(),
            "p_ends_at": None,
            "p_max_members": 5,
            "p_late_join_until": None,
        },
    ).execute()
    code = create.data["invite_code"]

    _, member_email = _make_user(admin, cleanup_user)
    member_c = _user_client(member_email)
    member_c.rpc("join_room", {"p_invite_code": code}).execute()
    with pytest.raises(APIError) as exc:
        member_c.rpc("join_room", {"p_invite_code": code}).execute()
    assert "already_member" in str(exc.value)


def test_compute_portfolio_value_returns_krw_and_pct(admin, cleanup_user):
    _seed_fx(admin)
    user_id, _ = _make_user(admin, cleanup_user)
    pfl = (
        admin.table("portfolios")
        .select("id")
        .eq("user_id", user_id)
        .is_("room_id", "null")
        .single()
        .execute()
        .data
    )
    res = admin.rpc(
        "compute_portfolio_value", {"p_portfolio_id": pfl["id"]}
    ).execute()
    body = res.data
    # 갓 가입한 글로벌 포트폴리오: KRW 1억, USD 0
    assert abs(float(body["total_value_krw"]) - 100_000_000) < 1
    assert abs(float(body["return_pct"])) < 0.01


def test_transition_room_lifecycle_opens_active_room(admin, cleanup_user):
    _seed_fx(admin)
    _, email = _make_user(admin, cleanup_user)
    c = _user_client(email)
    # starts_at 과거로 → status='active'로 바로 입력됨 (create_room이 즉시 active로)
    create = c.rpc(
        "create_room",
        {
            "p_name": "Lifecycle Past",
            "p_starting_krw": 100,
            "p_starting_usd": 0,
            "p_starts_at": (datetime.now(UTC) - timedelta(minutes=5)).isoformat(),
            "p_ends_at": None,
            "p_max_members": 5,
            "p_late_join_until": None,
        },
    ).execute()
    room_id = create.data["room_id"]
    row = (
        admin.table("rooms")
        .select("status")
        .eq("id", room_id)
        .single()
        .execute()
        .data
    )
    assert row["status"] == "active"

    # 호출해도 active인 채로 유지 (open이 없으므로 opened=0)
    res = admin.rpc("transition_room_lifecycle", {}).execute()
    assert res.data["opened"] == 0
