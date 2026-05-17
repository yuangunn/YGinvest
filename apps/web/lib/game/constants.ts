// Plan #33: 게임 상수 — 활동 효과 / 직급 / 해금 등.
//
// 모든 수치는 한 곳에 집약. 밸런싱 시 여기만 수정.

// Plan #35: 시간 배율 — 실제 2시간 = 게임 1일.
// 너무 느려도 안 되고 (1:1=실 30일 = 1환생) 너무 빨라도 안 됨 (시세 못 따라감).
// 2시간:1일이면 사용자가 점심/저녁/잘 때 자연스럽게 체크하면서 진행.
export const HOURS_PER_GAME_DAY = 2;

// 시작 자원
export const STARTING_CASH = 10_000_000; // 1,000만원
export const REBIRTH_THRESHOLD_PCT = 0.05; // 5% 수익 → 환생 가능

// 한국 최저시급 (2026년 추정) × 8시간 × 주 5일
export const MIN_HOURLY_WAGE = 10_300; // 원/시간 (2026년 예상)
export const PARTTIME_HOURS_PER_DAY = 8;
export const PARTTIME_DAILY_WAGE = MIN_HOURLY_WAGE * PARTTIME_HOURS_PER_DAY; // 82,400원
export const HOLIDAY_BONUS_MULT = 1.5; // 공휴수당 1.5배

// 직급별 일급 (정규직, 월급 ÷ 22)
export const FULLTIME_DAILY_BY_RANK: Record<string, number> = {
  사원: 130_000,    // 월 약 286만원
  대리: 170_000,    // 월 약 374만원
  과장: 220_000,    // 월 약 484만원
  차장: 280_000,    // 월 약 616만원
  부장: 350_000,    // 월 약 770만원
};
export const FULLTIME_RANKS = ["사원", "대리", "과장", "차장", "부장"] as const;
export type FulltimeRank = (typeof FULLTIME_RANKS)[number];

// 활동 비용 (행복도 ↑ 활동은 돈 -)
export const ACTIVITY_COST: Record<string, number> = {
  shopping: 50_000,
  dining: 30_000,
  healing: 100_000,
  study: 0,
  rest: 0,
  exercise: 0,
  parttime: 0,
  fulltime: 0,
  job_search: 0,
  free: 0,
};

// 피로도 변화 (양수 = 누적, 음수 = 회복)
export const FATIGUE_DELTA: Record<string, number> = {
  parttime: 15,
  fulltime: 18,
  study: 8,
  job_search: 10,
  rest: -20,
  shopping: -10,
  dining: -10,
  healing: -25,
  exercise: -15, // 체력 단련 효과
  free: -5,
};

// 행복도 변화
export const HAPPINESS_DELTA: Record<string, number> = {
  parttime: -2,
  fulltime: -3,
  study: -1,
  job_search: -3,
  rest: 3,
  shopping: 8,
  dining: 10,
  healing: 15,
  exercise: 5,
  free: 1,
};

// 지력 (자기계발) 변화 — study만 +5
export const INTELLIGENCE_DELTA: Record<string, number> = {
  study: 5,
};

// 피로도 임계점
export const FATIGUE_PRODUCTIVITY_DROP = 70; // 이상 시 수입 -10%
export const FATIGUE_FIRE_RISK = 90;          // 이상 시 5% 해고
export const FATIGUE_HOSPITAL = 100;          // 이상 시 강제 1주 입원

// 학력 / 직업 unlock 조건
export const INTELLIGENCE_FOR_GED = 200;       // 검정고시 (자기계발 누적 200시간)
export const INTELLIGENCE_FOR_UNIVERSITY = 600; // 대학 진학
export const INTELLIGENCE_FOR_FULLTIME = 1500;  // 사무직 취업

// 승진 조건 (직장 N일 + 피로도 평균 < X)
export const PROMOTION_DAYS_PER_RANK = 180; // 약 6개월마다 승진 기회

// 환생 포인트 계산
// points = 수익률(%) × 10 + 시간 효율 보너스 (빠를수록 ↑)
// 예: 5% 수익, 30일 = 50 + 보너스 = ~60pt
export function calculateRebirthPoints(
  returnPct: number,
  daysPlayed: number,
): number {
  const returnPoints = Math.floor(returnPct * 100 * 10); // 5% → 50pt
  // 시간 보너스: 100일 안에 클리어하면 +20, 200일 +10, 그 이상 0
  const timeBonus = daysPlayed <= 100 ? 20 : daysPlayed <= 200 ? 10 : 0;
  return returnPoints + timeBonus;
}

// 영구 업그레이드 메뉴 (해금 가능 항목)
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
    description: "환생 시 학력 시작점을 대졸로 선택 가능. 시작 시 자기계발 +500",
    cost: 100,
    maxLevel: 1,
  },
  {
    key: "fatigue_resistance",
    label: "🛌 피로 저항 +10",
    description: "피로도 임계점이 모두 +10 (누적)",
    cost: 35,
    maxLevel: 3,
  },
  {
    key: "real_estate_starter",
    label: "🏠 부동산 시작 자금",
    description: "환생 시 +5,000만원 (부동산 진입 가속)",
    cost: 150,
    maxLevel: 1,
  },
  {
    key: "mentor_effect",
    label: "👨‍🏫 멘토 효과",
    description: "study 활동 시 지력 +50% (5 → 7.5)",
    cost: 60,
    maxLevel: 1,
  },
  {
    key: "happiness_buffer",
    label: "😊 행복도 버퍼 +20",
    description: "행복도가 0이 되어도 디버프 없음 (-20 까지 보호)",
    cost: 45,
    maxLevel: 1,
  },
];

// 활동 라벨 (한글)
export const ACTIVITY_LABEL: Record<string, string> = {
  parttime: "💪 알바",
  fulltime: "💼 출근",
  study: "📚 공부",
  rest: "🛌 휴식",
  shopping: "🛍️ 쇼핑",
  dining: "🍔 외식",
  healing: "🧘 힐링",
  exercise: "🏃 운동",
  job_search: "📝 구직",
  free: "⚪ 미정",
};

// 활동 색상 (UI)
export const ACTIVITY_COLOR: Record<string, string> = {
  parttime: "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/40",
  fulltime: "bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/40",
  study: "bg-purple-500/15 text-purple-600 dark:text-purple-400 border-purple-500/40",
  rest: "bg-slate-500/15 text-slate-600 dark:text-slate-400 border-slate-500/40",
  shopping: "bg-pink-500/15 text-pink-600 dark:text-pink-400 border-pink-500/40",
  dining: "bg-orange-500/15 text-orange-600 dark:text-orange-400 border-orange-500/40",
  healing: "bg-teal-500/15 text-teal-600 dark:text-teal-400 border-teal-500/40",
  exercise: "bg-green-500/15 text-green-600 dark:text-green-400 border-green-500/40",
  job_search: "bg-cyan-500/15 text-cyan-600 dark:text-cyan-400 border-cyan-500/40",
  free: "bg-muted text-muted-foreground border",
};

// Plan #35: 활동별 효과 요약 (UI 버튼/스케줄 칸에 표시)
// short: 한 줄 요약 ("+8만 ·피로+15")
// effects: 자세한 effect list (모달용)
export type ActivityEffect = {
  delta: number;
  emoji: string;
  label: string;
  isGood: boolean;
};

export function getActivityEffects(activity: string): ActivityEffect[] {
  const effects: ActivityEffect[] = [];

  // 수입 (알바/정규직)
  if (activity === "parttime") {
    effects.push({
      delta: PARTTIME_DAILY_WAGE,
      emoji: "💰",
      label: `+${Math.round(PARTTIME_DAILY_WAGE / 10000)}만원 (최저시급×8h)`,
      isGood: true,
    });
  } else if (activity === "fulltime") {
    const base = FULLTIME_DAILY_BY_RANK["사원"];
    effects.push({
      delta: base,
      emoji: "💰",
      label: `+${Math.round(base / 10000)}만원~ (직급별)`,
      isGood: true,
    });
  }

  // 비용
  const cost = ACTIVITY_COST[activity] ?? 0;
  if (cost > 0) {
    effects.push({
      delta: -cost,
      emoji: "💸",
      label: `-${Math.round(cost / 10000)}만원`,
      isGood: false,
    });
  }

  // 피로도
  const fatigueChange = FATIGUE_DELTA[activity] ?? 0;
  if (fatigueChange !== 0) {
    effects.push({
      delta: fatigueChange,
      emoji: "🔋",
      label: fatigueChange > 0 ? `피로 +${fatigueChange}` : `피로 ${fatigueChange}`,
      isGood: fatigueChange < 0,
    });
  }

  // 행복도
  const happinessChange = HAPPINESS_DELTA[activity] ?? 0;
  if (happinessChange !== 0) {
    effects.push({
      delta: happinessChange,
      emoji: "😊",
      label: happinessChange > 0 ? `행복 +${happinessChange}` : `행복 ${happinessChange}`,
      isGood: happinessChange > 0,
    });
  }

  // 지력
  const intChange = INTELLIGENCE_DELTA[activity] ?? 0;
  if (intChange !== 0) {
    effects.push({
      delta: intChange,
      emoji: "📚",
      label: `지력 +${intChange}`,
      isGood: true,
    });
  }

  return effects;
}

/** 활동 효과 한 줄 요약 (버튼용) */
export function getActivityShortSummary(activity: string): string {
  const fx = getActivityEffects(activity);
  if (fx.length === 0) return "변화 없음";
  return fx
    .slice(0, 2)
    .map((e) => e.label.replace(/[+\-](\d+)만원/g, (_, n) => `${e.delta > 0 ? "+" : "-"}${n}만`))
    .join(" · ");
}

/** 활동 부가 설명 (모달용) */
export const ACTIVITY_DESCRIPTION: Record<string, string> = {
  parttime: "최저시급×8시간. 주 5일 권장, 6일 이상이면 피로 누적으로 능률↓/해고위험↑.",
  fulltime: "정규직 출근. 직급별 일급(사원 13만~부장 35만). 자기계발 충분히 쌓으면 승진.",
  study: "자기계발. 지력 누적 → 200=검정고시, 600=대학진학, 1500=사무직 취업.",
  rest: "휴식. 피로 -20, 행복 +3. 비용 0.",
  shopping: "쇼핑. 행복 +8, 피로 -10. 비용 5만원.",
  dining: "외식. 행복 +10, 피로 -10. 비용 3만원.",
  healing: "힐링 (스파/마사지). 행복 +15, 피로 -25. 비용 10만원.",
  exercise: "운동. 피로 -15, 행복 +5. 비용 0.",
  job_search: "구직활동. (Phase 2에서 정규직 면접 시스템 추가 예정)",
  free: "미정. 자동으로 가벼운 휴식 처리.",
};
