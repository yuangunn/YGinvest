// Plan #36: 게임 tick 재설계 — 모드 기반 자동 진행 + 일기 + 이벤트.
//
// 호출: 게임 페이지 진입 시 / 매도 직전 / 환생 직전.
// 처리: 현재 시각 - life_started_at = 며칠 지났나 → 미실행 day들을 순차 처리.
// 각 day마다:
//   1. 모드 기반 자동 활동 결정 (work/study/rest)
//   2. 보유 주식 시세 변동 반영 (정보용 — 실제 cash는 매도 시점에만)
//   3. 학력/승진 마일스톤 체크
//   4. 랜덤 이벤트 발생
//   5. 일기 row insert (entry_type별)

import {
  HOURS_PER_GAME_DAY,
  RANDOM_EVENTS,
  computeDailyResult,
  checkMilestones,
  INTELLIGENCE_FOR_GED,
  type PlayMode,
} from "./constants";

export type GameCharacter = {
  user_id: string;
  name: string;
  gender: string;
  education_level: "highschool" | "bachelor";
  job_type: "unemployed" | "parttime" | "fulltime";
  job_title: string | null;
  job_started_at: string | null;
  cash: number;
  fatigue: number;
  intelligence: number;
  happiness: number;
  life_started_at: string;
  current_day: number;
  starting_cash: number;
  play_mode: PlayMode;
};

export type Unlocks = Record<string, number>;

export type DiaryEntry = {
  game_day: number;
  real_date: string;
  entry_type: "activity" | "event" | "milestone" | "trade" | "market";
  emoji: string;
  summary: string;
  cash_delta: number;
  metadata?: Record<string, unknown>;
};

/** 두 시각 사이 게임 일수 */
export function daysBetween(startIso: string, endIso: string): number {
  const start = new Date(startIso).getTime();
  const end = new Date(endIso).getTime();
  const realHours = (end - start) / 3_600_000;
  return Math.floor(realHours / HOURS_PER_GAME_DAY);
}

/** game_day → 실제 timestamp */
export function gameDayToRealDate(lifeStartedAt: string, gameDay: number): Date {
  const start = new Date(lifeStartedAt).getTime();
  return new Date(start + gameDay * HOURS_PER_GAME_DAY * 3_600_000);
}

/**
 * tick 실행: 마지막 처리 이후의 모든 day를 처리해 일기 entry + character 변화 계산.
 *
 * Returns: 누적 변화 + diary entries (호출자가 DB에 저장).
 */
export function applyTickWithDiary(
  character: GameCharacter,
  unlocks: Unlocks,
  nowIso: string,
  ged_already_celebrated: boolean,
): {
  updatedCharacter: GameCharacter;
  diaryEntries: DiaryEntry[];
} {
  const today = daysBetween(character.life_started_at, nowIso);
  const startDay = character.current_day;

  if (today <= startDay) {
    return { updatedCharacter: character, diaryEntries: [] };
  }

  const luckBonus = (unlocks["good_luck"] ?? 0) > 0 ? 1.25 : 1.0;
  const goodEventKeys = new Set([
    "parent_gift",
    "lottery_small",
    "company_meal",
    "company_award",
    "ai_boom",
    "book_inspiration",
    "tax_refund",
  ]);

  let { cash, intelligence, education_level, job_type, job_title, job_started_at } = character;
  const entries: DiaryEntry[] = [];
  let gedCelebrated = ged_already_celebrated;

  for (let day = startDay + 1; day <= today; day++) {
    const realDate = gameDayToRealDate(character.life_started_at, day);
    const dayOfWeek = (realDate.getDay() + 6) % 7; // 월=0 ... 일=6

    // 1. 일상 활동
    const result = computeDailyResult(
      character.play_mode,
      job_type,
      job_title,
      dayOfWeek,
      unlocks,
    );
    cash += result.cashDelta;
    intelligence += result.intelligenceDelta;

    entries.push({
      game_day: day,
      real_date: realDate.toISOString(),
      entry_type: "activity",
      emoji: result.emoji,
      summary: result.summary,
      cash_delta: result.cashDelta,
      metadata: {
        intelligence_delta: result.intelligenceDelta,
      },
    });

    // 2. 학력/승진 마일스톤 체크
    const milestone = checkMilestones(
      {
        education_level,
        job_type,
        job_title,
        intelligence,
        job_started_at,
        current_day: day,
      },
      character.life_started_at,
    );
    if (milestone) {
      if (milestone.educationLevel) education_level = milestone.educationLevel;
      if (milestone.jobType) {
        job_type = milestone.jobType;
        if (milestone.jobType === "fulltime") {
          job_started_at = realDate.toISOString();
        }
      }
      if (milestone.jobTitle) job_title = milestone.jobTitle;
      entries.push({
        game_day: day,
        real_date: realDate.toISOString(),
        entry_type: "milestone",
        emoji: milestone.emoji,
        summary: milestone.summary,
        cash_delta: 0,
        metadata: { milestone_type: milestone.type },
      });
    }

    // 검정고시 한 번만 알림 (지력 200+ 첫 도달)
    if (!gedCelebrated && intelligence >= INTELLIGENCE_FOR_GED) {
      entries.push({
        game_day: day,
        real_date: realDate.toISOString(),
        entry_type: "milestone",
        emoji: "📜",
        summary: "검정고시 합격! 대학 진학 준비 중",
        cash_delta: 0,
        metadata: { milestone_type: "ged" },
      });
      gedCelebrated = true;
    }

    // 3. 랜덤 이벤트 (한 day에 최대 1개)
    for (const event of RANDOM_EVENTS) {
      const isGood = goodEventKeys.has(event.key);
      const prob = event.dailyProbability * (isGood ? luckBonus : 1);
      if (event.fulltimeOnly && job_type !== "fulltime") continue;
      if (Math.random() < prob) {
        const eventCashDelta = event.cashDelta(cash);
        cash += eventCashDelta;
        if (event.intelligenceDelta) intelligence += event.intelligenceDelta;
        entries.push({
          game_day: day,
          real_date: realDate.toISOString(),
          entry_type: "event",
          emoji: event.emoji,
          summary: event.summary + (
            eventCashDelta !== 0
              ? ` (${eventCashDelta > 0 ? "+" : ""}${Math.round(eventCashDelta / 10000)}만원)`
              : ""
          ),
          cash_delta: eventCashDelta,
          metadata: {
            event_key: event.key,
            stock_multiplier: event.stockMultiplier ?? null,
            intelligence_delta: event.intelligenceDelta ?? null,
          },
        });
        break; // 한 day에 1개 이벤트만
      }
    }
  }

  return {
    updatedCharacter: {
      ...character,
      cash,
      intelligence,
      education_level,
      job_type,
      job_title,
      job_started_at,
      current_day: today,
    },
    diaryEntries: entries,
  };
}

/** 게임 자산 합산 (현금 + 주식 평가액 + 부동산 평가액) */
export type AssetSnapshot = {
  cash: number;
  stocks_value: number;
  real_estate_value: number;
  total: number;
  return_pct: number;
};

export function computeAssets(
  character: GameCharacter,
  stocksValue: number,
  realEstateValue: number,
): AssetSnapshot {
  const total = character.cash + stocksValue + realEstateValue;
  const returnPct = (total - character.starting_cash) / character.starting_cash;
  return {
    cash: character.cash,
    stocks_value: stocksValue,
    real_estate_value: realEstateValue,
    total,
    return_pct: returnPct,
  };
}

/** 부동산 현재 시세 (Plan #33 그대로 유지) */
export function computeRealEstatePrice(
  basePrice: number,
  weeklyIndex: number,
  kospiDailyChange: number,
  kospiBeta: number,
  dailyVolatility: number,
  gameDay: number,
  regionCode: string,
): number {
  const seed = simpleHash(regionCode + ":" + gameDay);
  const noise = ((seed % 2000) / 1000 - 1) * dailyVolatility;
  const price =
    basePrice * weeklyIndex * (1 + kospiDailyChange * kospiBeta) * (1 + noise);
  return Math.round(price);
}

function simpleHash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}
