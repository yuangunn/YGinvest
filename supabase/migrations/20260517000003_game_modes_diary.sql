-- Plan #36: 게임 컨셉 변경 — 30일 스케줄 → 3가지 모드 + 일기 시스템.
--
-- 변경 사유: 매번 스케줄 짜는 부담이 크다. 사용자는 모드만 선택,
-- 캐릭터는 자동으로 활동 + 일기에 모든 일자별 변화 기록.
-- 피로도/행복도 시스템 제거 — 게임 복잡도 줄이기.
--
-- Idempotent: drop+create 패턴.

-- ───── game_characters에 play_mode 추가 ─────────────────
alter table public.game_characters
  add column if not exists play_mode text not null default 'balanced';

-- check constraint은 별도로 추가 (이미 있으면 무시)
do $$
begin
  alter table public.game_characters
    add constraint game_characters_play_mode_check
    check (play_mode in ('learning', 'income', 'balanced'));
exception when duplicate_object then null;
end$$;

comment on column public.game_characters.play_mode is
  'Plan #36: 학습 중심 / 수입 중심 / 균형. tick이 모드에 따라 자동 활동.';

-- 피로도/행복도는 컬럼만 남기고 사용 X (호환성 유지, default값으로 안 변함)

-- ───── game_diary 테이블 ──────────────────────────────
create table if not exists public.game_diary (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  game_day int not null,
  real_date timestamptz not null default now(),
  -- 일기 타입
  entry_type text not null check (entry_type in (
    'activity',   -- 일상 활동 (출근/공부)
    'event',      -- 랜덤 이벤트 (보너스/사고)
    'milestone',  -- 학력/승진 이정표
    'trade',      -- 주식/부동산 매매 결과
    'market'      -- 시장 변동 영향 (KOSPI ±, 보유 종목)
  )),
  emoji text,
  summary text not null,        -- 한 줄 요약 ("정규직 출근 — +13만원")
  cash_delta numeric(20,2) not null default 0,
  metadata jsonb,               -- 자세한 정보 (대리→과장, 이벤트 카테고리 등)
  created_at timestamptz not null default now()
);

alter table public.game_diary enable row level security;

drop policy if exists game_diary_self on public.game_diary;
create policy game_diary_self on public.game_diary
  for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index if not exists game_diary_user_day_idx
  on public.game_diary (user_id, game_day desc);
create index if not exists game_diary_user_date_idx
  on public.game_diary (user_id, real_date desc);

comment on table public.game_diary is
  'Plan #36: 게임 진행 일기 — tick마다 결과 + 이벤트 + 마일스톤 기록';

-- ───── game_schedule 폐기 (호환성 유지, 사용 X) ───────────
-- 기존 row는 남겨두지만 새 데이터 안 들어감. Phase 3에서 정식 drop 검토.
comment on table public.game_schedule is
  'Plan #36 DEPRECATED: 30일 스케줄 시스템 폐기. 모드 기반으로 대체.';
