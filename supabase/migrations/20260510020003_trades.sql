create table public.trades (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  portfolio_id uuid not null references public.portfolios(id) on delete cascade,
  symbol text not null references public.stocks(symbol),
  side text not null check (side in ('buy', 'sell')),
  quantity numeric(20,4) not null check (quantity > 0),
  price numeric(20,4) not null check (price > 0),
  currency text not null check (currency in ('KRW', 'USD')),
  fee numeric(20,4) not null default 0,
  executed_at timestamptz not null default now()
);

create index trades_portfolio_idx on public.trades (portfolio_id, executed_at desc);
create index trades_order_idx on public.trades (order_id);

comment on table public.trades is '체결 기록 (감사용). 한 주문에 여러 체결 가능 (현재 v1은 1:1)';
