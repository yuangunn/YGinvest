create table public.orders (
  id uuid primary key default gen_random_uuid(),
  portfolio_id uuid not null references public.portfolios(id) on delete cascade,
  symbol text not null references public.stocks(symbol),
  side text not null check (side in ('buy', 'sell')),
  order_type text not null check (order_type in ('market', 'limit')),
  quantity numeric(20,4) not null check (quantity > 0),
  limit_price numeric(20,4),
  status text not null check (status in ('pending', 'filled', 'cancelled', 'rejected', 'expired')),
  filled_quantity numeric(20,4) not null default 0 check (filled_quantity >= 0 and filled_quantity <= quantity),
  filled_avg_price numeric(20,4),
  fee_total numeric(20,4) not null default 0,
  reserved_amount numeric(20,4),     -- 지정가 주문 시 잔고에서 차감한 액수 (취소/체결 시 환원)
  reserved_currency text check (reserved_currency in ('KRW', 'USD')),
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  filled_at timestamptz,
  cancelled_at timestamptz,
  rejection_reason text
);

create index orders_portfolio_idx on public.orders (portfolio_id, created_at desc);
create index orders_pending_idx on public.orders (status, expires_at)
  where status = 'pending';
create index orders_symbol_pending_idx on public.orders (symbol, status)
  where status = 'pending';

-- 지정가 주문은 limit_price 필수
alter table public.orders add constraint orders_limit_has_price check (
  order_type <> 'limit' or limit_price is not null
);

alter table public.orders add constraint orders_terminal_state_consistent check (
  (status <> 'filled' or filled_at is not null) and
  (status <> 'cancelled' or cancelled_at is not null) and
  (status <> 'rejected' or rejection_reason is not null)
);

alter table public.orders add constraint orders_reserved_pair_coherent check (
  (reserved_amount is null and reserved_currency is null)
  or (reserved_amount is not null and reserved_currency is not null)
);

comment on table public.orders is '주문 (시장가/지정가). 매칭 엔진이 펜딩을 1분마다 처리';
