-- Plan #16: recommendation click tracking — clicks per (category, symbol, user).
-- 추후 ML 기반 추천에서 사용자 행동 시그널로 활용 가능.

create table public.recommendation_clicks (
  id bigserial primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  portfolio_id uuid references public.portfolios(id) on delete set null,
  category text not null,        -- top_gainers / volume_surge / personalized / ...
  market_scope text,             -- KR / US / null (personalized은 혼합)
  symbol text not null,
  rank int,                       -- 클릭 시점의 추천 순위 (1-N)
  clicked_at timestamptz not null default now()
);

create index recommendation_clicks_user_idx
  on public.recommendation_clicks (user_id, clicked_at desc);
create index recommendation_clicks_symbol_idx
  on public.recommendation_clicks (symbol, clicked_at desc);
create index recommendation_clicks_category_idx
  on public.recommendation_clicks (category, clicked_at desc);

alter table public.recommendation_clicks enable row level security;

-- INSERT: 본인의 클릭만
create policy recommendation_clicks_insert_own
  on public.recommendation_clicks for insert
  to authenticated
  with check (auth.uid() = user_id);

-- SELECT: 본인 클릭만 (개인 활동 분석용)
create policy recommendation_clicks_select_own
  on public.recommendation_clicks for select
  to authenticated
  using (auth.uid() = user_id);

comment on table public.recommendation_clicks is
  'Plan #16: 추천 카드 클릭 이벤트 트래킹';
