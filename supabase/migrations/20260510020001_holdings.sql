create table public.holdings (
  portfolio_id uuid not null references public.portfolios(id) on delete cascade,
  symbol text not null references public.stocks(symbol),
  quantity numeric(20,4) not null check (quantity > 0),
  avg_cost numeric(20,4) not null check (avg_cost >= 0),  -- 체결 통화 기준
  updated_at timestamptz not null default now(),
  primary key (portfolio_id, symbol)
);

create index holdings_symbol_idx on public.holdings (symbol);

comment on table public.holdings is '포트폴리오별 현재 보유 종목 (수량/평단가)';
