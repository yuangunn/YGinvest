-- Plan #40: Phase 3 게임 확장 — 업적 / 일일 미션 / 결혼 / 자녀 / 노후 연금.

-- ───── game_achievements: 사용자가 unlock한 업적 ────────
create table if not exists public.game_achievements (
  user_id uuid not null references public.profiles(id) on delete cascade,
  achievement_key text not null,
  unlocked_at timestamptz not null default now(),
  primary key (user_id, achievement_key)
);

alter table public.game_achievements enable row level security;
drop policy if exists game_achievements_self on public.game_achievements;
create policy game_achievements_self on public.game_achievements
  for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

comment on table public.game_achievements is 'Plan #40: 업적 해금 기록';

-- ───── game_daily_missions: 오늘의 미션 진행 상황 ───────
create table if not exists public.game_daily_missions (
  user_id uuid not null references public.profiles(id) on delete cascade,
  mission_key text not null,
  date_key date not null,            -- 한국 시간 기준 날짜 (YYYY-MM-DD)
  progress int not null default 0,
  target int not null,
  completed boolean not null default false,
  completed_at timestamptz,
  reward_points int not null default 0,
  primary key (user_id, mission_key, date_key)
);

alter table public.game_daily_missions enable row level security;
drop policy if exists game_daily_missions_self on public.game_daily_missions;
create policy game_daily_missions_self on public.game_daily_missions
  for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index if not exists game_daily_missions_user_date_idx
  on public.game_daily_missions (user_id, date_key desc);

comment on table public.game_daily_missions is 'Plan #40: 일일 미션 진행 (24시간 갱신)';

-- ───── game_characters에 인생 단계 컬럼 추가 ─────────────
alter table public.game_characters
  add column if not exists is_married boolean not null default false,
  add column if not exists married_at timestamptz,
  add column if not exists children_count int not null default 0,
  add column if not exists is_retired boolean not null default false,
  add column if not exists retired_at timestamptz;

comment on column public.game_characters.is_married is 'Plan #40: 결혼 여부';
comment on column public.game_characters.children_count is 'Plan #40: 자녀 수';
comment on column public.game_characters.is_retired is 'Plan #40: 은퇴 여부 (60세 도달)';

-- ───── game_pension: 은퇴 후 연금 지급 기록 ──────────────
-- 정규직 근속 연수에 따라 매달 연금 지급. tick 시 자동 적립.
create table if not exists public.game_pension_info (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  -- 정규직 누적 일수 (game_day 기준)
  fulltime_total_days int not null default 0,
  -- 마지막 연금 지급 game_day
  last_payout_day int,
  -- 월 연금액 (정규직 근속에 따라)
  monthly_pension numeric(20,2) not null default 0
);

alter table public.game_pension_info enable row level security;
drop policy if exists game_pension_self on public.game_pension_info;
create policy game_pension_self on public.game_pension_info
  for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
