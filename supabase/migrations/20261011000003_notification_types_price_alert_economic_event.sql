-- 알림 파이프라인 수정 (코드베이스 진단 2026-10-10, 퀵픽스 #9)
--
-- 가격 알림(check_price_alerts)과 경제 일정 D-1 알림(notify_economic_events)은
-- enqueue_notification 을 'price_alert' / 'economic_event' 타입으로 호출하지만
-- notification_queue.type CHECK 에 두 타입이 없어 INSERT 가 제약 위반으로 실패했다.
-- → 두 알림은 한 번도 발송된 적이 없다 (가격 알림은 그 전에 'triggered' 로 소모됨).
--
-- 1) CHECK 제약에 두 타입 추가
-- 2) enqueue_notification 의 설정 CASE 에 두 타입 추가
--    - price_alert: 사용자가 직접 만든 알림이라 별도 ON/OFF 설정이 없음 → 항상 허용
--    - economic_event: notification_settings.economic_events_enabled (Plan #27 C4)

-- ═══════════════════════════════════════════════════════════════
-- 1) notification_queue.type CHECK 확장
-- ═══════════════════════════════════════════════════════════════
alter table public.notification_queue
  drop constraint if exists notification_queue_type_check;

alter table public.notification_queue
  add constraint notification_queue_type_check check (type in (
    'order_filled',
    'order_expiring_soon',
    'room_starting',
    'room_ending',
    'dividend_received',
    'corporate_action_applied',
    'price_alert',
    'economic_event'
  ));

-- ═══════════════════════════════════════════════════════════════
-- 2) enqueue_notification — 설정 CASE 확장 (나머지 본문은 기존과 동일)
-- ═══════════════════════════════════════════════════════════════
create or replace function public.enqueue_notification(
  p_user_id uuid,
  p_type text,
  p_title text,
  p_body text,
  p_url text,
  p_dedup_key text
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_enabled boolean;
begin
  -- 사용자 알림 설정 확인 (해당 type이 OFF면 enqueue 안 함)
  -- notification_settings에 row 없으면 default true 가정 (signup 트리거가 만들어줌)
  select case p_type
    when 'order_filled' then order_filled
    when 'order_expiring_soon' then order_expiring_soon
    when 'room_starting' then room_starting
    when 'room_ending' then room_ending
    when 'dividend_received' then dividend_received
    when 'corporate_action_applied' then corporate_action_applied
    when 'price_alert' then true
    when 'economic_event' then economic_events_enabled
    else true
  end into v_enabled
  from notification_settings where user_id = p_user_id;

  if v_enabled is null or not v_enabled then
    return;
  end if;

  insert into notification_queue (user_id, type, title, body, url, dedup_key)
  values (p_user_id, p_type, p_title, p_body, p_url, p_dedup_key)
  on conflict (dedup_key) do nothing;
end;
$$;

revoke all on function enqueue_notification(uuid, text, text, text, text, text)
  from public, anon, authenticated;
grant execute on function enqueue_notification(uuid, text, text, text, text, text)
  to service_role;
