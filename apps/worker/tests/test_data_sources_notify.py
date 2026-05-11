import json
from unittest.mock import MagicMock, patch

import pytest

from ygworker.data_sources.notify import NotificationGone, send_one


@patch("ygworker.data_sources.notify.webpush")
def test_send_one_calls_webpush_with_payload(mock_webpush):
    sub = {
        "endpoint": "https://fcm.example.com/sub",
        "p256dh": "BNxx",
        "auth": "AAxx",
    }
    payload = {"title": "T", "body": "B", "url": "/x"}

    send_one(
        sub,
        payload,
        vapid_private_key="...",
        vapid_claims={"sub": "mailto:t@t.com"},
    )

    mock_webpush.assert_called_once()
    args = mock_webpush.call_args
    assert args.kwargs["subscription_info"]["endpoint"] == "https://fcm.example.com/sub"
    assert json.loads(args.kwargs["data"]) == payload


@patch("ygworker.data_sources.notify.webpush")
def test_send_one_raises_notification_gone_on_410(mock_webpush):
    """WebPushException with response.status_code == 410은 NotificationGone로 변환."""
    from pywebpush import WebPushException

    response = MagicMock()
    response.status_code = 410
    exc = WebPushException("gone", response=response)
    mock_webpush.side_effect = exc

    sub = {"endpoint": "x", "p256dh": "x", "auth": "x"}
    with pytest.raises(NotificationGone):
        send_one(
            sub,
            {"title": "T", "body": "B"},
            vapid_private_key="...",
            vapid_claims={"sub": "x"},
        )


@patch("ygworker.data_sources.notify.webpush")
def test_send_one_reraises_non_410(mock_webpush):
    from pywebpush import WebPushException

    response = MagicMock()
    response.status_code = 500
    mock_webpush.side_effect = WebPushException("err", response=response)

    sub = {"endpoint": "x", "p256dh": "x", "auth": "x"}
    with pytest.raises(WebPushException):
        send_one(
            sub,
            {"title": "T", "body": "B"},
            vapid_private_key="...",
            vapid_claims={"sub": "x"},
        )
