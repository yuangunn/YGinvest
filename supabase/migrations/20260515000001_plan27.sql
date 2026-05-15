-- Plan #27: 매매일지 + 클라이언트 에러 로깅 + 경제 이벤트 알림 설정.

-- ───── trade_notes (C1) ─────────────────────────────────────────
-- 사용자가 거래에 메모/회고 작성. 회고 학습 도구.
create table public.trade_notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  trade_id uuid references public.trades(id) on delete cascade,
  symbol text,                           -- trade_id가 null이면 종목 단위 메모로 사용
  body text not null check (length(body) <= 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index trade_notes_user_idx on public.trade_notes (user_id, created_at desc);
create index trade_notes_trade_idx on public.trade_notes (trade_id) where trade_id is not null;
create index trade_notes_symbol_idx on public.trade_notes (user_id, symbol) where symbol is not null;

alter table public.trade_notes enable row level security;

create policy trade_notes_select_own on public.trade_notes for select to authenticated using (auth.uid() = user_id);
create policy trade_notes_insert_own on public.trade_notes for insert to authenticated with check (auth.uid() = user_id);
create policy trade_notes_update_own on public.trade_notes for update to authenticated using (auth.uid() = user_id);
create policy trade_notes_delete_own on public.trade_notes for delete to authenticated using (auth.uid() = user_id);

comment on table public.trade_notes is 'Plan #27 C1: 매매 일지 / 회고 메모';


-- ───── client_errors (B4) ────────────────────────────────────────
-- 클라이언트에서 발생한 에러 자체 수집. rate-limited insert.
create table public.client_errors (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  pathname text,
  message text not null check (length(message) <= 2000),
  stack text,
  user_agent text,
  created_at timestamptz not null default now()
);

create index client_errors_created_idx on public.client_errors (created_at desc);
create index client_errors_user_idx on public.client_errors (user_id, created_at desc) where user_id is not null;

alter table public.client_errors enable row level security;

-- 로그인 사용자는 본인의 에러만 insert 가능. select는 service_role만 (운영자가 직접 쿼리).
create policy client_errors_insert_self on public.client_errors for insert to authenticated
  with check (user_id is null or user_id = auth.uid());

-- 자신의 에러는 본인이 조회 가능 (디버깅 목적)
create policy client_errors_select_own on public.client_errors for select to authenticated
  using (auth.uid() = user_id);

comment on table public.client_errors is 'Plan #27 B4: 클라이언트 사이드 에러 로그 (자체 Sentry 대체)';


-- ───── notification_settings에 economic_events 추가 (C4) ─────────
-- 이미 존재하는 테이블에 컬럼 추가. 기본값 true (기본적으로 받음).
alter table public.notification_settings
  add column if not exists economic_events_enabled boolean not null default true;

comment on column public.notification_settings.economic_events_enabled is
  'Plan #27 C4: FOMC/CPI/한은 등 거시 이벤트 D-1 push 수신';
