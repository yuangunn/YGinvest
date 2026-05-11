-- 배당 이벤트 (다음 ex-date + 금액). 워커가 fetch_corporate_data로 yfinance에서 채움.
create table public.dividend_events (
  id uuid primary key default gen_random_uuid(),
  symbol text not null references public.stocks(symbol),
  ex_date date not null,
  payable_date date,
  amount_per_share numeric(20,8) not null check (amount_per_share > 0),
  currency text not null check (currency in ('KRW', 'USD')),
  applied boolean not null default false,
  applied_at timestamptz,
  created_at timestamptz not null default now(),
  unique (symbol, ex_date)
);

create index dividend_events_unapplied_idx
  on public.dividend_events (ex_date) where not applied;

alter table public.dividend_events enable row level security;

create policy "dividend_events: 누구나 읽기"
  on public.dividend_events for select
  to authenticated
  using (true);
-- INSERT/UPDATE는 service_role(워커)만. authenticated 권한 없음.

comment on table public.dividend_events is '배당 이벤트 (워커가 yfinance에서 fetch)';


-- 배당 입금 내역 (사용자별)
create table public.dividend_payouts (
  id uuid primary key default gen_random_uuid(),
  portfolio_id uuid not null references public.portfolios(id) on delete cascade,
  symbol text not null references public.stocks(symbol),
  ex_date date not null,
  qty numeric(20,4) not null check (qty > 0),
  gross numeric(20,4) not null check (gross > 0),  -- 세전 (qty * amount_per_share)
  tax numeric(20,4) not null check (tax >= 0),     -- 원천징수
  net numeric(20,4) not null check (net > 0),      -- 실수령
  currency text not null check (currency in ('KRW', 'USD')),
  executed_at timestamptz not null default now()
);

create index dividend_payouts_portfolio_idx
  on public.dividend_payouts (portfolio_id, executed_at desc);

alter table public.dividend_payouts enable row level security;

create policy "dividend_payouts: 본인 읽기"
  on public.dividend_payouts for select
  to authenticated
  using (
    portfolio_id in (
      select id from public.portfolios where user_id = auth.uid()
    )
  );

comment on table public.dividend_payouts is '배당 입금 내역 (워커가 apply_dividend로 기록)';


-- 코퍼릿 액션 (분할/병합)
create table public.corporate_actions (
  id uuid primary key default gen_random_uuid(),
  symbol text not null references public.stocks(symbol),
  action_type text not null check (action_type in ('split', 'reverse_split')),
  ratio numeric(20,8) not null check (ratio > 0),  -- 2:1 분할 → 2.0, 1:2 병합 → 0.5
  ex_date date not null,
  applied boolean not null default false,
  applied_at timestamptz,
  created_at timestamptz not null default now(),
  unique (symbol, ex_date, action_type)
);

create index corporate_actions_unapplied_idx
  on public.corporate_actions (ex_date) where not applied;

alter table public.corporate_actions enable row level security;

create policy "corporate_actions: 누구나 읽기"
  on public.corporate_actions for select
  to authenticated
  using (true);
-- INSERT/UPDATE는 service_role(워커)만.

comment on table public.corporate_actions is '분할/병합 (워커가 yfinance에서 fetch)';
