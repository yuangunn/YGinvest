create table public.watchlists (
  portfolio_id uuid not null references public.portfolios(id) on delete cascade,
  symbol text not null references public.stocks(symbol) on delete cascade,
  added_at timestamptz not null default now(),
  primary key (portfolio_id, symbol)
);

create index watchlists_portfolio_idx on public.watchlists (portfolio_id, added_at desc);

alter table public.watchlists enable row level security;

create policy "watchlists: 본인 읽기"
  on public.watchlists for select
  to authenticated
  using (
    portfolio_id in (select id from public.portfolios where user_id = auth.uid())
  );

create policy "watchlists: 본인 추가"
  on public.watchlists for insert
  to authenticated
  with check (
    portfolio_id in (select id from public.portfolios where user_id = auth.uid())
  );

create policy "watchlists: 본인 삭제"
  on public.watchlists for delete
  to authenticated
  using (
    portfolio_id in (select id from public.portfolios where user_id = auth.uid())
  );

comment on table public.watchlists is '사용자별 관심종목. 포트폴리오 단위(글로벌+방).';
