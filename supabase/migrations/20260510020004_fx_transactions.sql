create table public.fx_transactions (
  id uuid primary key default gen_random_uuid(),
  portfolio_id uuid not null references public.portfolios(id) on delete cascade,
  from_currency text not null check (from_currency in ('KRW', 'USD')),
  to_currency text not null check (to_currency in ('KRW', 'USD')),
  from_amount numeric(20,4) not null check (from_amount > 0),
  to_amount numeric(20,4) not null check (to_amount > 0),
  rate numeric(20,8) not null check (rate > 0),
  fee_pct numeric(8,4) not null,
  executed_at timestamptz not null default now(),
  check (from_currency <> to_currency)
);

create index fx_transactions_portfolio_idx on public.fx_transactions (portfolio_id, executed_at desc);

comment on table public.fx_transactions is '환전 내역 (KRW↔USD)';
