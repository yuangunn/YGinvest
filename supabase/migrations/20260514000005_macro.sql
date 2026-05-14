-- Plan #26: 거시경제 데이터 + 경제 캘린더.
-- 워커가 매일 yfinance에서 fetch.

-- ───── 거시경제 지표 (시계열) ─────────────────────────────────────────
create table public.macro_indicators (
  symbol text not null,           -- "TNX10Y" / "USDKRW" / "OIL_WTI" / "GOLD" / "DXY" / "VIX" / "KOSPI" / "SP500" / "NASDAQ"
  ts date not null,               -- 일별 값 (장 종가)
  value numeric(20, 6) not null,
  fetched_at timestamptz not null default now(),
  primary key (symbol, ts)
);

create index macro_indicators_symbol_ts_idx
  on public.macro_indicators (symbol, ts desc);

alter table public.macro_indicators enable row level security;

create policy macro_indicators_select_all
  on public.macro_indicators for select
  to authenticated
  using (true);

comment on table public.macro_indicators is
  'Plan #26: 거시경제 시계열 — yfinance에서 일별 fetch';


-- ───── 거시경제 지표 메타 (라벨/단위/그룹) ──────────────────────────
create table public.macro_meta (
  symbol text primary key,
  yf_ticker text not null,         -- yfinance 심볼 (예: "^TNX")
  name_ko text not null,
  unit text not null,              -- "%", "KRW/USD", "USD/bbl" 등
  group_name text not null,        -- "rate" | "fx" | "commodity" | "index" | "risk"
  value_multiplier numeric(10, 6) not null default 1, -- ^TNX는 *10 / 10 처리 필요
  description_ko text,
  sort_order int not null default 0
);

alter table public.macro_meta enable row level security;
create policy macro_meta_select_all
  on public.macro_meta for select
  to authenticated
  using (true);

insert into public.macro_meta
  (symbol, yf_ticker, name_ko, unit, group_name, value_multiplier, description_ko, sort_order)
values
  ('TNX10Y', '^TNX',     '미국 10년 국채 수익률', '%',       'rate',      1,  '안전자산 수익률. 상승 → 주식 약세 압력', 10),
  ('FED_FUNDS', '^IRX',  '미국 단기금리 (3M)',    '%',       'rate',      1,  '연준 정책금리 proxy', 20),
  ('KR_BASE_RATE', '',   '한국은행 기준금리',     '%',       'rate',      1,  '한은 금통위 결정', 30),
  ('USDKRW', 'KRW=X',    '원/달러 환율',          'KRW',     'fx',        1,  '약세 → 수출주 우호', 40),
  ('DXY', 'DX-Y.NYB',    '달러 인덱스',            '',        'fx',        1,  '주요 6개 통화 대비 달러 강도', 50),
  ('OIL_WTI', 'CL=F',    'WTI 유가',              'USD/bbl', 'commodity', 1,  '에너지 비용 → 인플레이션', 60),
  ('GOLD', 'GC=F',       '금 선물',                'USD/oz',  'commodity', 1,  '안전자산. 인플레/위기 hedge', 70),
  ('VIX', '^VIX',        '변동성 지수 (공포지수)', '',        'risk',      1,  'S&P500 옵션 IV. >30이면 패닉', 80),
  ('KOSPI', '^KS11',     'KOSPI',                  '',        'index',     1,  '한국 종합주가지수', 90),
  ('SP500', '^GSPC',     'S&P 500',                '',        'index',     1,  '미국 대표지수', 100),
  ('NASDAQ', '^IXIC',    'NASDAQ',                 '',        'index',     1,  '미국 기술주 중심', 110)
on conflict (symbol) do nothing;


-- ───── 경제 캘린더 (예정 이벤트) ───────────────────────────────────────
create table public.economic_events (
  id uuid primary key default gen_random_uuid(),
  event_date date not null,
  country text not null check (country in ('KR', 'US', 'GLOBAL')),
  kind text not null,             -- "fomc" | "kr_mpc" | "cpi" | "employment" | "earnings_szn" | "other"
  title text not null,
  description_ko text,
  importance int not null default 2 check (importance between 1 and 3),  -- 1=낮음 3=높음
  source_url text
);

create index economic_events_date_idx on public.economic_events (event_date);

alter table public.economic_events enable row level security;
create policy economic_events_select_all
  on public.economic_events for select
  to authenticated
  using (true);

-- 2026년 주요 일정 seed (FOMC 8회 / 한은 금통위 8회 / 미국 CPI 매월 / 미국 고용 매월)
-- 실제 일정은 발표 때마다 정확히 다르지만, 학습용 가이드로 충분.
insert into public.economic_events (event_date, country, kind, title, description_ko, importance) values
  -- FOMC 2026 (실제 일정 기준)
  ('2026-01-28', 'US', 'fomc', 'FOMC 금리결정 (1월)', '연준 정책금리 결정 + 점도표', 3),
  ('2026-03-18', 'US', 'fomc', 'FOMC 금리결정 (3월)', '연준 정책금리 결정 + 경제 전망 (SEP)', 3),
  ('2026-04-29', 'US', 'fomc', 'FOMC 금리결정 (4월)', '연준 정책금리 결정', 3),
  ('2026-06-17', 'US', 'fomc', 'FOMC 금리결정 (6월)', '연준 정책금리 결정 + 점도표', 3),
  ('2026-07-29', 'US', 'fomc', 'FOMC 금리결정 (7월)', '연준 정책금리 결정', 3),
  ('2026-09-16', 'US', 'fomc', 'FOMC 금리결정 (9월)', '연준 정책금리 결정 + 점도표', 3),
  ('2026-11-04', 'US', 'fomc', 'FOMC 금리결정 (11월)', '연준 정책금리 결정', 3),
  ('2026-12-09', 'US', 'fomc', 'FOMC 금리결정 (12월)', '연준 정책금리 결정 + 점도표', 3),

  -- 한은 금통위 2026 (8회)
  ('2026-01-15', 'KR', 'kr_mpc', '한은 금통위 (1월)', '한국 기준금리 결정', 3),
  ('2026-02-26', 'KR', 'kr_mpc', '한은 금통위 (2월)', '한국 기준금리 결정 + 전망', 3),
  ('2026-04-09', 'KR', 'kr_mpc', '한은 금통위 (4월)', '한국 기준금리 결정', 3),
  ('2026-05-28', 'KR', 'kr_mpc', '한은 금통위 (5월)', '한국 기준금리 결정 + 전망', 3),
  ('2026-07-09', 'KR', 'kr_mpc', '한은 금통위 (7월)', '한국 기준금리 결정', 3),
  ('2026-08-27', 'KR', 'kr_mpc', '한은 금통위 (8월)', '한국 기준금리 결정 + 전망', 3),
  ('2026-10-15', 'KR', 'kr_mpc', '한은 금통위 (10월)', '한국 기준금리 결정', 3),
  ('2026-11-26', 'KR', 'kr_mpc', '한은 금통위 (11월)', '한국 기준금리 결정 + 전망', 3),

  -- 미국 CPI 발표 (매월 둘째 주 화요일/수요일 — 대략)
  ('2026-05-13', 'US', 'cpi', '미국 CPI (4월)', '4월 소비자물가지수 발표', 3),
  ('2026-06-11', 'US', 'cpi', '미국 CPI (5월)', '5월 소비자물가지수 발표', 3),
  ('2026-07-15', 'US', 'cpi', '미국 CPI (6월)', '6월 소비자물가지수 발표', 3),
  ('2026-08-12', 'US', 'cpi', '미국 CPI (7월)', '7월 소비자물가지수 발표', 3),
  ('2026-09-10', 'US', 'cpi', '미국 CPI (8월)', '8월 소비자물가지수 발표', 3),
  ('2026-10-14', 'US', 'cpi', '미국 CPI (9월)', '9월 소비자물가지수 발표', 3),
  ('2026-11-12', 'US', 'cpi', '미국 CPI (10월)', '10월 소비자물가지수 발표', 3),
  ('2026-12-10', 'US', 'cpi', '미국 CPI (11월)', '11월 소비자물가지수 발표', 3),

  -- 미국 고용지표 (매월 첫째 주 금요일)
  ('2026-05-02', 'US', 'employment', '미국 NFP (4월)', '비농업 고용 + 실업률 + 시간당 임금', 3),
  ('2026-06-06', 'US', 'employment', '미국 NFP (5월)', '비농업 고용 + 실업률 + 시간당 임금', 3),
  ('2026-07-03', 'US', 'employment', '미국 NFP (6월)', '비농업 고용 + 실업률 + 시간당 임금', 3),
  ('2026-08-07', 'US', 'employment', '미국 NFP (7월)', '비농업 고용 + 실업률 + 시간당 임금', 3),
  ('2026-09-04', 'US', 'employment', '미국 NFP (8월)', '비농업 고용 + 실업률 + 시간당 임금', 3),
  ('2026-10-02', 'US', 'employment', '미국 NFP (9월)', '비농업 고용 + 실업률 + 시간당 임금', 3),
  ('2026-11-06', 'US', 'employment', '미국 NFP (10월)', '비농업 고용 + 실업률 + 시간당 임금', 3),
  ('2026-12-04', 'US', 'employment', '미국 NFP (11월)', '비농업 고용 + 실업률 + 시간당 임금', 3),

  -- Earnings 시즌
  ('2026-04-13', 'US', 'earnings_szn', '미국 Q1 어닝 시즌 시작', '대형 은행부터 차례로 실적 발표', 2),
  ('2026-07-13', 'US', 'earnings_szn', '미국 Q2 어닝 시즌 시작', '대형 은행부터 차례로 실적 발표', 2),
  ('2026-10-12', 'US', 'earnings_szn', '미국 Q3 어닝 시즌 시작', '대형 은행부터 차례로 실적 발표', 2),
  ('2026-12-15', 'US', 'earnings_szn', '미국 Q4 어닝 시즌 prep', 'Pre-announcement 빈번 — 산타랠리 vs 변동성', 2)
on conflict do nothing;

comment on table public.economic_events is
  'Plan #26: 경제 캘린더 — 미국 FOMC/CPI/NFP + 한국 금통위. 2026년 일정 seed';
