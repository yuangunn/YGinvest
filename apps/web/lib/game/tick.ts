// Plan #33: 게임 tick 처리 — 실제 시간 흐름에 따라 스케줄된 행동 실행.
//
// 호출 시점: 사용자가 게임 페이지 진입 / refresh / 매수매도 직전.
//   서버 액션으로 "현재 시각 - life_started_at = 며칠 지났나" 계산 후,
//   미실행 game_schedule을 순서대로 실행.
//
// 게임 시간 = 실제 시간 (1일 = 1일). 한 번에 여러 일이 밀려있어도 순차 처리.

import {
  ACTIVITY_COST,
  FATIGUE_DELTA,
  HAPPINESS_DELTA,
  INTELLIGENCE_DELTA,
  PARTTIME_DAILY_WAGE,
  HOLIDAY_BONUS_MULT,
  FULLTIME_DAILY_BY_RANK,
  FATIGUE_PRODUCTIVITY_DROP,
  FATIGUE_FIRE_RISK,
  FATIGUE_HOSPITAL,
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
};

export type ScheduleRow = {
  user_id: string;
  game_day: number;
  activity: string;
  executed_at: string | null;
  result_summary: string | null;
};

export type Unlocks = Record<string, number>;

/** 두 날짜 사이 일수 (시간/분 무시) */
function daysBetween(startIso: string, endIso: string): number {
  const start = new Date(startIso).getTime();
  const end = new Date(endIso).getTime();
  return Math.floor((end - start) / 86_400_000);
}

/** 평일 공휴일 (월~금 + 공휴일) → 공휴수당 적용 */
function isWeekdayHoliday(date: Date): boolean {
  const day = date.getDay();
  if (day === 0 || day === 6) return false;
  const md = `${date.getMonth() + 1}-${date.getDate()}`;
  return ["1-1", "3-1", "5-5", "6-6", "8-15", "10-3", "10-9", "12-25"].includes(md);
}

/**
 * tick 실행: 현재까지 밀려 있는 스케줄을 character에 반영.
 *
 * Returns: 변경된 character (저장 안 됨, 호출자가 저장 책임)
 */
export function applyScheduleTicks(
  character: GameCharacter,
  pendingSchedules: ScheduleRow[],
  unlocks: Unlocks,
  nowIso: string,
): {
  character: GameCharacter;
  executedSchedules: { game_day: number; result_summary: string }[];
  events: string[];
} {
  const today = daysBetween(character.life_started_at, nowIso);
  const events: string[] = [];
  const executed: { game_day: number; result_summary: string }[] = [];

  // 보너스 배수 (해금 효과)
  const parttimeBonus = 1 + (unlocks["parttime_bonus"] ?? 0) * 0.1;
  const fulltimeBonus = 1 + (unlocks["fulltime_bonus"] ?? 0) * 0.1;
  const fatigueResistance = (unlocks["fatigue_resistance"] ?? 0) * 10;
  const mentorEffect = (unlocks["mentor_effect"] ?? 0) > 0;
  const happinessBuffer = (unlocks["happiness_buffer"] ?? 0) > 0 ? 20 : 0;

  let { cash, fatigue, intelligence, happiness, job_type, job_title } = character;

  // 일별로 순차 처리 (역순 X — 시간 흐름대로)
  const sorted = pendingSchedules
    .filter((s) => s.game_day <= today && !s.executed_at)
    .sort((a, b) => a.game_day - b.game_day);

  for (const schedule of sorted) {
    const activity = schedule.activity;
    const dayDate = new Date(character.life_started_at);
    dayDate.setDate(dayDate.getDate() + schedule.game_day);
    const summary: string[] = [];

    // 1. 비용 차감
    const cost = ACTIVITY_COST[activity] ?? 0;
    if (cost > 0) {
      if (cash < cost) {
        summary.push(`💸 돈 부족 — ${activity} 못 함`);
        executed.push({
          game_day: schedule.game_day,
          result_summary: summary.join(" · "),
        });
        continue;
      }
      cash -= cost;
      summary.push(`-${(cost / 10000).toFixed(0)}만원`);
    }

    // 2. 수입 (알바/정규직)
    let income = 0;
    if (activity === "parttime") {
      let wage = PARTTIME_DAILY_WAGE * parttimeBonus;
      if (isWeekdayHoliday(dayDate)) {
        wage *= HOLIDAY_BONUS_MULT;
        summary.push("🎉 공휴수당 1.5x");
      }
      // 피로도에 따른 능률
      if (fatigue >= FATIGUE_PRODUCTIVITY_DROP) {
        wage *= 0.9;
        summary.push("😴 피로 -10%");
      }
      income = Math.floor(wage);
      cash += income;
      summary.push(`+${(income / 10000).toFixed(1)}만원 알바`);
    } else if (activity === "fulltime" && job_title) {
      const rank = job_title;
      const base = FULLTIME_DAILY_BY_RANK[rank] ?? FULLTIME_DAILY_BY_RANK["사원"];
      let wage = base * fulltimeBonus;
      if (fatigue >= FATIGUE_PRODUCTIVITY_DROP) {
        wage *= 0.9;
        summary.push("😴 피로 -10%");
      }
      income = Math.floor(wage);
      cash += income;
      summary.push(`+${(income / 10000).toFixed(1)}만원 (${rank})`);
    }

    // 3. 피로도 변화
    const fatigueChange = FATIGUE_DELTA[activity] ?? 0;
    fatigue = Math.max(0, Math.min(100, fatigue + fatigueChange));

    // 4. 행복도 변화
    const happinessChange = HAPPINESS_DELTA[activity] ?? 0;
    happiness = Math.max(
      -happinessBuffer,
      Math.min(100, happiness + happinessChange),
    );

    // 5. 지력 변화
    let intChange = INTELLIGENCE_DELTA[activity] ?? 0;
    if (activity === "study" && mentorEffect) intChange = Math.floor(intChange * 1.5);
    intelligence += intChange;
    if (intChange > 0) summary.push(`📚 지력 +${intChange}`);

    // 6. 피로도 임계점 이벤트
    const fireRisk = FATIGUE_FIRE_RISK + fatigueResistance;
    const hospital = FATIGUE_HOSPITAL + fatigueResistance;
    if (fatigue >= hospital) {
      // 강제 입원 1주
      events.push(`🏥 ${dayDate.toLocaleDateString("ko-KR")} 과로로 입원 — 1주일 강제 휴식`);
      fatigue = 30; // 입원 후 회복
      happiness = Math.max(0, happiness - 20);
      summary.push("🏥 입원");
    } else if (fatigue >= fireRisk && (activity === "parttime" || activity === "fulltime")) {
      // 5% 확률 해고
      if (Math.random() < 0.05) {
        events.push(`💼 ${dayDate.toLocaleDateString("ko-KR")} 피로 누적으로 해고됨`);
        job_type = "unemployed";
        job_title = null;
        summary.push("💔 해고");
      }
    }

    executed.push({
      game_day: schedule.game_day,
      result_summary: summary.join(" · ") || "—",
    });
  }

  // 누락된 일자 (스케줄이 없거나 'free'였던 경우) — 자동 휴식으로 처리
  // 너무 빈 일자가 많으면 행복도 하락 등은 Phase 2에서.

  return {
    character: {
      ...character,
      cash,
      fatigue,
      intelligence,
      happiness,
      job_type,
      job_title,
      current_day: today,
    },
    executedSchedules: executed,
    events,
  };
}

/**
 * 게임 자산 총합 계산 (현금 + 게임 주식 평가액 + 게임 부동산 평가액).
 * 환생 조건 체크용.
 */
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

/**
 * 부동산 현재 시세 계산:
 *   base × weekly_index × (1 + kospi_daily_change × kospi_beta) × (1 + daily_noise)
 *
 * KOSPI 일일 변동을 받아서 베타만큼 반영. noise는 deterministic 하게 game_day 기반 hash.
 */
export function computeRealEstatePrice(
  basePrice: number,
  weeklyIndex: number,
  kospiDailyChange: number,
  kospiBeta: number,
  dailyVolatility: number,
  gameDay: number,
  regionCode: string,
): number {
  // deterministic noise: hash(regionCode + gameDay) → -1~1
  const seed = simpleHash(regionCode + ":" + gameDay);
  const noise = ((seed % 2000) / 1000 - 1) * dailyVolatility; // -volatility ~ +volatility
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
