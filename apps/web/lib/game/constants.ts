// Plan #36: 게임 상수 — 모드 / 활동 / 이벤트 / 학력 / 승진.
//
// 30일 스케줄 → 3가지 모드로 대체.
// 피로도/행복도 제거. 자원은 cash + intelligence + (job 정보).

// Plan #38: 시간 배율 — 실제 1시간 = 게임 1일 (1:24).
// 더 빠른 페이스. 환생 사이클이 4~7일 게임 시간 안에 가능.
export const HOURS_PER_GAME_DAY = 1;

// 시작 자원
export const STARTING_CASH = 10_000_000;
export const REBIRTH_THRESHOLD_PCT = 0.05;

// ──────────── 한국 임금 (2026년 기준 추정) ────────────
export const MIN_HOURLY_WAGE = 10_300;
export const PARTTIME_HOURS_PER_DAY = 8;
export const PARTTIME_DAILY_WAGE = MIN_HOURLY_WAGE * PARTTIME_HOURS_PER_DAY; // 82,400원
export const HOLIDAY_BONUS_MULT = 1.5;

// 정규직 직급별 일급 (월급 ÷ 22)
export const FULLTIME_DAILY_BY_RANK: Record<string, number> = {
  사원: 130_000,
  대리: 170_000,
  과장: 220_000,
  차장: 280_000,
  부장: 350_000,
};
export const FULLTIME_RANKS = ["사원", "대리", "과장", "차장", "부장"] as const;
export type FulltimeRank = (typeof FULLTIME_RANKS)[number];

// ──────────── 모드 정의 ──────────────────────────────
export type PlayMode = "learning" | "income" | "balanced";

export type ModeDef = {
  key: PlayMode;
  label: string;
  emoji: string;
  description: string;
  /** 각 day에 어떤 활동을 할 확률 */
  weights: {
    work: number;   // 알바 또는 정규직 (있으면)
    study: number;  // 자기계발
    rest: number;   // 휴식 (수입 0, 지력 0)
  };
};

export const PLAY_MODES: Record<PlayMode, ModeDef> = {
  learning: {
    key: "learning",
    label: "학습 중심",
    emoji: "📚",
    description:
      "지력 빠르게 ↑ → 대학/취업 빠름. 수입 적음. 환생까지 오래 걸리지만 정규직 도달 후 가속.",
    weights: { work: 0.3, study: 0.7, rest: 0 },
  },
  income: {
    key: "income",
    label: "수입 중심",
    emoji: "💰",
    description:
      "현금 빠르게 모음. 환생까지 가장 빠르지만 학력 진보 X (계속 알바).",
    weights: { work: 1.0, study: 0, rest: 0 },
  },
  balanced: {
    key: "balanced",
    label: "균형",
    emoji: "⚖️",
    description:
      "절반 일하고 절반 공부. 안정적인 진행. 첫 환생 시 추천.",
    weights: { work: 0.5, study: 0.5, rest: 0 },
  },
};

// ──────────── 학력 마일스톤 ───────────────────────────
export const INTELLIGENCE_FOR_GED = 200;        // 검정고시
export const INTELLIGENCE_FOR_UNIVERSITY = 600; // 대학 진학
export const INTELLIGENCE_FOR_FULLTIME = 1500;  // 사무직 취업

export const INTELLIGENCE_GAIN_PER_STUDY = 5;

// ──────────── 승진 시스템 ─────────────────────────────
export const PROMOTION_DAYS_PER_RANK = 180; // 게임 180일마다 승진 기회

// ──────────── 랜덤 이벤트 풀 ──────────────────────────
export type RandomEventDef = {
  key: string;
  emoji: string;
  /** 확률 (0-1). 매 day 진행 시 계산 */
  dailyProbability: number;
  /** 일기 summary */
  summary: string;
  /** 현금 변화 함수 (cash, random)으로 받음 */
  cashDelta: (currentCash: number) => number;
  /** 보유 주식 가격에 영향 (1.0 = 변화 없음, 1.1 = +10%) */
  stockMultiplier?: number;
  /** 정규직만 발생 */
  fulltimeOnly?: boolean;
  /** 추가 효과 (지력 +) */
  intelligenceDelta?: number;
};

export const RANDOM_EVENTS: RandomEventDef[] = [
  {
    key: "parent_gift",
    emoji: "🎁",
    dailyProbability: 0.02,
    summary: "부모님 용돈 도착",
    cashDelta: () => 300_000,
  },
  {
    key: "lottery_small",
    emoji: "🎟️",
    dailyProbability: 0.01,
    summary: "복권 5등 당첨",
    cashDelta: () => 100_000,
  },
  {
    key: "company_meal",
    emoji: "🍱",
    dailyProbability: 0.015,
    summary: "회사 식대 지원금",
    cashDelta: () => 50_000,
    fulltimeOnly: true,
  },
  {
    key: "company_award",
    emoji: "🏆",
    dailyProbability: 0.01,
    summary: "회사 표창 — 보너스 입금!",
    cashDelta: () => 500_000,
    fulltimeOnly: true,
  },
  {
    key: "ai_boom",
    emoji: "🚀",
    dailyProbability: 0.01,
    summary: "[뉴스] AI 붐 — 보유 주식 일제히 상승",
    cashDelta: () => 0,
    stockMultiplier: 1.08,
  },
  {
    key: "book_inspiration",
    emoji: "📕",
    dailyProbability: 0.02,
    summary: "좋은 책 발견 — 지력 +20",
    cashDelta: () => 0,
    intelligenceDelta: 20,
  },
  {
    key: "medical",
    emoji: "🏥",
    dailyProbability: 0.012,
    summary: "병원비 지출",
    cashDelta: () => -Math.floor(Math.random() * 700_000) - 300_000, // -30~100만
  },
  {
    key: "car_accident",
    emoji: "🚗",
    dailyProbability: 0.005,
    summary: "차사고 — 수리비 지출",
    cashDelta: () => -Math.floor(Math.random() * 2_000_000) - 1_000_000, // -100~300만
  },
  {
    key: "wedding",
    emoji: "💌",
    dailyProbability: 0.015,
    summary: "친구 결혼식 — 축의금",
    cashDelta: () => -200_000,
  },
  {
    key: "crypto_crash",
    emoji: "📉",
    dailyProbability: 0.008,
    summary: "[뉴스] 코인 폭락 — 보유 주식 동반 하락",
    cashDelta: () => 0,
    stockMultiplier: 0.92,
  },
  {
    key: "economic_crisis",
    emoji: "🌪️",
    dailyProbability: 0.003,
    summary: "[뉴스] 경제 위기 — 시장 대폭락",
    cashDelta: () => 0,
    stockMultiplier: 0.82,
  },
  {
    key: "tax_refund",
    emoji: "💸",
    dailyProbability: 0.008,
    summary: "연말정산 환급금 입금",
    cashDelta: () => 250_000,
  },
];

// ──────────── 모드별 예상 수입 (UI 표시용) ────────────
// Plan #39: 시간 할당 모델 — 매일 work_weight 비율로 일급 받음.
export type ModeEstimate = {
  /** 알바일 때 매일 받는 수입 (work_weight 적용) */
  parttimeDaily: number;
  /** 사원 정규직일 때 매일 받는 수입 */
  fulltimeDaily: number;
  /** 매일 지력 증가 (study_weight 적용) */
  dailyIntelligence: number;
  /** 주간 (7일) 누적 cash */
  weeklyParttime: number;
  weeklyFulltime: number;
};

export function modeIncomeEstimate(
  mode: PlayMode,
  unlocks: Record<string, number>,
): ModeEstimate {
  const parttimeBonus = 1 + (unlocks["parttime_bonus"] ?? 0) * 0.1;
  const fulltimeBonus = 1 + (unlocks["fulltime_bonus"] ?? 0) * 0.1;
  const mentorEffect = (unlocks["mentor_effect"] ?? 0) > 0;
  const weights = PLAY_MODES[mode].weights;

  const parttimeDaily = Math.floor(
    PARTTIME_DAILY_WAGE * parttimeBonus * weights.work,
  );
  const fulltimeDaily = Math.floor(
    FULLTIME_DAILY_BY_RANK["사원"] * fulltimeBonus * weights.work,
  );

  const baseGain = mentorEffect
    ? INTELLIGENCE_GAIN_PER_STUDY * 1.5
    : INTELLIGENCE_GAIN_PER_STUDY;
  const dailyIntelligence = Math.round(baseGain * weights.study);

  return {
    parttimeDaily,
    fulltimeDaily,
    dailyIntelligence,
    weeklyParttime: parttimeDaily * 7,
    weeklyFulltime: fulltimeDaily * 7,
  };
}

// ──────────── 모드별 day당 cash/intel 계산 ──────────────
export type DailyResult = {
  cashDelta: number;
  intelligenceDelta: number;
  summary: string;
  emoji: string;
};

export function computeDailyResult(
  mode: PlayMode,
  jobType: "unemployed" | "parttime" | "fulltime",
  jobTitle: string | null,
  _dayOfWeek: number,
  unlocks: Record<string, number>,
): DailyResult {
  const weights = PLAY_MODES[mode].weights;
  const parttimeBonus = 1 + (unlocks["parttime_bonus"] ?? 0) * 0.1;
  const fulltimeBonus = 1 + (unlocks["fulltime_bonus"] ?? 0) * 0.1;
  const mentorEffect = (unlocks["mentor_effect"] ?? 0) > 0;

  // Plan #39: 시간 할당 비율 모델 — 매 day 결정적으로 work_weight 시간 일하고
  // study_weight 시간 공부. 확률 X. 사용자 의도 명확.

  // 1) 일 부분 (work_weight 비율만큼 일급)
  let workCash = 0;
  let workLabel = "";
  let workEmoji = "💪";

  if (weights.work > 0) {
    if (jobType === "fulltime" && jobTitle) {
      const base = FULLTIME_DAILY_BY_RANK[jobTitle] ?? FULLTIME_DAILY_BY_RANK["사원"];
      workCash = Math.floor(base * fulltimeBonus * weights.work);
      workLabel = `${jobTitle} ${Math.round(weights.work * 100)}%`;
      workEmoji = "💼";
    } else {
      workCash = Math.floor(PARTTIME_DAILY_WAGE * parttimeBonus * weights.work);
      workLabel = `알바 ${Math.round(weights.work * 100)}%`;
      workEmoji = "💪";
    }
  }

  // 2) 공부 부분 (study_weight 비율만큼 지력 증가)
  let studyIntel = 0;
  let studyLabel = "";
  if (weights.study > 0) {
    const baseGain = mentorEffect
      ? INTELLIGENCE_GAIN_PER_STUDY * 1.5
      : INTELLIGENCE_GAIN_PER_STUDY;
    studyIntel = Math.round(baseGain * weights.study);
    studyLabel = `공부 ${Math.round(weights.study * 100)}%`;
  }

  // 3) summary + emoji 조합
  const parts = [workLabel, studyLabel].filter((s) => s);
  const cashPart = workCash > 0 ? ` +${(workCash / 10000).toFixed(1)}만` : "";
  const intelPart = studyIntel > 0 ? ` 지력+${studyIntel}` : "";

  // emoji: 압도적인 비율 따라
  let emoji: string;
  if (weights.work === 0 && weights.study === 0) emoji = "🛌";
  else if (weights.work === 1) emoji = workEmoji;
  else if (weights.study === 1) emoji = "📚";
  else if (weights.work >= weights.study) emoji = workEmoji;
  else emoji = "📚";

  // 활동 없는 경우 (둘 다 0) — rest
  if (parts.length === 0) {
    return {
      cashDelta: 0,
      intelligenceDelta: 0,
      summary: "휴식 — 재충전",
      emoji: "🛌",
    };
  }

  return {
    cashDelta: workCash,
    intelligenceDelta: studyIntel,
    summary: `${parts.join(" + ")}${cashPart}${intelPart}`,
    emoji,
  };
}

// ──────────── 학력/직업 진행 자동 체크 ──────────────────
export type MilestoneResult = {
  type: "ged" | "university" | "fulltime_offer" | "promotion";
  summary: string;
  emoji: string;
  /** 추가 효과 (학력 변경, job 변경 등) */
  educationLevel?: "highschool" | "bachelor";
  jobType?: "unemployed" | "parttime" | "fulltime";
  jobTitle?: string;
};

export function checkMilestones(
  character: {
    education_level: "highschool" | "bachelor";
    job_type: "unemployed" | "parttime" | "fulltime";
    job_title: string | null;
    intelligence: number;
    job_started_at: string | null;
    current_day: number;
  },
  lifeStartedAt: string,
): MilestoneResult | null {
  // 1. 사무직 취업 (지력 1500+ && 현재 사무직 아닐 때)
  if (
    character.intelligence >= INTELLIGENCE_FOR_FULLTIME &&
    character.job_type !== "fulltime"
  ) {
    return {
      type: "fulltime_offer",
      summary: "사무직 취업 성공! 직급: 사원",
      emoji: "🎉",
      jobType: "fulltime",
      jobTitle: "사원",
    };
  }

  // 2. 대학 진학 (지력 600+ && 학력 고졸)
  if (
    character.intelligence >= INTELLIGENCE_FOR_UNIVERSITY &&
    character.education_level === "highschool"
  ) {
    return {
      type: "university",
      summary: "대학 진학! 학력: 대졸",
      emoji: "🎓",
      educationLevel: "bachelor",
    };
  }

  // 3. 검정고시 (지력 200+ && 마일스톤 아직 안 받음) — 그냥 일기 알림용
  // 별도 학력 X. 다만 일기에 "검정고시 합격" 기록 가능 — 아래에서 별도 처리

  // 4. 승진 (정규직 && job_started 후 PROMOTION_DAYS_PER_RANK 경과)
  if (
    character.job_type === "fulltime" &&
    character.job_title &&
    character.job_started_at
  ) {
    const startDay = Math.floor(
      (new Date(character.job_started_at).getTime() -
        new Date(lifeStartedAt).getTime()) /
        86_400_000 / (HOURS_PER_GAME_DAY / 24),
    );
    const daysAtJob = character.current_day - startDay;
    const nextRankIdx = FULLTIME_RANKS.indexOf(character.job_title as FulltimeRank) + 1;
    if (nextRankIdx > 0 && nextRankIdx < FULLTIME_RANKS.length) {
      const requiredDays = nextRankIdx * PROMOTION_DAYS_PER_RANK;
      if (daysAtJob >= requiredDays) {
        const nextRank = FULLTIME_RANKS[nextRankIdx];
        return {
          type: "promotion",
          summary: `승진! ${character.job_title} → ${nextRank}`,
          emoji: "🎊",
          jobTitle: nextRank,
        };
      }
    }
  }

  return null;
}

// ──────────── 환생 포인트 계산 (그대로) ──────────────
export function calculateRebirthPoints(
  returnPct: number,
  daysPlayed: number,
): number {
  const returnPoints = Math.floor(returnPct * 100 * 10);
  const timeBonus = daysPlayed <= 100 ? 20 : daysPlayed <= 200 ? 10 : 0;
  return returnPoints + timeBonus;
}

// ──────────── 영구 업그레이드 (Plan #33 그대로) ────────
export type UnlockDef = {
  key: string;
  label: string;
  description: string;
  cost: number;
  maxLevel: number;
};

export const UNLOCK_CATALOG: UnlockDef[] = [
  {
    key: "starting_cash_boost",
    label: "🪙 시작 자본 +100만원",
    description: "환생 시 시작 cash +1,000,000원 (누적)",
    cost: 30,
    maxLevel: 10,
  },
  {
    key: "parttime_bonus",
    label: "💪 알바 보너스 +10%",
    description: "알바 일당 영구 +10% (누적)",
    cost: 25,
    maxLevel: 5,
  },
  {
    key: "fulltime_bonus",
    label: "💼 정규직 보너스 +10%",
    description: "정규직 일급 영구 +10% (누적)",
    cost: 40,
    maxLevel: 5,
  },
  {
    key: "bachelor_unlock",
    label: "🎓 대졸 시작 unlock",
    description: "환생 시 대졸 시작 가능 + 지력 500",
    cost: 100,
    maxLevel: 1,
  },
  {
    key: "real_estate_starter",
    label: "🏠 부동산 시작 자금",
    description: "환생 시 +5,000만원",
    cost: 150,
    maxLevel: 1,
  },
  {
    key: "mentor_effect",
    label: "👨‍🏫 멘토 효과",
    description: "study 활동 시 지력 +50%",
    cost: 60,
    maxLevel: 1,
  },
  {
    key: "good_luck",
    label: "🍀 행운",
    description: "긍정 이벤트 확률 +25%",
    cost: 70,
    maxLevel: 1,
  },
];
