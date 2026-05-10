import os
import uuid

import pytest
from dotenv import load_dotenv
from postgrest.exceptions import APIError
from supabase import create_client

load_dotenv()


@pytest.fixture(scope="module")
def supabase_admin():
    url = os.environ["SUPABASE_URL"]
    key = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
    return create_client(url, key)


@pytest.fixture
def cleanup_user(supabase_admin):
    user_ids: list[str] = []
    yield user_ids
    for uid in user_ids:
        try:
            supabase_admin.auth.admin.delete_user(uid)
        except Exception:
            pass


def test_signup_creates_profile_portfolio_notification_settings(supabase_admin, cleanup_user):
    # Given: 신규 사용자 가입
    email = f"test-{uuid.uuid4()}@example.com"
    res = supabase_admin.auth.admin.create_user(
        {
            "email": email,
            "password": "TestPass123!",
            "email_confirm": True,
            "user_metadata": {"full_name": "Plan One Tester"},
        }
    )
    user_id = res.user.id
    cleanup_user.append(user_id)

    # When: 트리거가 실행되면
    profile = (
        supabase_admin.table("profiles")
        .select("*")
        .eq("id", user_id)
        .single()
        .execute()
        .data
    )
    portfolio = (
        supabase_admin.table("portfolios")
        .select("*")
        .eq("user_id", user_id)
        .is_("room_id", "null")
        .single()
        .execute()
        .data
    )
    notif = (
        supabase_admin.table("notification_settings")
        .select("*")
        .eq("user_id", user_id)
        .single()
        .execute()
        .data
    )

    # Then: 행이 자동 생성되고 기본값이 정확함
    assert profile["display_name"] == "Plan One Tester"
    assert float(portfolio["starting_krw"]) == 100000000.0
    assert float(portfolio["starting_usd"]) == 0.0
    assert float(portfolio["krw_balance"]) == 100000000.0
    assert float(portfolio["usd_balance"]) == 0.0
    assert portfolio["status"] == "active"
    assert portfolio["room_id"] is None
    assert notif["order_filled"] is True


def test_signup_falls_back_to_email_localpart_for_display_name(supabase_admin, cleanup_user):
    email = f"fallback-{uuid.uuid4()}@example.com"
    expected_name = email.split("@")[0]
    res = supabase_admin.auth.admin.create_user(
        {
            "email": email,
            "password": "TestPass123!",
            "email_confirm": True,
        }
    )
    user_id = res.user.id
    cleanup_user.append(user_id)

    profile = (
        supabase_admin.table("profiles")
        .select("*")
        .eq("id", user_id)
        .single()
        .execute()
        .data
    )
    assert profile["display_name"] == expected_name


def test_global_portfolio_uniqueness_per_user(supabase_admin, cleanup_user):
    email = f"uniq-{uuid.uuid4()}@example.com"
    res = supabase_admin.auth.admin.create_user(
        {
            "email": email,
            "password": "TestPass123!",
            "email_confirm": True,
        }
    )
    user_id = res.user.id
    cleanup_user.append(user_id)

    with pytest.raises(APIError):
        supabase_admin.table("portfolios").insert(
            {
                "user_id": user_id,
                "starting_krw": 100000000,
                "starting_usd": 0,
                "fx_rate_at_start": 1395,
                "krw_balance": 100000000,
                "usd_balance": 0,
            }
        ).execute()
