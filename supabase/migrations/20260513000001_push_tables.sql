-- 브라우저 push 구독 (사용자 디바이스별).
-- 한 사용자가 여러 디바이스에 구독 가능. (user_id, endpoint) 유일.
create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  endpoint text not null,
  p256dh text not null,         -- client public key (P-256)
  auth text not null,           -- 16-byte 토큰 base64url
  user_agent text,
  created_at timestamptz not null default now(),
  unique (user_id, endpoint)
);

create index push_subscriptions_user_idx on public.push_subscriptions (user_id);

alter table public.push_subscriptions enable row level security;

create policy "push_subscriptions: 본인 읽기/쓰기"
  on public.push_subscriptions for all
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

comment on table public.push_subscriptions is '브라우저 push 구독 (디바이스별)';


-- 알림 큐 — 이벤트 소스가 INSERT, send_notifications 워커가 SELECT + UPDATE.
create table public.notification_queue (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  type text not null check (type in (
    'order_filled',
    'order_expiring_soon',
    'room_starting',
    'room_ending',
    'dividend_received',
    'corporate_action_applied'
  )),
  title text not null,
  body text not null,
  url text,                       -- click 시 이동할 페이지 (e.g. /app/portfolio/orders)
  dedup_key text not null,        -- 중복 방지 키 (e.g. "trade_filled:<trade_id>")
  status text not null default 'pending' check (status in ('pending', 'sent', 'failed', 'no_subscription')),
  attempts int not null default 0,
  created_at timestamptz not null default now(),
  sent_at timestamptz
);

-- 같은 dedup_key는 1번만 (status 무관 — failed면 재시도 안 함)
create unique index notification_queue_dedup_idx
  on public.notification_queue (dedup_key);

create index notification_queue_pending_idx
  on public.notification_queue (status, created_at) where status = 'pending';

create index notification_queue_user_idx
  on public.notification_queue (user_id, created_at desc);

alter table public.notification_queue enable row level security;

create policy "notification_queue: 본인 읽기"
  on public.notification_queue for select
  to authenticated
  using (user_id = auth.uid());
-- INSERT/UPDATE는 service_role (워커)만.

comment on table public.notification_queue is '알림 큐 — 워커 send_notifications가 1분마다 dispatch';


-- 방어적: notification_settings(Plan #1 생성)가 본인 UPDATE 허용 안 됐을 수 있음.
-- Plan #7의 /api/notification-settings PATCH가 동작하도록 정책 명시.
-- 이미 같은 이름 정책 존재 시 idempotent (없으면 생성).
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'notification_settings'
      and policyname = 'notification_settings: 본인 UPDATE'
  ) then
    execute $POL$
      create policy "notification_settings: 본인 UPDATE"
        on public.notification_settings for update
        to authenticated
        using (user_id = auth.uid())
        with check (user_id = auth.uid())
    $POL$;
  end if;
end;
$$;
