-- Plan #24: Earnings calendar — 종목별 다음 실적 발표일.
-- 워커가 매일 새벽 yfinance에서 fetch.

create table public.earnings_events (
  symbol text not null references public.stocks(symbol) on delete cascade,
  report_date date not null,
  eps_estimate numeric(20, 4),
  eps_actual numeric(20, 4),
  revenue_estimate numeric(24, 2),
  revenue_actual numeric(24, 2),
  surprise_pct numeric(10, 4),
  fetched_at timestamptz not null default now(),
  primary key (symbol, report_date)
);

create index earnings_date_idx on public.earnings_events (report_date);
create index earnings_symbol_idx on public.earnings_events (symbol, report_date desc);

alter table public.earnings_events enable row level security;

create policy earnings_select_all
  on public.earnings_events for select
  to authenticated
  using (true);

comment on table public.earnings_events is
  'Plan #24: 실적 발표 이벤트. yfinance Ticker.earnings_dates에서 fetch.';
