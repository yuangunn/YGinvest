-- holdings: 본인 + 같은 방 멤버 읽기 (방 멤버는 Plan #5에서 추가). 쓰기는 서버만.
alter table public.holdings enable row level security;

create policy "holdings: 본인 읽기"
  on public.holdings for select
  to authenticated
  using (
    portfolio_id in (select id from public.portfolios where user_id = auth.uid())
  );

-- orders: 본인만 읽기. INSERT는 PG 함수(security definer)가 처리.
alter table public.orders enable row level security;

create policy "orders: 본인 읽기"
  on public.orders for select
  to authenticated
  using (
    portfolio_id in (select id from public.portfolios where user_id = auth.uid())
  );

-- trades: 본인 + (방 멤버는 Plan #5)
alter table public.trades enable row level security;

create policy "trades: 본인 읽기"
  on public.trades for select
  to authenticated
  using (
    portfolio_id in (select id from public.portfolios where user_id = auth.uid())
  );

-- fx_transactions: 본인만
alter table public.fx_transactions enable row level security;

create policy "fx_transactions: 본인 읽기"
  on public.fx_transactions for select
  to authenticated
  using (
    portfolio_id in (select id from public.portfolios where user_id = auth.uid())
  );
