"""pywebpush 래퍼.

단일 구독에 push 발송. 410 Gone (구독 만료/취소)은 NotificationGone으로
변환해서 호출자가 DB에서 삭제할 수 있도록 함.
"""

import json
from typing import Any

from pywebpush import WebPushException, webpush


class NotificationGone(Exception):  # noqa: N818 — domain-specific naming
    """구독이 만료됨(410 Gone). 호출자가 push_subscriptions에서 삭제해야."""


def send_one(
    subscription: dict,
    payload: dict,
    *,
    vapid_private_key: str,
    vapid_claims: dict[str, Any],
) -> None:
    """단일 구독에 push 발송.

    Args:
      subscription: {"endpoint": ..., "p256dh": ..., "auth": ...}
      payload: 임의 JSON 직렬화 가능 dict (서비스 워커가 받을 데이터)
      vapid_private_key: raw base64url (from `npx web-push generate-vapid-keys`)
            또는 PEM-encoded EC private key — pywebpush가 둘 다 지원
      vapid_claims: e.g. {"sub": "mailto:..."}
    """
    sub_info = {
        "endpoint": subscription["endpoint"],
        "keys": {
            "p256dh": subscription["p256dh"],
            "auth": subscription["auth"],
        },
    }
    try:
        webpush(
            subscription_info=sub_info,
            data=json.dumps(payload),
            vapid_private_key=vapid_private_key,
            vapid_claims=vapid_claims,
        )
    except WebPushException as exc:
        if exc.response is not None and exc.response.status_code == 410:
            raise NotificationGone() from exc
        raise
