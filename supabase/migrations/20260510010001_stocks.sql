create table public.stocks (
  symbol text primary key,
  market text not null check (market in ('KRX_KS', 'KRX_KQ', 'NASDAQ', 'NYSE')),
  currency text not null check (currency in ('KRW', 'USD')),
  name text not null,                  -- 영문/원문명 (Apple Inc., 삼성전자)
  name_ko text,                        -- 한국어 표기 (Apple은 NULL 허용)
  sector text,
  market_cap numeric(24,2),
  per numeric(10,4),
  last_price numeric(20,4),
  last_price_at timestamptz,
  fifty_two_week_high numeric(20,4),
  fifty_two_week_low numeric(20,4),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index stocks_market_idx on public.stocks (market);
create index stocks_active_idx on public.stocks (is_active) where is_active;
create index stocks_market_cap_idx on public.stocks (market_cap desc nulls last);

-- 검색용 trigram 인덱스 (이름 부분일치)
create extension if not exists pg_trgm;
create index stocks_name_trgm_idx on public.stocks using gin (name gin_trgm_ops);
create index stocks_name_ko_trgm_idx on public.stocks using gin (name_ko gin_trgm_ops) where name_ko is not null;

comment on table public.stocks is '종목 마스터 캐시 (Plan #2)';
