create table public.recommendations (
  id uuid primary key default gen_random_uuid(),
  category text not null check (category in (
    'top_gainers', 'top_losers', 'volume_surge',
    'near_52w_high', 'low_per_value'
  )),
  market_scope text not null check (market_scope in ('KR', 'US', 'ALL')),
  symbol text not null references public.stocks(symbol),
  rank int not null check (rank >= 1 and rank <= 50),
  score numeric(20,8) not null,            -- 카테고리별 점수 (change_pct, ratio, per 등)
  reason text,                              -- 짧은 설명 — UI 카드에 표시
  computed_at timestamptz not null default now(),
  -- (category, market_scope, symbol) UNIQUE: 같은 카테고리에서 같은 종목 중복 방지
  unique (category, market_scope, symbol)
);

-- 한 카테고리 + scope 조회용 (rank로 정렬된 결과)
create index recommendations_category_idx
  on public.recommendations (category, market_scope, rank);

-- 최신 계산 시각 조회용 (UI에서 "방금 갱신" 표시 가능)
create index recommendations_computed_at_idx
  on public.recommendations (computed_at desc);

alter table public.recommendations enable row level security;

-- 모든 인증 사용자가 추천 조회 가능 (개인화 X — v2)
create policy "recommendations: 누구나 읽기"
  on public.recommendations for select
  to authenticated
  using (true);
-- INSERT/UPDATE/DELETE는 service_role(워커)만

comment on table public.recommendations is '룰 기반 종목 추천 캐시 (워커가 1시간마다 재계산)';
