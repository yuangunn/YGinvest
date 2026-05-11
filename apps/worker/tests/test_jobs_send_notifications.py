from unittest.mock import MagicMock, patch

from ygworker.jobs.send_notifications import run_send_notifications


@patch("ygworker.jobs.send_notifications.send_one")
def test_sends_pending_to_each_subscription_and_marks_sent(mock_send):
    fake = MagicMock()
    queue_resp = MagicMock(
        data=[{"id": "n1", "user_id": "u1", "title": "T", "body": "B", "url": "/x"}]
    )
    subs_resp = MagicMock(
        data=[
            {"id": "s1", "endpoint": "e1", "p256dh": "k1", "auth": "a1"},
            {"id": "s2", "endpoint": "e2", "p256dh": "k2", "auth": "a2"},
        ]
    )
    queue_chain = (
        fake.table.return_value.select.return_value.eq.return_value.order.return_value.limit.return_value.execute
    )
    queue_chain.return_value = queue_resp
    subs_chain = fake.table.return_value.select.return_value.eq.return_value.execute
    subs_chain.return_value = subs_resp

    logger = MagicMock()
    run_send_notifications(
        fake,
        logger,
        vapid_private_key="X",
        vapid_subject="mailto:t@t.com",
    )

    assert mock_send.call_count == 2
    payload = mock_send.call_args_list[0].args[1]
    assert payload["title"] == "T"

    update_calls = fake.table.return_value.update.call_args_list
    assert any(c.args[0].get("status") == "sent" for c in update_calls)


@patch("ygworker.jobs.send_notifications.send_one")
def test_skips_when_no_pending(mock_send):
    fake = MagicMock()
    queue_chain = (
        fake.table.return_value.select.return_value.eq.return_value.order.return_value.limit.return_value.execute
    )
    queue_chain.return_value = MagicMock(data=[])
    logger = MagicMock()

    run_send_notifications(fake, logger, vapid_private_key="X", vapid_subject="x")

    mock_send.assert_not_called()
    logger.info.assert_called_with("send_notifications.skip", reason="no_pending")


@patch("ygworker.jobs.send_notifications.send_one")
def test_marks_no_subscription_when_user_has_none(mock_send):
    fake = MagicMock()
    queue_chain = (
        fake.table.return_value.select.return_value.eq.return_value.order.return_value.limit.return_value.execute
    )
    queue_chain.return_value = MagicMock(
        data=[{"id": "n1", "user_id": "u1", "title": "T", "body": "B", "url": "/x"}]
    )
    subs_chain = fake.table.return_value.select.return_value.eq.return_value.execute
    subs_chain.return_value = MagicMock(data=[])
    logger = MagicMock()

    run_send_notifications(fake, logger, vapid_private_key="X", vapid_subject="x")

    mock_send.assert_not_called()
    update_calls = fake.table.return_value.update.call_args_list
    assert any(c.args[0].get("status") == "no_subscription" for c in update_calls)


@patch("ygworker.jobs.send_notifications.send_one")
def test_deletes_gone_subscriptions(mock_send):
    from ygworker.data_sources.notify import NotificationGone

    fake = MagicMock()
    queue_chain = (
        fake.table.return_value.select.return_value.eq.return_value.order.return_value.limit.return_value.execute
    )
    queue_chain.return_value = MagicMock(
        data=[{"id": "n1", "user_id": "u1", "title": "T", "body": "B", "url": "/x"}]
    )
    subs_chain = fake.table.return_value.select.return_value.eq.return_value.execute
    subs_chain.return_value = MagicMock(
        data=[{"id": "s1", "endpoint": "e1", "p256dh": "k1", "auth": "a1"}]
    )
    mock_send.side_effect = NotificationGone()
    logger = MagicMock()

    run_send_notifications(fake, logger, vapid_private_key="X", vapid_subject="x")

    delete_calls = fake.table.return_value.delete.call_args_list
    assert len(delete_calls) > 0  # push_subscriptions DELETE called
