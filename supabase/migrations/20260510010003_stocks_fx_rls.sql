-- stocks: 누구나 읽기 (검색 + 상세 페이지가 anon에서도 SSR 가능하도록)
alter table public.stocks enable row level security;

create policy "stocks: 누구나 읽기"
  on public.stocks for select
  to anon, authenticated
  using (true);

-- INSERT/UPDATE/DELETE는 워커 (service_role)만

-- fx_rates: 누구나 읽기
alter table public.fx_rates enable row level security;

create policy "fx_rates: 누구나 읽기"
  on public.fx_rates for select
  to anon, authenticated
  using (true);
