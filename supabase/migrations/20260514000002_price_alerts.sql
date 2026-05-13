-- Plan #23: 가격 알림 — 사용자가 종목 + 조건 + 가격을 설정하면 워커가 매분 체크 후 push 전송

create table public.price_alerts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  symbol text not null references public.stocks(symbol) on delete cascade,
  condition text not null check (condition in ('above', 'below')),
  trigger_price numeric(20, 4) not null check (trigger_price > 0),
  status text not null default 'active' check (status in ('active', 'triggered', 'cancelled')),
  triggered_at timestamptz,
  triggered_price numeric(20, 4),
  created_at timestamptz not null default now()
);

create index price_alerts_user_idx on public.price_alerts (user_id, created_at desc);
create index price_alerts_active_idx on public.price_alerts (symbol, status) where status = 'active';

alter table public.price_alerts enable row level security;

create policy price_alerts_select_own
  on public.price_alerts for select
  to authenticated
  using (auth.uid() = user_id);

create policy price_alerts_insert_own
  on public.price_alerts for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy price_alerts_update_own
  on public.price_alerts for update
  to authenticated
  using (auth.uid() = user_id);

create policy price_alerts_delete_own
  on public.price_alerts for delete
  to authenticated
  using (auth.uid() = user_id);

comment on table public.price_alerts is
  'Plan #23: 가격 알림 — 사용자별 가격 조건. 워커가 매분 체크.';
