// Plan #32: 테마 slug → 관련 ETF symbol 매핑 (하드코딩 큐레이션).
//
// 사용자가 테마 페이지에서 종목 고르기 어려우면 ETF로 분산 투자 옵션 제공.
// 각 테마마다 KR/US ETF 1~3개 추천.

export type ThemeEtfMap = Record<string, string[]>;

export const THEME_ETF_MAP: ThemeEtfMap = {
  // ── AI / LLM 체인 ─────────────────────────────────────────
  "llm-ai": ["469150.KS", "SOXX"],
  "semiconductor": ["091160.KS", "381180.KS", "SOXX"],
  "hbm-ai-semi": ["091160.KS", "SOXX"],
  "foundry": ["091160.KS", "381180.KS"],
  "system-semi": ["091160.KS", "SOXX"],
  "cloud": ["XLK", "QQQ"],
  "ai-software": ["469150.KS", "QQQ"],
  "saas": ["XLK"],

  // ── EV / 배터리 ──────────────────────────────────────────
  "auto-oem": ["305540.KS", "305720.KS"],
  "battery-cell": ["305540.KS", "305720.KS"],
  "battery-equipment": ["305720.KS"],
  "cathode": ["305540.KS", "305720.KS"],
  "anode": ["305540.KS", "305720.KS"],
  "electrolyte": ["305540.KS"],
  "separator": ["305540.KS"],

  // ── 미국 광범위 / 나스닥 ──────────────────────────────────
  // (대표 추종)

  // ── 반도체 ────────────────────────────────────────────────
  "semi-equipment": ["091160.KS", "SOXX"],
  "semi-materials": ["091160.KS"],

  // ── 자율주행 / 로보틱스 ──────────────────────────────────
  "autonomous": ["ARKK", "QQQ"],
  "robotics": ["ARKK"],
  "mobility": ["ARKK"],

  // ── 신재생 / 에너지 ──────────────────────────────────────
  "renewable": ["XLE"],
  "nuclear": [],
  "power-equipment": [],
  "electric-utility": [],

  // ── 조선 / 방산 ──────────────────────────────────────────
  "shipbuilding": [],
  "defense": [],
  "aerospace-defense": [],

  // ── 바이오 / 의료 ───────────────────────────────────────
  "bio": ["266420.KS"],
  "new-drug": ["266420.KS"],
  "biosimilar": ["266420.KS"],
  "cmo-cdmo": ["266420.KS"],
  "medical-aesthetics": ["266420.KS"],

  // ── K-콘텐츠 ────────────────────────────────────────────
  "k-content": [],
  "k-ent": [],
  "media-drama": [],

  // ── 채권/원자재 ─────────────────────────────────────────
  // ETF 자체가 자산이라 직접 테마 매핑은 약함

  // ── 글로벌 ───────────────────────────────────────────────
  // 일본/중국 ETF는 거시경제 테마 페이지에서 별도 처리
};

export function getEtfsForTheme(slug: string): string[] {
  return THEME_ETF_MAP[slug] ?? [];
}
