// 섹터별 거시 변수 민감도 (학습용 단순 모델).
// 실제 베타는 회귀분석으로 추정해야 하지만, 학습 목적이라 경험적 룰 사용.
//
// 각 값: 해당 거시 변수가 +1 표준 단위 움직였을 때 섹터 주가의 expected 반응 (%)
// 예: rate=+1 → 0.01 (= 1%p 인상), fx=+10 → 0.1 (= 원화 10% 약세)
//
// 부호:
//   rate +: 금리 인상 → 일반적으로 주식 약세 (할인율↑)
//   fx +:   원화 약세 → 수출주 우호, 내수주 부담
//   oil +:  유가 상승 → 에너지·소재 강세, 항공·소비재 부담
//   vix +:  변동성 확대 → 모든 주식 약세 (방어주는 덜)

export type SectorSensitivity = {
  rate: number;   // 금리 +1%p 시 주가 % 변화
  fx: number;     // 원화 -10% 약세 시 주가 % 변화 (USDKRW +100원 가정)
  oil: number;   // WTI 유가 +20% 상승 시 주가 % 변화
  vix: number;   // VIX +10pt (예: 20→30) 시 주가 % 변화
};

// "general" key = 매칭 안되는 섹터 default
export const SECTOR_SENSITIVITY: Record<string, SectorSensitivity> = {
  technology: { rate: -8, fx: 6, oil: -1, vix: -10 },
  semiconductors: { rate: -10, fx: 8, oil: -1, vix: -12 },
  financials: { rate: 6, fx: -2, oil: 0, vix: -8 },
  banks: { rate: 7, fx: -2, oil: 0, vix: -8 },
  energy: { rate: -2, fx: 1, oil: 12, vix: -3 },
  materials: { rate: -3, fx: 5, oil: 4, vix: -6 },
  steel: { rate: -3, fx: 4, oil: 2, vix: -7 },
  industrials: { rate: -4, fx: 4, oil: -2, vix: -8 },
  consumer_discretionary: { rate: -5, fx: -3, oil: -3, vix: -9 },
  consumer_staples: { rate: -1, fx: -2, oil: -1, vix: -3 },
  healthcare: { rate: -3, fx: 0, oil: -1, vix: -4 },
  utilities: { rate: -5, fx: 0, oil: -1, vix: -2 },
  real_estate: { rate: -10, fx: 0, oil: 0, vix: -6 },
  communication: { rate: -4, fx: 1, oil: -1, vix: -5 },
  airlines: { rate: -5, fx: -4, oil: -10, vix: -12 },
  auto: { rate: -5, fx: 6, oil: -3, vix: -8 },
  general: { rate: -4, fx: 1, oil: -2, vix: -7 },
};

// stocks.sector(다양한 형태) → SECTOR_SENSITIVITY key 매핑
const SECTOR_KEYWORDS: { keys: string[]; sector: keyof typeof SECTOR_SENSITIVITY }[] = [
  { keys: ["semiconductor", "반도체"], sector: "semiconductors" },
  { keys: ["technology", "software", "internet", "tech", "정보기술", "it", "소프트"], sector: "technology" },
  { keys: ["bank", "은행"], sector: "banks" },
  { keys: ["financial", "insurance", "금융", "보험", "증권"], sector: "financials" },
  { keys: ["energy", "oil", "gas", "에너지", "정유"], sector: "energy" },
  { keys: ["steel", "철강"], sector: "steel" },
  { keys: ["material", "chemical", "소재", "화학"], sector: "materials" },
  { keys: ["airline", "항공"], sector: "airlines" },
  { keys: ["industrial", "industry", "산업재"], sector: "industrials" },
  { keys: ["staples", "필수소비", "food", "household"], sector: "consumer_staples" },
  { keys: ["discretionary", "consumer", "retail", "소비"], sector: "consumer_discretionary" },
  { keys: ["health", "biotech", "pharma", "헬스케어", "제약", "바이오"], sector: "healthcare" },
  { keys: ["utilit", "유틸리티", "전력"], sector: "utilities" },
  { keys: ["real estate", "reit", "부동산"], sector: "real_estate" },
  { keys: ["communication", "telecom", "통신"], sector: "communication" },
  { keys: ["auto", "motor", "vehicle", "자동차"], sector: "auto" },
];

export function sensitivityForSector(sectorRaw: string | null): SectorSensitivity {
  if (!sectorRaw) return SECTOR_SENSITIVITY.general;
  const s = sectorRaw.toLowerCase();
  for (const { keys, sector } of SECTOR_KEYWORDS) {
    if (keys.some((k) => s.includes(k))) {
      return SECTOR_SENSITIVITY[sector];
    }
  }
  return SECTOR_SENSITIVITY.general;
}
