create table public.notification_settings (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  order_filled boolean not null default true,
  order_expiring_soon boolean not null default true,
  room_starting boolean not null default true,
  room_ending boolean not null default true,
  dividend_received boolean not null default true,
  corporate_action_applied boolean not null default true,
  updated_at timestamptz not null default now()
);

comment on table public.notification_settings is '사용자별 푸시 알림 종류 ON/OFF';
