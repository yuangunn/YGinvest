-- Plan #43: 게임 환생 수익 계산 — invested_pnl 분리.
--
-- 이전: cash >= starting_cash * 1.05 → 알바 수익도 환생 조건에 들어감
-- 변경: 금융 수익만 (주식/부동산 매도 차익) 누적 → invested_pnl 추적
--
-- 또 시작 자본을 1000만원 → 100만원으로 축소 (기본값 변경. 기존 캐릭터는 그대로).

alter table public.game_characters
  add column if not exists invested_pnl numeric(20,2) not null default 0;

comment on column public.game_characters.invested_pnl is
  'Plan #43: 누적 금융수익 (주식+부동산 매도이익). 환생 조건의 기준.';

-- 기본값 변경: starting_cash 10,000,000 → 1,000,000 (새 캐릭터부터 적용)
alter table public.game_characters
  alter column cash set default 1000000,
  alter column starting_cash set default 1000000;
