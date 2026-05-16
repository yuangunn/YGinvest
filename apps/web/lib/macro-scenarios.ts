// Plan #28: 거시지표 조합 시나리오 — 학습용 하드코딩 가이드.
// 각 시나리오는 여러 지표의 추세 조합 + 의미 + 자산별 영향 + 역사적 사례.

export type Trend = "up" | "down" | "flat" | "either";

export type IndicatorSignal = {
  /** 지표 라벨 (한글) */
  name: string;
  /** macro_meta의 symbol (link용, 선택) */
  symbol?: string;
  trend: Trend;
  /** 이 시나리오에서 왜 그렇게 움직이는지 */
  why: string;
};

export type AssetImpact = {
  asset: string;
  impact: "positive" | "negative" | "mixed" | "neutral";
  reason: string;
};

export type MacroScenario = {
  id: string;
  title: string;
  /** 한 줄 요약 */
  tagline: string;
  /** 핵심 emoji */
  emoji: string;
  indicators: IndicatorSignal[];
  /** 상세 의미 (2-3 단락) */
  meaning: string;
  /** 자산별 영향 */
  assetImpact: AssetImpact[];
  /** 역사적 사례 */
  historicalExamples: string[];
  /** 투자 가이드 (bullet points) */
  investmentGuide: string[];
  /** 경고 / 주의사항 */
  warning?: string;
};

export const MACRO_SCENARIOS: MacroScenario[] = [
  {
    id: "tightening-cycle",
    title: "긴축 사이클 (Hawkish Fed)",
    tagline: "금리 인상 + 달러 강세 + 환율 상승 — 자본 유출 신호",
    emoji: "🏦",
    indicators: [
      {
        name: "기준금리 (Fed Funds / 한은)",
        symbol: "FED_FUNDS",
        trend: "up",
        why: "중앙은행이 인플레를 잡으려 정책금리 인상",
      },
      {
        name: "달러 인덱스 (DXY)",
        symbol: "DXY",
        trend: "up",
        why: "고금리 USD로 글로벌 자금 유입",
      },
      {
        name: "원/달러 환율 (USDKRW)",
        symbol: "USDKRW",
        trend: "up",
        why: "한국에서 자본 유출 → 원화 약세",
      },
      {
        name: "미국 10년 국채 수익률",
        symbol: "TNX10Y",
        trend: "up",
        why: "정책금리 + 인플레 기대 상승으로 장기금리 동반 상승",
      },
      {
        name: "VIX (변동성)",
        symbol: "VIX",
        trend: "up",
        why: "긴축 충격 + 미래 불확실성",
      },
    ],
    meaning:
      "중앙은행이 인플레를 통제하기 위해 적극적으로 금리를 올리는 국면. 미국이 한국보다 빠르게 인상하면 한미 금리차 ↑ → 한국 자본 유출 → 환율 상승. 동시에 채권 가격 하락(yield↑ = price↓), 주식 valuation 압박 (할인율↑).\n\n특히 듀레이션이 긴 성장주(테크, 바이오)가 가장 큰 타격. 반대로 은행/보험은 예대마진 확대로 수혜.\n\n신흥국엔 이중고: 자본 유출 + 달러 부채 부담 ↑. 'Taper Tantrum' (2013), 2022 Fed 긴축에서 신흥국이 가장 큰 충격.",
    assetImpact: [
      {
        asset: "성장주 / 테크",
        impact: "negative",
        reason: "DCF 할인율↑ → valuation 압박. 2022 NASDAQ -33%",
      },
      {
        asset: "은행 / 금융",
        impact: "positive",
        reason: "예대마진 확대 (대출 금리 인상이 예금 금리보다 빠름)",
      },
      {
        asset: "장기 국채",
        impact: "negative",
        reason: "듀레이션 효과로 가격 폭락. 2022 TLT -30%",
      },
      {
        asset: "단기 국채 / 현금",
        impact: "positive",
        reason: "예금/MMF 금리 ↑ → 무위험 수익 매력",
      },
      {
        asset: "한국 수출주 (반도체/자동차)",
        impact: "mixed",
        reason: "원화 약세 환차익 ↑ 그러나 글로벌 수요 둔화 우려",
      },
      {
        asset: "한국 내수주",
        impact: "negative",
        reason: "원화 약세 + 수입물가 ↑ + 가계 부담 ↑",
      },
      {
        asset: "신흥국 채권",
        impact: "negative",
        reason: "달러 부채 부담 + 자본 유출",
      },
      {
        asset: "금",
        impact: "mixed",
        reason: "실질금리 ↑은 부정적, 인플레 헤지 수요는 긍정적",
      },
    ],
    historicalExamples: [
      "**2022 Fed 긴축**: 4.5%p 인상 (0→4.5%), NASDAQ -33%, KOSPI -25%, 원달러 1,442원 돌파",
      "**1994 Greenspan 긴축**: 1년에 3%p 인상, 채권 시장 대학살, 멕시코 페소 위기 촉발",
      "**2013 Taper Tantrum**: QE 축소만 시사했는데도 신흥국 자본 유출 + 환율 폭등",
    ],
    investmentGuide: [
      "**현금 비중 ↑** (3-6개월 생활비 + 추가 매수 실탄)",
      "**가치주/배당주** 비중 ↑ — 은행, 통신, 필수소비재",
      "**단기 채권 / 예금** — 무위험 수익 활용",
      "**성장주는 분할 매수**로 평균단가 낮추기 (한 번에 X)",
      "**환헤지** — USD 보유 비중 ↑ 또는 환헤지 ETF",
      "**부채 줄이기** — 변동금리 대출은 우선 상환",
    ],
    warning:
      "긴축은 종종 '갑작스러운 위기'로 끝남 — 1994 멕시코, 1997 아시아, 2008 GFC, 2023 SVB. 신용 스프레드(정크본드 yield)를 동반 관찰.",
  },

  {
    id: "easing-cycle",
    title: "완화 사이클 (Dovish Pivot)",
    tagline: "금리 인하 + 달러 약세 + 환율 하락 — 자산 가격 부양",
    emoji: "🕊️",
    indicators: [
      {
        name: "기준금리",
        symbol: "FED_FUNDS",
        trend: "down",
        why: "경기 둔화/인플레 완화로 중앙은행이 금리 인하 시작",
      },
      {
        name: "달러 인덱스 (DXY)",
        symbol: "DXY",
        trend: "down",
        why: "저금리로 USD 매력 ↓",
      },
      {
        name: "원/달러 환율",
        symbol: "USDKRW",
        trend: "down",
        why: "달러 약세 → 원화 강세",
      },
      {
        name: "10년 국채 수익률",
        symbol: "TNX10Y",
        trend: "down",
        why: "할인율 ↓ + 침체 우려에 안전자산 수요 ↑",
      },
      {
        name: "VIX",
        symbol: "VIX",
        trend: "down",
        why: "유동성 풍부 + 정책 지원 기대",
      },
    ],
    meaning:
      "중앙은행이 경기 둔화 또는 인플레 정점을 확인하고 금리를 내리는 국면. 시장은 보통 'Fed Pivot' 시그널만 보고도 환호 — 유동성 회복 기대.\n\n할인율 ↓ → 모든 자산 valuation ↑. 특히 성장주가 가장 크게 반등 (역으로 작용). 채권 가격 ↑, 주식 ↑, 금 ↑ — 'Everything Rally' 가능.\n\n한국 등 신흥국엔 자본 유입 → 통화 강세 + 주식시장 상승. 단, 글로벌 침체와 함께 오는 인하는 다른 얘기 (위기 모드 참조).",
    assetImpact: [
      {
        asset: "성장주 / 테크",
        impact: "positive",
        reason: "할인율 ↓ → DCF ↑. 2019 Fed 인하 시 NASDAQ +35%",
      },
      {
        asset: "장기 국채 / 부동산",
        impact: "positive",
        reason: "듀레이션 효과로 가격 상승. REITs 강세",
      },
      {
        asset: "은행",
        impact: "mixed",
        reason: "예대마진 ↓ but 대출 수요 ↑로 상쇄",
      },
      {
        asset: "신흥국 자산",
        impact: "positive",
        reason: "달러 약세 + 자본 유입 → 통화/주식 동반 강세",
      },
      {
        asset: "원자재",
        impact: "positive",
        reason: "달러 약세 + 글로벌 수요 회복 기대",
      },
      {
        asset: "금",
        impact: "positive",
        reason: "실질금리 ↓ → 금의 기회비용 ↓",
      },
    ],
    historicalExamples: [
      "**1995 Greenspan 인하**: 'Soft Landing' 성공. NASDAQ 5년 +400% 닷컴 시작",
      "**2019 Fed 보험성 인하**: 미중 무역 마찰 대응, S&P +29% 연간",
      "**2024 9월 Fed 50bp 인하**: NASDAQ 즉시 +5%, KOSPI 동조 상승",
    ],
    investmentGuide: [
      "**성장주 / 테크 비중 ↑** — 가장 큰 멀티플 회복 수혜",
      "**장기 채권 / TLT** — 듀레이션 활용",
      "**리츠 (REITs)** — 금리 인하 직격 수혜",
      "**신흥국 ETF (EEM, KODEX) 비중 ↑** — 자본 유입 사이클",
      "**현금 비중 ↓** — 무위험 수익 매력 감소",
    ],
    warning:
      "'Bad Pivot' 주의 — 침체로 어쩔 수 없이 인하하는 경우, 인하 시작 후 6-12개월 더 하락 (2001, 2008 패턴).",
  },

  {
    id: "stagflation-risk",
    title: "스태그플레이션 위험",
    tagline: "물가는 오르는데 경기는 침체 — 가장 어려운 시나리오",
    emoji: "🔥",
    indicators: [
      {
        name: "CPI / Core CPI",
        trend: "up",
        why: "인플레가 고착화 (공급 충격 또는 임금 상승)",
      },
      {
        name: "유가 (WTI)",
        symbol: "OIL_WTI",
        trend: "up",
        why: "지정학적 충격 또는 OPEC+ 감산",
      },
      {
        name: "실업률",
        trend: "up",
        why: "경기 둔화로 일자리 ↓",
      },
      {
        name: "GDP 성장률",
        trend: "down",
        why: "경기 위축",
      },
      {
        name: "기준금리",
        trend: "up",
        why: "인플레 통제 위해 어쩔 수 없이 인상 (경기 부담에도)",
      },
    ],
    meaning:
      "중앙은행에 최악의 시나리오. 금리 올리면 침체 악화, 내리면 인플레 가속. Phillips Curve가 깨진 상태.\n\n1970년대 미국이 대표 사례 — 오일쇼크 + 닉슨 가격통제 + 베트남 전비. 1973-1982 약 10년간 지속, S&P 실질수익률 -50%.\n\n2022년 일부 우려됐으나 다행히 회피. 다만 글로벌 공급망 약화 + 지정학 긴장 + 기후 인플레 등으로 향후 재발 가능성 ↑.",
    assetImpact: [
      {
        asset: "주식 (전반)",
        impact: "negative",
        reason: "이익↓ + 멀티플↓ 동시. 1970년대 실질 -50%",
      },
      {
        asset: "채권",
        impact: "negative",
        reason: "인플레 + 금리 인상으로 더블 펀치",
      },
      {
        asset: "금 / 은",
        impact: "positive",
        reason: "전통적 인플레 헤지. 1970년대 금 +1500%",
      },
      {
        asset: "원자재 (전반)",
        impact: "positive",
        reason: "실물 자산 가치 보존",
      },
      {
        asset: "TIPS (인플레이션 연동채)",
        impact: "positive",
        reason: "원금이 CPI에 연동되어 실질 가치 보존",
      },
      {
        asset: "부동산",
        impact: "mixed",
        reason: "실물자산이라 인플레 헤지 but 금리 부담",
      },
      {
        asset: "에너지 / 광물 주식",
        impact: "positive",
        reason: "원자재 가격 상승 직접 수혜",
      },
    ],
    historicalExamples: [
      "**1973-1982 미국**: 1차 오일쇼크 + 2차 오일쇼크 + Volcker 충격요법. CPI 14%, 실업 11% 동시. 다우 평균 10년 -40% 실질",
      "**1990 일본**: 부동산 거품 붕괴 후 디플레로 전환 (반대 사례지만 잃어버린 30년의 시작)",
      "**2022 경고**: CPI 9.1% + 우크라이나 전쟁 + GDP 둔화. Fed의 적극 대응으로 회피했으나 1년간 자산 동반 하락",
    ],
    investmentGuide: [
      "**원자재 ETF 비중 ↑** (DBC, GSG) — 인플레 헤지",
      "**금 / 은** — 전통적 가치 보존 (전체 자산의 5-15%)",
      "**TIPS / 인플레 연동채** — 명목채권 대신",
      "**에너지 주식** — 셰일/정유주",
      "**현금 비중 줄이기** — 인플레로 구매력 손실",
      "**부동산** — 임대수입 인플레 추종 가능",
    ],
    warning:
      "정통 60/40 포트폴리오가 가장 약한 환경. 2022처럼 주식·채권 동반 하락 가능. 자산군 다변화 필수.",
  },

  {
    id: "recession-imminent",
    title: "경기침체 임박 (Recession Warning)",
    tagline: "장단기 금리 역전 + VIX 급등 + 금 강세 — 위기 신호",
    emoji: "⚠️",
    indicators: [
      {
        name: "Yield Curve (10y - 2y)",
        trend: "down",
        why: "역전 (음수) — 침체 12-18개월 선행 지표",
      },
      {
        name: "VIX",
        symbol: "VIX",
        trend: "up",
        why: "변동성 확대, 헤지 수요 ↑",
      },
      {
        name: "금",
        symbol: "GOLD",
        trend: "up",
        why: "안전자산 선호",
      },
      {
        name: "신용 스프레드 (High Yield)",
        trend: "up",
        why: "기업 부도 위험 프리미엄 ↑",
      },
      {
        name: "실업률 (Sahm Rule)",
        trend: "up",
        why: "3개월 평균이 12개월 저점 대비 +0.5%p — 침체 선행",
      },
    ],
    meaning:
      "역사적으로 yield curve 역전은 12-18개월 후 침체를 예고. 1980년 이후 9번 중 8번 정확. 시장은 침체 6-12개월 전부터 하락 시작, 침체 중간에 바닥 잡고 회복.\n\n핵심 보조 지표: VIX 30 돌파, 신용 스프레드 6%p+, 실업률 +0.5%p (Sahm Rule), 제조업 PMI 50 하회.\n\n주의: 침체 '선언'은 보통 발생 후 1-2분기 뒤 (NBER 후행 발표). 시장은 선행 — 지표만 믿고 매도하면 too late.",
    assetImpact: [
      {
        asset: "주식 (특히 경기민감주)",
        impact: "negative",
        reason: "이익 둔화 + valuation 축소. 평균 침체 -30%",
      },
      {
        asset: "장기 국채",
        impact: "positive",
        reason: "안전자산 + Fed 인하 기대",
      },
      {
        asset: "금",
        impact: "positive",
        reason: "전통적 위기 헤지",
      },
      {
        asset: "방어주 (필수소비재, 유틸리티, 헬스케어)",
        impact: "mixed",
        reason: "절대 가격은 빠지지만 상대적으로 견조",
      },
      {
        asset: "회사채 / 정크본드",
        impact: "negative",
        reason: "스프레드 확대 → 가격 폭락",
      },
      {
        asset: "비트코인 / 위험자산",
        impact: "negative",
        reason: "유동성 회수 + 위험회피",
      },
    ],
    historicalExamples: [
      "**2007년 yield curve 역전 → 2008 GFC**: 18개월 시차, S&P -57%",
      "**2000년 역전 → 2001 닷컴 침체**: 12개월 시차, NASDAQ -78%",
      "**2022-2024 역사상 최장 yield curve 역전**: 730일+. 침체 회피 (soft landing 성공)",
    ],
    investmentGuide: [
      "**현금 비중 ↑** (20-30%) — 추가 매수 실탄",
      "**장기 국채 / TLT** — 안전자산 + Fed 인하 베팅",
      "**금 / IAU** — 위기 헤지 (5-15%)",
      "**고배당 방어주** — 침체 시 상대 우세",
      "**부채 축소** + 비용 절감",
      "**개별 종목 줄이고 ETF 비중 ↑** — 부도 위험 분산",
    ],
    warning:
      "침체 선행지표가 떴다고 즉시 매도는 위험 — 시그널 후에도 6-12개월 시장이 추가 상승하는 경우 많음 (1995-2000). 점진적으로 위험 조정.",
  },

  {
    id: "risk-on",
    title: "리스크온 (Risk-On Rally)",
    tagline: "VIX 안정 + 주식 강세 + 위험자산 동반 상승",
    emoji: "🚀",
    indicators: [
      {
        name: "VIX",
        symbol: "VIX",
        trend: "down",
        why: "낮은 변동성, 시장 안정",
      },
      {
        name: "신용 스프레드",
        trend: "down",
        why: "위험 프리미엄 축소 — 시장 낙관",
      },
      {
        name: "S&P 500",
        symbol: "SP500",
        trend: "up",
        why: "주식시장 상승 트렌드",
      },
      {
        name: "달러 인덱스 (DXY)",
        symbol: "DXY",
        trend: "down",
        why: "약달러 → 위험자산 유리",
      },
      {
        name: "원자재 / 비트코인",
        trend: "up",
        why: "글로벌 risk appetite ↑",
      },
    ],
    meaning:
      "시장이 위험을 적극 수용하는 국면. '유동성 풍부 + 경제 안정' 또는 '인플레 통제 + 침체 회피' 시나리오에서 발생.\n\n자산간 상관관계가 ↑로 수렴 (다 같이 오름). 신흥국·테크·코인 등 위험자산이 가장 큰 수익. 다만 환경 바뀌면 같이 빠짐 — 분산 효과 제한.\n\n역사적으로 가장 큰 부 축적의 시기지만, 또한 다음 약세장의 씨앗이 자라는 시기 (overvaluation, 레버리지 누적).",
    assetImpact: [
      {
        asset: "성장주 / 테크",
        impact: "positive",
        reason: "리스크 프리미엄 ↓ + 멀티플 확장",
      },
      {
        asset: "신흥국 (KOSPI 등)",
        impact: "positive",
        reason: "달러 약세 + 자본 유입",
      },
      {
        asset: "비트코인 / 크립토",
        impact: "positive",
        reason: "유동성과 risk appetite의 가장 민감한 자산",
      },
      {
        asset: "정크본드 / 회사채",
        impact: "positive",
        reason: "스프레드 축소로 가격 상승",
      },
      {
        asset: "방어주",
        impact: "mixed",
        reason: "절대 상승하지만 상대적 underperform",
      },
      {
        asset: "금 / 안전자산",
        impact: "negative",
        reason: "위기 프리미� 빠짐",
      },
    ],
    historicalExamples: [
      "**2017 골디락스**: 인플레 낮음 + 성장 견조. S&P +21%, 비트코인 +1300%",
      "**2020.4-2021**: 코로나 QE → 모든 자산 동반 상승. SPY +75%, ARKK +150%",
      "**2024**: AI 광기 + Fed pivot 기대. NVDA +170%, S&P +25%",
    ],
    investmentGuide: [
      "**성장주 / 테크 ↑** but 한꺼번에 다 들이 X",
      "**모멘텀 종목** 분할 매수",
      "**리츠 / 부동산**",
      "**점진적 익절** — 너무 큰 수익은 욕심 X",
      "**Risk-off 신호 모니터링** — VIX 20 돌파, 신용 스프레드 확대",
      "**현금 비중을 0으로 만들지 X** — 다음 조정 대비",
    ],
    warning:
      "Euphoria 단계 진입 신호: 신규 진입자 폭증, 'this time is different', PER 사상 최고. Buffett: '남들이 욕심부릴 때 두려워하라'.",
  },

  {
    id: "risk-off",
    title: "리스크오프 (Risk-Off / 패닉)",
    tagline: "VIX 폭등 + 안전자산 급등 + 주식 폭락 — 위기 모드",
    emoji: "🚨",
    indicators: [
      {
        name: "VIX",
        symbol: "VIX",
        trend: "up",
        why: "30+ 돌파 — 패닉 모드",
      },
      {
        name: "달러 인덱스 (DXY)",
        symbol: "DXY",
        trend: "up",
        why: "달러 도피 (안전자산)",
      },
      {
        name: "금",
        symbol: "GOLD",
        trend: "up",
        why: "위기 헤지 수요 ↑",
      },
      {
        name: "10년 국채",
        symbol: "TNX10Y",
        trend: "down",
        why: "안전자산 수요로 채권 가격 ↑ (yield ↓)",
      },
      {
        name: "신용 스프레드",
        trend: "up",
        why: "부도 위험 가격 반영",
      },
      {
        name: "엔화 (JPY)",
        trend: "up",
        why: "전통적 안전통화. 캐리 청산",
      },
    ],
    meaning:
      "시장 참가자들이 한꺼번에 위험자산을 처분하고 안전자산으로 도피. 보통 트리거가 있음 (Lehman, 코로나, 9.11 등).\n\n특징: 자산간 상관관계가 모두 1에 수렴 → 분산 효과 실종 ('all correlations go to 1'). 단 안전자산 (USD, JPY, 금, 미국 단기국채)은 상승.\n\n패닉은 보통 며칠~몇주 격렬 후, 정책 대응(QE, 금리 인하)으로 안정화. 바닥 잡기는 거의 불가능 — 어두운 새벽 같은 V자 반등이 자주 나옴.",
    assetImpact: [
      {
        asset: "주식 (전반)",
        impact: "negative",
        reason: "Forced selling + 마진콜 + 패닉. -20~-50%",
      },
      {
        asset: "고변동성 자산 (코인, ARKK, 잡주)",
        impact: "negative",
        reason: "유동성 부족으로 spread 폭발",
      },
      {
        asset: "달러 (USD)",
        impact: "positive",
        reason: "기축통화 도피",
      },
      {
        asset: "미국 단기국채",
        impact: "positive",
        reason: "최후의 안전자산",
      },
      {
        asset: "금",
        impact: "positive",
        reason: "전통적 위기 헤지",
      },
      {
        asset: "엔화",
        impact: "positive",
        reason: "캐리 청산 + 안전통화 도피",
      },
      {
        asset: "원화 (KRW)",
        impact: "negative",
        reason: "신흥국 통화 폭락 (자본 유출)",
      },
      {
        asset: "장기 국채 (TLT)",
        impact: "mixed",
        reason: "보통 강세지만 2022처럼 인플레+위기 동시면 약세",
      },
    ],
    historicalExamples: [
      "**2008.10 리먼 파산**: VIX 89, S&P -38% 6개월, 금 +5%",
      "**2020.3 코로나**: VIX 82, S&P -34% 1개월, 미국 단기국채 강세",
      "**2024.8 블랙먼데이**: VIX 65, KOSPI -8.77% 단일 일자",
    ],
    investmentGuide: [
      "**현금 비중 ↑** — 추가 매수 실탄 준비",
      "**달러 / 미국 단기국채** — 위기 회피",
      "**금 / IAU** — 헤지 + 후일 반등",
      "**우량주 분할 매수** — Buffett: '피가 흐를 때 사라'",
      "**레버리지 / 신용거래 청산** — 마진콜 위험",
      "**시장 타이밍 시도 X** — V자 반등 잡기 어려움. 정기적립이 답",
    ],
    warning:
      "패닉 매도가 가장 큰 손실. 1987 블랙먼데이는 1년 안에 회복. 2020 코로나는 6개월 회복. 매도 후 반등 못 잡으면 영구 손실.",
  },

  {
    id: "kr-weak-won",
    title: "원화 약세 가속 (KRW Devaluation)",
    tagline: "USDKRW 급등 + 한미 금리차 + 자본 유출",
    emoji: "🇰🇷",
    indicators: [
      {
        name: "USDKRW",
        symbol: "USDKRW",
        trend: "up",
        why: "원화 약세 가속 (1,400원+)",
      },
      {
        name: "한미 금리차 (US - KR)",
        trend: "up",
        why: "미국이 한국보다 빠르게 인상 / 한국이 먼저 인하",
      },
      {
        name: "외국인 한국 주식 순매도",
        trend: "up",
        why: "환율 손실 회피 + 자본 유출",
      },
      {
        name: "KR 외환보유고",
        trend: "down",
        why: "한은이 환율 방어 위해 USD 매도 → 감소",
      },
      {
        name: "DXY",
        symbol: "DXY",
        trend: "up",
        why: "달러 전반 강세 추세 (역도 가능)",
      },
    ],
    meaning:
      "원/달러가 1,400원을 넘어가면 한국 경제에 부담. 수입물가 상승 → 인플레 ↑, 대외부채 부담 ↑, 자본 유출 ↑. 한은은 미국 따라 금리 인상 압박.\n\n수출 대기업(삼성전자, 현대차, SK하이닉스)은 단기적 환차익 ↑. 그러나 글로벌 수요 둔화와 동반 발생하면 매출 감소가 더 큼.\n\n역사적 마지노선: 1,200원, 1,300원, 1,400원, 1,500원. 1,500원 돌파 시 외환위기급 신호 (1997 1,962원, 2009 1,597원, 2022 1,442원).",
    assetImpact: [
      {
        asset: "한국 수출주 (반도체, 자동차)",
        impact: "mixed",
        reason: "환차익 +, but 외국인 매도로 주가 하락 가능",
      },
      {
        asset: "한국 내수주 (유통, 항공)",
        impact: "negative",
        reason: "수입물가 ↑, 해외여행 위축",
      },
      {
        asset: "달러 표시 자산 보유자",
        impact: "positive",
        reason: "원화 환산 시 수익",
      },
      {
        asset: "외화 부채 기업 (항공)",
        impact: "negative",
        reason: "외화 부채 부담 ↑",
      },
      {
        asset: "한국 채권",
        impact: "negative",
        reason: "자본 유출 + 한은 금리 인상 압력",
      },
    ],
    historicalExamples: [
      "**1997 IMF**: 750원 → 1,962원 (6개월), 한국 경제 패닉",
      "**2008 GFC**: 1,003원 → 1,597원, 외환위기 재발 우려",
      "**2022 Fed 긴축**: 1,200원 → 1,442원, 외환당국 개입",
      "**2024 12월 정치 리스크**: 일시 1,490원 돌파",
    ],
    investmentGuide: [
      "**USD 자산 비중 ↑** — 환헤지 자연스러움 (미국 주식, SPY)",
      "**수출 대기업 비중 ↑** — 삼성전자, 현대차, SK하이닉스",
      "**환헤지 ETF 활용** — 환율 위험 없이 미국 노출",
      "**원화 현금 줄이기** — 구매력 잠식",
      "**해외여행 / 유학 자녀 비용** — 미리 USD 환전",
    ],
    warning:
      "환율은 정치 + 심리 영향 매우 큼. 한은 + 정부 개입으로 단기 급변 가능. 환율 베팅 (단기 트레이딩) 매우 위험.",
  },

  {
    id: "oil-shock",
    title: "유가 충격 (Oil Shock)",
    tagline: "유가 급등 + 인플레 ↑ + 항공/물류 직격",
    emoji: "🛢️",
    indicators: [
      {
        name: "WTI 유가",
        symbol: "OIL_WTI",
        trend: "up",
        why: "공급 충격 (OPEC+ 감산, 지정학) 또는 수요 급증",
      },
      {
        name: "CPI",
        trend: "up",
        why: "에너지 가격 전이 (1-3개월 시차)",
      },
      {
        name: "PPI",
        trend: "up",
        why: "생산자 물가 즉시 상승",
      },
      {
        name: "10년 국채 yield",
        trend: "up",
        why: "인플레 기대 상승 반영",
      },
    ],
    meaning:
      "유가는 모든 가격의 시작점. 운송, 화학, 식품, 플라스틱 등 거의 모든 산업의 원가에 영향. WTI $100 돌파는 글로벌 인플레의 신호탄.\n\n트리거: 중동 분쟁(이란-이스라엘, 러시아 우크라이나), OPEC+ 감산 발표, 미국 셰일 생산 둔화, 중국 수요 급증.\n\n역사: 1973-74 (4배), 1979-80 (3배), 2008 ($147), 2022 ($120) 모두 침체 또는 위기 동반. 단 미국은 셰일혁명 이후 자체 에너지 자급률 ↑ → 충격 흡수력 ↑.",
    assetImpact: [
      {
        asset: "에너지 주식 (XOM, CVX, 정유)",
        impact: "positive",
        reason: "마진 직접 확대",
      },
      {
        asset: "항공주",
        impact: "negative",
        reason: "연료비가 매출의 20-30% — 직격탄",
      },
      {
        asset: "운송 / 물류",
        impact: "negative",
        reason: "원가 상승, 가격 전가 어려움",
      },
      {
        asset: "필수소비재",
        impact: "negative",
        reason: "가공/포장 비용 상승, 가격 저항",
      },
      {
        asset: "원자재 ETF",
        impact: "positive",
        reason: "전반적 commodity rally",
      },
      {
        asset: "신흥국 (산유국 외)",
        impact: "negative",
        reason: "수입 인플레 + 무역수지 악화",
      },
      {
        asset: "러시아 / 사우디",
        impact: "positive",
        reason: "산유국 경상수지 ↑",
      },
    ],
    historicalExamples: [
      "**1973 OPEC 금수**: 유가 4배 ($3→$12), 미국 1차 오일쇼크 + 침체",
      "**1979 이란혁명**: 유가 3배 ($15→$40), 2차 오일쇼크 + 스태그플레이션",
      "**2008.7 $147 정점**: 글로벌 금융위기 직전 정점",
      "**2022.3 우크라이나**: $90→$130 (3월), 항공주 -30%",
    ],
    investmentGuide: [
      "**에너지 ETF (XLE, KODEX 에너지) 비중 ↑**",
      "**정유주 / 셰일주** — 직접 수혜",
      "**원자재 ETF (DBC, GSG)**",
      "**항공/물류 비중 ↓** 또는 매도",
      "**필수소비재 약세 — 단, 가격 전가 가능 기업(코카콜라)은 선방**",
      "**전기차 / 재생에너지** 장기 수혜 가능",
    ],
    warning:
      "유가 급등 + 침체 동시 발생 (스태그플레이션) 가능. 1973년 패턴. 항공/소비재/내수에 큰 부담.",
  },
];

export function getScenarioById(id: string): MacroScenario | undefined {
  return MACRO_SCENARIOS.find((s) => s.id === id);
}
