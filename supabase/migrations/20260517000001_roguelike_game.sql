-- Plan #33: 로그라이크 게임 — 인생 시뮬레이션 + 매도 트레이너.
--
-- 핵심 설계:
-- - 게임 시간 = 실제 시간 (1일 = 1일). 페이스 극도로 느림.
-- - 사용자가 30일 스케줄 미리 짜두면 캐릭터가 알아서 진행.
-- - 본 앱 종목 시세를 그대로 차용해 게임 내 매매. 잔고는 완전 분리 (사행성 회피).
-- - 5% 수익 시 환생 가능 → 영구 업그레이드 포인트.
--
-- 모든 테이블 RLS: 본인만 read/write.
-- Idempotent: 모든 create는 if not exists, policy는 drop+create 패턴.

-- ───── game_characters: 현재 라이프 캐릭터 ────────────────
create table if not exists public.game_characters (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  name text not null,
  gender text not null check (gender in ('male', 'female', 'other')),
  -- 학력: highschool / bachelor (해금 후 선택 가능)
  education_level text not null default 'highschool'
    check (education_level in ('highschool', 'bachelor')),
  -- 직업: unemployed / parttime / fulltime (직급은 별도 컬럼)
  job_type text not null default 'unemployed'
    check (job_type in ('unemployed', 'parttime', 'fulltime')),
  job_title text,            -- "편의점 알바", "사원", "대리", "과장" 등
  job_started_at timestamptz,  -- 알바/직장 시작일 (n년차 계산용)
  -- 자원
  cash numeric(20,2) not null default 10000000,  -- 시작 1,000만원 (KRW)
  fatigue int not null default 0 check (fatigue >= 0 and fatigue <= 100),
  intelligence int not null default 0,  -- 자기계발 누적 시간
  happiness int not null default 50 check (happiness >= 0 and happiness <= 100),
  -- 게임 진행
  life_started_at timestamptz not null default now(),
  current_day int not null default 0,  -- 시작 후 며칠
  starting_cash numeric(20,2) not null default 10000000,  -- 환생 수익률 계산용
  -- 메타
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.game_characters enable row level security;
drop policy if exists game_characters_self on public.game_characters;
create policy game_characters_self on public.game_characters
  for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

comment on table public.game_characters is 'Plan #33: 현재 진행 중인 게임 라이프 캐릭터';

-- ───── game_schedule: 30일 일정 ──────────────────────────────
create table if not exists public.game_schedule (
  user_id uuid not null references public.profiles(id) on delete cascade,
  game_day int not null check (game_day >= 0),
  activity text not null check (activity in (
    'parttime', 'fulltime', 'study', 'rest', 'shopping',
    'dining', 'healing', 'exercise', 'job_search', 'free'
  )),
  executed_at timestamptz,
  result_summary text,
  primary key (user_id, game_day)
);

alter table public.game_schedule enable row level security;
drop policy if exists game_schedule_self on public.game_schedule;
create policy game_schedule_self on public.game_schedule
  for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index if not exists game_schedule_day_idx on public.game_schedule (user_id, game_day);

comment on table public.game_schedule is 'Plan #33: 30일치 미리 짜둔 스케줄';

-- ───── game_holdings ──────────────────────────────────────
create table if not exists public.game_holdings (
  user_id uuid not null references public.profiles(id) on delete cascade,
  symbol text not null references public.stocks(symbol),
  quantity numeric(20,4) not null check (quantity > 0),
  avg_cost numeric(20,4) not null check (avg_cost > 0),
  acquired_at timestamptz not null default now(),
  primary key (user_id, symbol)
);

alter table public.game_holdings enable row level security;
drop policy if exists game_holdings_self on public.game_holdings;
create policy game_holdings_self on public.game_holdings
  for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

comment on table public.game_holdings is 'Plan #33: 게임 내 주식 보유 (본 앱 stocks 시세 공유, 잔고 분리)';

-- ───── game_real_estate_holdings ─────────────────────────
create table if not exists public.game_real_estate_holdings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  region_code text not null,
  purchase_price numeric(20,2) not null,
  jeonse_amount numeric(20,2) not null default 0,
  acquired_at timestamptz not null default now()
);

alter table public.game_real_estate_holdings enable row level security;
drop policy if exists game_re_holdings_self on public.game_real_estate_holdings;
create policy game_re_holdings_self on public.game_real_estate_holdings
  for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index if not exists game_re_holdings_user_idx on public.game_real_estate_holdings (user_id);

-- ───── game_rebirths ─────────────────────────────────────
create table if not exists public.game_rebirths (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  rebirth_number int not null,
  starting_cash numeric(20,2) not null,
  ending_cash numeric(20,2) not null,
  total_assets numeric(20,2) not null,
  return_pct numeric(10,4) not null,
  days_played int not null,
  points_earned int not null,
  rebirthed_at timestamptz not null default now()
);

alter table public.game_rebirths enable row level security;
drop policy if exists game_rebirths_self on public.game_rebirths;
create policy game_rebirths_self on public.game_rebirths
  for select to authenticated
  using (auth.uid() = user_id);
drop policy if exists game_rebirths_insert on public.game_rebirths;
create policy game_rebirths_insert on public.game_rebirths
  for insert to authenticated
  with check (auth.uid() = user_id);

create index if not exists game_rebirths_user_idx on public.game_rebirths (user_id, rebirthed_at desc);

-- ───── game_unlocks ──────────────────────────────────────
create table if not exists public.game_unlocks (
  user_id uuid not null references public.profiles(id) on delete cascade,
  unlock_key text not null,
  level int not null default 1 check (level >= 1),
  unlocked_at timestamptz not null default now(),
  primary key (user_id, unlock_key)
);

alter table public.game_unlocks enable row level security;
drop policy if exists game_unlocks_self on public.game_unlocks;
create policy game_unlocks_self on public.game_unlocks
  for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ───── profiles 확장 ────────────────────────────────────
alter table public.profiles
  add column if not exists game_points int not null default 0,
  add column if not exists game_rebirth_count int not null default 0;

comment on column public.profiles.game_points is 'Plan #33: 환생 누적 포인트 (해금 화폐)';
comment on column public.profiles.game_rebirth_count is 'Plan #33: 환생 횟수';

-- ───── real_estate_listings ─────────────────────────────
create table if not exists public.real_estate_listings (
  region_code text primary key,
  region_name text not null,
  property_type text not null,
  base_price numeric(20,2) not null,
  jeonse_ratio numeric(4,3) not null default 0.65,
  daily_volatility numeric(4,3) not null default 0.005,
  kospi_beta numeric(4,3) not null default 0.3,
  weekly_index numeric(6,4) not null default 1.0,
  weekly_index_updated_at timestamptz,
  is_active boolean not null default true
);

alter table public.real_estate_listings enable row level security;
drop policy if exists real_estate_listings_read on public.real_estate_listings;
create policy real_estate_listings_read on public.real_estate_listings
  for select to authenticated, anon using (true);

-- ───── seed: 10개 지역 ─────────────────────────────────
insert into public.real_estate_listings
  (region_code, region_name, property_type, base_price, jeonse_ratio, daily_volatility, kospi_beta)
values
  ('rural_studio', '시골 원룸', 'studio', 30000000, 0.70, 0.003, 0.10),
  ('cheongju_villa', '청주 빌라', 'villa', 80000000, 0.72, 0.004, 0.15),
  ('gwangju_apt', '광주 아파트', 'apartment', 150000000, 0.70, 0.005, 0.20),
  ('daejeon_apt', '대전 아파트', 'apartment', 250000000, 0.68, 0.006, 0.25),
  ('daegu_apt', '대구 아파트', 'apartment', 300000000, 0.65, 0.007, 0.30),
  ('incheon_apt', '인천 아파트', 'apartment', 400000000, 0.65, 0.007, 0.30),
  ('busan_apt', '부산 아파트', 'apartment', 500000000, 0.60, 0.008, 0.35),
  ('suwon_apt', '수원/성남 아파트', 'apartment', 700000000, 0.60, 0.010, 0.45),
  ('seoul_gangbuk', '서울 강북 아파트', 'apartment', 1000000000, 0.55, 0.012, 0.60),
  ('seoul_gangnam', '서울 강남 아파트', 'apartment', 2500000000, 0.50, 0.015, 0.80)
on conflict (region_code) do nothing;

comment on table public.real_estate_listings is 'Plan #33: 게임용 부동산 지역별 base 시세 + R-ONE 주간지수';
