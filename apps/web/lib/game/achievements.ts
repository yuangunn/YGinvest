// Plan #40: 업적 시스템 — 30+ 업적 정의 + 자동 체크 로직.

export type AchievementDef = {
  key: string;
  category: "education" | "career" | "wealth" | "rebirth" | "trading" | "life" | "fun";
  emoji: string;
  label: string;
  description: string;
  /** 환생 포인트 보상 */
  reward: number;
};

export const ACHIEVEMENTS: AchievementDef[] = [
  // 교육
  {
    key: "ged_passed",
    category: "education",
    emoji: "📜",
    label: "검정고시 합격",
    description: "지력 200 달성",
    reward: 5,
  },
  {
    key: "university",
    category: "education",
    emoji: "🎓",
    label: "대학 진학",
    description: "지력 600 달성",
    reward: 15,
  },
  {
    key: "intelligent",
    category: "education",
    emoji: "🧠",
    label: "지식인",
    description: "지력 1000 달성",
    reward: 20,
  },
  {
    key: "scholar",
    category: "education",
    emoji: "👨‍🎓",
    label: "학자",
    description: "지력 2000 달성",
    reward: 30,
  },

  // 커리어
  {
    key: "first_parttime",
    category: "career",
    emoji: "💪",
    label: "첫 알바",
    description: "처음으로 알바로 돈을 벌었어요",
    reward: 3,
  },
  {
    key: "first_fulltime",
    category: "career",
    emoji: "💼",
    label: "취준생 → 사원",
    description: "정규직 사무직 취업",
    reward: 25,
  },
  {
    key: "rank_daeri",
    category: "career",
    emoji: "📈",
    label: "대리 승진",
    description: "사원 → 대리",
    reward: 15,
  },
  {
    key: "rank_gwajang",
    category: "career",
    emoji: "📊",
    label: "과장 승진",
    description: "대리 → 과장",
    reward: 20,
  },
  {
    key: "rank_chajang",
    category: "career",
    emoji: "🎯",
    label: "차장 승진",
    description: "과장 → 차장",
    reward: 30,
  },
  {
    key: "rank_bujang",
    category: "career",
    emoji: "👔",
    label: "부장 도달",
    description: "최고 직급",
    reward: 50,
  },

  // 자산
  {
    key: "wealth_50m",
    category: "wealth",
    emoji: "💵",
    label: "5천만원 자산",
    description: "총 자산 50,000,000원",
    reward: 10,
  },
  {
    key: "wealth_100m",
    category: "wealth",
    emoji: "💰",
    label: "1억 자산",
    description: "총 자산 100,000,000원",
    reward: 20,
  },
  {
    key: "wealth_500m",
    category: "wealth",
    emoji: "💎",
    label: "5억 자산",
    description: "총 자산 500,000,000원",
    reward: 40,
  },
  {
    key: "wealth_1b",
    category: "wealth",
    emoji: "🏦",
    label: "10억 자산",
    description: "총 자산 1,000,000,000원",
    reward: 80,
  },

  // 환생
  {
    key: "first_rebirth",
    category: "rebirth",
    emoji: "🌱",
    label: "첫 환생",
    description: "처음으로 5% 수익 후 환생",
    reward: 10,
  },
  {
    key: "rebirth_5",
    category: "rebirth",
    emoji: "🌿",
    label: "환생 5회",
    description: "5번 환생",
    reward: 20,
  },
  {
    key: "rebirth_10",
    category: "rebirth",
    emoji: "🌳",
    label: "환생 10회",
    description: "10번 환생",
    reward: 40,
  },
  {
    key: "rebirth_25",
    category: "rebirth",
    emoji: "🌲",
    label: "환생 마스터",
    description: "25번 환생",
    reward: 100,
  },
  {
    key: "fast_rebirth_7d",
    category: "rebirth",
    emoji: "⚡",
    label: "초고속 환생",
    description: "7게임일 안에 환생",
    reward: 30,
  },

  // 트레이딩 (매도 트레이너 핵심)
  {
    key: "first_buy",
    category: "trading",
    emoji: "🛒",
    label: "첫 매수",
    description: "처음으로 주식 매수",
    reward: 3,
  },
  {
    key: "first_sell_profit",
    category: "trading",
    emoji: "📈",
    label: "첫 수익 매도",
    description: "+% 수익으로 매도 성공",
    reward: 10,
  },
  {
    key: "sell_5pct",
    category: "trading",
    emoji: "🎯",
    label: "+5% 매도",
    description: "5% 이상 수익으로 매도",
    reward: 15,
  },
  {
    key: "sell_10pct",
    category: "trading",
    emoji: "🚀",
    label: "+10% 매도",
    description: "10% 이상 수익으로 매도",
    reward: 25,
  },
  {
    key: "sell_20pct",
    category: "trading",
    emoji: "🌟",
    label: "+20% 매도",
    description: "20% 이상 수익으로 매도",
    reward: 50,
  },
  {
    key: "first_real_estate",
    category: "trading",
    emoji: "🏠",
    label: "첫 부동산",
    description: "부동산 첫 매수",
    reward: 15,
  },

  // 인생
  {
    key: "married",
    category: "life",
    emoji: "💒",
    label: "결혼",
    description: "결혼했어요",
    reward: 20,
  },
  {
    key: "first_child",
    category: "life",
    emoji: "👶",
    label: "첫 자녀",
    description: "첫 자녀 출생",
    reward: 25,
  },
  {
    key: "retired",
    category: "life",
    emoji: "🌅",
    label: "은퇴",
    description: "60세 도달 → 노후",
    reward: 30,
  },

  // Fun (재미)
  {
    key: "lottery_winner",
    category: "fun",
    emoji: "🎟️",
    label: "복권 당첨",
    description: "랜덤 이벤트로 복권 당첨",
    reward: 10,
  },
  {
    key: "survived_crisis",
    category: "fun",
    emoji: "🛡️",
    label: "위기 극복",
    description: "경제 위기 이벤트 후에도 환생 성공",
    reward: 20,
  },
];

export const ACHIEVEMENT_CATEGORY_LABEL: Record<string, string> = {
  education: "🎓 교육",
  career: "💼 커리어",
  wealth: "💰 자산",
  rebirth: "🌅 환생",
  trading: "📊 트레이딩",
  life: "🏡 인생",
  fun: "🎉 재미",
};

// ───── Achievement 체크 로직 ────────────────────────────
export type AchievementContext = {
  intelligence: number;
  job_type: "unemployed" | "parttime" | "fulltime";
  job_title: string | null;
  total_assets: number;
  rebirth_count: number;
  days_played: number;
  is_married: boolean;
  children_count: number;
  is_retired: boolean;
  /** 매도 시 최고 수익률 (양수만) */
  highest_sell_pct?: number;
  /** 본 라이프에서 첫 매수했는지 */
  has_bought?: boolean;
  /** 본 라이프에서 첫 매도 수익 */
  has_sold_profit?: boolean;
  /** 부동산 매수 했는지 */
  has_real_estate?: boolean;
  /** 복권 당첨 이벤트 발생했는지 */
  lottery_won?: boolean;
  /** 경제 위기 이벤트 후 환생했는지 */
  survived_crisis?: boolean;
};

/** unlock 가능한 업적 key 리스트 반환 */
export function checkAchievements(ctx: AchievementContext): string[] {
  const unlocked: string[] = [];

  // 교육
  if (ctx.intelligence >= 200) unlocked.push("ged_passed");
  if (ctx.intelligence >= 600) unlocked.push("university");
  if (ctx.intelligence >= 1000) unlocked.push("intelligent");
  if (ctx.intelligence >= 2000) unlocked.push("scholar");

  // 커리어
  if (ctx.job_type === "parttime" || ctx.job_type === "fulltime")
    unlocked.push("first_parttime");
  if (ctx.job_type === "fulltime") {
    unlocked.push("first_fulltime");
    const rankIdx = ["사원", "대리", "과장", "차장", "부장"].indexOf(
      ctx.job_title ?? "사원",
    );
    if (rankIdx >= 1) unlocked.push("rank_daeri");
    if (rankIdx >= 2) unlocked.push("rank_gwajang");
    if (rankIdx >= 3) unlocked.push("rank_chajang");
    if (rankIdx >= 4) unlocked.push("rank_bujang");
  }

  // 자산
  if (ctx.total_assets >= 50_000_000) unlocked.push("wealth_50m");
  if (ctx.total_assets >= 100_000_000) unlocked.push("wealth_100m");
  if (ctx.total_assets >= 500_000_000) unlocked.push("wealth_500m");
  if (ctx.total_assets >= 1_000_000_000) unlocked.push("wealth_1b");

  // 환생
  if (ctx.rebirth_count >= 1) unlocked.push("first_rebirth");
  if (ctx.rebirth_count >= 5) unlocked.push("rebirth_5");
  if (ctx.rebirth_count >= 10) unlocked.push("rebirth_10");
  if (ctx.rebirth_count >= 25) unlocked.push("rebirth_25");
  if (ctx.days_played > 0 && ctx.days_played <= 7) unlocked.push("fast_rebirth_7d");

  // 트레이딩
  if (ctx.has_bought) unlocked.push("first_buy");
  if (ctx.has_sold_profit) unlocked.push("first_sell_profit");
  if (ctx.highest_sell_pct != null && ctx.highest_sell_pct >= 0.05)
    unlocked.push("sell_5pct");
  if (ctx.highest_sell_pct != null && ctx.highest_sell_pct >= 0.1)
    unlocked.push("sell_10pct");
  if (ctx.highest_sell_pct != null && ctx.highest_sell_pct >= 0.2)
    unlocked.push("sell_20pct");
  if (ctx.has_real_estate) unlocked.push("first_real_estate");

  // 인생
  if (ctx.is_married) unlocked.push("married");
  if (ctx.children_count >= 1) unlocked.push("first_child");
  if (ctx.is_retired) unlocked.push("retired");

  // Fun
  if (ctx.lottery_won) unlocked.push("lottery_winner");
  if (ctx.survived_crisis) unlocked.push("survived_crisis");

  return unlocked;
}
