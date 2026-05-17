// Plan #40: 일일 미션 — 매일 자정에 3개씩 회전.

export type MissionDef = {
  key: string;
  emoji: string;
  label: string;
  target: number;
  reward: number;
  /** 진행 체크 방식 — game_diary나 character 조회로 판정 */
  checkType:
    | "trade_buy"      // 매수 N회
    | "trade_sell"     // 매도 N회
    | "sell_profit"    // 수익 매도 N회
    | "intelligence_gain" // 지력 N 증가
    | "cash_earned"    // cash 누적 N원 획득
    | "events_seen"    // 랜덤 이벤트 N개 경험
    | "diary_check";   // 일기 페이지 진입
};

export const MISSION_POOL: MissionDef[] = [
  {
    key: "buy_1",
    emoji: "🛒",
    label: "주식 매수 1회",
    target: 1,
    reward: 10,
    checkType: "trade_buy",
  },
  {
    key: "sell_1",
    emoji: "💰",
    label: "주식 매도 1회",
    target: 1,
    reward: 15,
    checkType: "trade_sell",
  },
  {
    key: "sell_profit_1",
    emoji: "📈",
    label: "수익 매도 1회 (+% 이상)",
    target: 1,
    reward: 25,
    checkType: "sell_profit",
  },
  {
    key: "intelligence_50",
    emoji: "📚",
    label: "지력 +50 획득",
    target: 50,
    reward: 20,
    checkType: "intelligence_gain",
  },
  {
    key: "cash_500k",
    emoji: "💵",
    label: "오늘 50만원 벌기",
    target: 500_000,
    reward: 20,
    checkType: "cash_earned",
  },
  {
    key: "events_3",
    emoji: "🎁",
    label: "랜덤 이벤트 3개 경험",
    target: 3,
    reward: 15,
    checkType: "events_seen",
  },
  {
    key: "diary_check",
    emoji: "📖",
    label: "일기 확인하기",
    target: 1,
    reward: 5,
    checkType: "diary_check",
  },
];

/** 하루 시드 → 3개 미션 결정적 선택 (자정 변경) */
export function pickDailyMissions(dateKey: string): MissionDef[] {
  // dateKey hash → 결정적 셔플
  let seed = 0;
  for (let i = 0; i < dateKey.length; i++) {
    seed = (seed * 31 + dateKey.charCodeAt(i)) | 0;
  }
  const sorted = [...MISSION_POOL].map((m, i) => ({
    m,
    sortKey: (seed * (i + 1) * 7919) ^ ((seed >> 8) + i),
  }));
  sorted.sort((a, b) => a.sortKey - b.sortKey);
  return sorted.slice(0, 3).map((s) => s.m);
}

/** 한국 시간 기준 오늘 date_key (YYYY-MM-DD) */
export function todayDateKey(): string {
  const now = new Date();
  // KST = UTC+9
  const kst = new Date(now.getTime() + 9 * 3600_000);
  return kst.toISOString().slice(0, 10);
}
