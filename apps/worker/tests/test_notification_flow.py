"""Plan #7 notification queue end-to-end (real Postgres)."""

import os
import uuid

import pytest
from dotenv import load_dotenv
from supabase import create_client

load_dotenv()


@pytest.fixture(scope="module")
def admin():
    return create_client(
        os.environ["SUPABASE_URL"], os.environ["SUPABASE_SERVICE_ROLE_KEY"]
    )


@pytest.fixture
def cleanup_user(admin):
    user_ids = []
    yield user_ids
    for uid in user_ids:
        try:
            admin.auth.admin.delete_user(uid)
        except Exception:
            pass


def _make_user(admin, cleanup_user):
    email = f"push-{uuid.uuid4()}@test.com"
    res = admin.auth.admin.create_user(
        {"email": email, "password": "TestPass123!", "email_confirm": True}
    )
    cleanup_user.append(res.user.id)
    return res.user.id


def test_enqueue_notification_inserts_when_setting_enabled(admin, cleanup_user):
    user_id = _make_user(admin, cleanup_user)
    # notification_settings는 signup 트리거가 만들고 default true

    admin.rpc(
        "enqueue_notification",
        {
            "p_user_id": user_id,
            "p_type": "order_filled",
            "p_title": "Test",
            "p_body": "Test body",
            "p_url": "/x",
            "p_dedup_key": f"test_dedup_{uuid.uuid4()}",
        },
    ).execute()

    rows = (
        admin.table("notification_queue")
        .select("*")
        .eq("user_id", user_id)
        .execute()
        .data
    )
    assert len(rows) == 1
    assert rows[0]["status"] == "pending"
    assert rows[0]["type"] == "order_filled"


def test_enqueue_notification_skips_when_setting_disabled(admin, cleanup_user):
    user_id = _make_user(admin, cleanup_user)
    admin.table("notification_settings").update(
        {"dividend_received": False}
    ).eq("user_id", user_id).execute()

    admin.rpc(
        "enqueue_notification",
        {
            "p_user_id": user_id,
            "p_type": "dividend_received",
            "p_title": "T",
            "p_body": "B",
            "p_url": "/x",
            "p_dedup_key": f"div_off_{uuid.uuid4()}",
        },
    ).execute()

    rows = (
        admin.table("notification_queue")
        .select("*")
        .eq("user_id", user_id)
        .execute()
        .data
    )
    assert rows == []


def test_enqueue_notification_dedup(admin, cleanup_user):
    user_id = _make_user(admin, cleanup_user)
    key = f"dedup_test_{uuid.uuid4()}"

    admin.rpc(
        "enqueue_notification",
        {
            "p_user_id": user_id,
            "p_type": "order_filled",
            "p_title": "T1",
            "p_body": "B",
            "p_url": "/x",
            "p_dedup_key": key,
        },
    ).execute()
    # 두 번째 호출 — 같은 dedup_key
    admin.rpc(
        "enqueue_notification",
        {
            "p_user_id": user_id,
            "p_type": "order_filled",
            "p_title": "T2",
            "p_body": "B",
            "p_url": "/x",
            "p_dedup_key": key,
        },
    ).execute()

    rows = (
        admin.table("notification_queue")
        .select("*")
        .eq("user_id", user_id)
        .execute()
        .data
    )
    assert len(rows) == 1
    assert rows[0]["title"] == "T1"  # 첫 번째만 들어감
