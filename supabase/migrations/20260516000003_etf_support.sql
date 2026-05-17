-- Plan #32: ETF 지원 — stocks 테이블 확장 + etf_holdings 테이블 신규.
--
-- yfinance는 ETF와 주식을 동일한 Ticker API로 다루므로, 같은 stocks 테이블에
-- instrument_type만 추가해 구분한다. ETF 전용 메타(운용보수/AUM/추종지수)는
-- nullable 컬럼으로 stocks에 직접 추가 (별도 테이블 분리 X — 1:1 관계).
--
-- ETF 구성 종목(holdings)은 별도 etf_holdings 테이블에 정규화.

-- ───── stocks 확장 ─────────────────────────────────────────
alter table public.stocks
  add column if not exists instrument_type text not null default 'stock'
  check (instrument_type in ('stock', 'etf'));

alter table public.stocks
  add column if not exists expense_ratio numeric(6,4),  -- 0.0945 = 0.945%
  add column if not exists aum numeric(24,2),           -- 운용자산 (총자산)
  add column if not exists underlying_index text,        -- 추종 지수 ('S&P 500', 'KOSPI 200', ...)
  add column if not exists etf_category text,            -- broad_market / sector / dividend / bond / commodity / thematic / leveraged_inverse / international
  add column if not exists fund_family text,             -- 운용사 ('Vanguard', 'iShares', 'KODEX', 'TIGER', ...)
  add column if not exists inception_date date;          -- 설정일

create index if not exists stocks_instrument_type_idx
  on public.stocks (instrument_type);
create index if not exists stocks_etf_category_idx
  on public.stocks (etf_category) where instrument_type = 'etf';

comment on column public.stocks.instrument_type is 'Plan #32: stock 또는 etf';
comment on column public.stocks.expense_ratio is 'Plan #32: ETF 운용보수 (소수, 0.0945 = 0.945%)';
comment on column public.stocks.aum is 'Plan #32: ETF 운용자산 (Total Net Assets, 통화는 currency 따름)';
comment on column public.stocks.underlying_index is 'Plan #32: ETF 추종 지수 (S&P 500, KOSPI 200 등)';
comment on column public.stocks.etf_category is 'Plan #32: ETF 카테고리 분류';
comment on column public.stocks.fund_family is 'Plan #32: ETF 운용사';

-- ───── etf_holdings 테이블 ──────────────────────────────────
-- ETF 구성 종목 Top 10 (또는 그 이상). yfinance는 일부 ETF만 제공.
create table if not exists public.etf_holdings (
  etf_symbol text not null references public.stocks(symbol) on delete cascade,
  rank int not null check (rank >= 1 and rank <= 100),
  holding_symbol text references public.stocks(symbol) on delete set null,
  -- holding_symbol이 stocks에 없을 수도 있음 (비상장/외국 종목). 이때 이름만 저장.
  holding_name text not null,
  weight numeric(6,4) not null check (weight >= 0 and weight <= 1),  -- 0.0723 = 7.23%
  updated_at timestamptz not null default now(),
  primary key (etf_symbol, rank)
);

create index if not exists etf_holdings_etf_idx on public.etf_holdings (etf_symbol);
create index if not exists etf_holdings_holding_idx
  on public.etf_holdings (holding_symbol)
  where holding_symbol is not null;

-- RLS: 모든 사용자 read-only
alter table public.etf_holdings enable row level security;

drop policy if exists etf_holdings_read on public.etf_holdings;
create policy etf_holdings_read on public.etf_holdings
  for select
  to authenticated, anon
  using (true);

comment on table public.etf_holdings is 'Plan #32: ETF 구성 종목 Top N (yfinance 기반)';
comment on column public.etf_holdings.weight is 'Plan #32: 구성 비중 (소수, 0.0723 = 7.23%)';
