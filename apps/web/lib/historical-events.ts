// 주요 경제 사건 타임라인 — 학습 컨텐츠.
// 각 사건의 KOSPI/S&P 등 시장 반응은 stock_bars 또는 macro_indicators 데이터로 그릴 수 있음.

export type HistoricalEvent = {
  id: string;
  startDate: string;   // ISO date (위기 시작)
  peakDate?: string;   // 최악의 시점 (최저점)
  endDate?: string;    // 회복 완료 추정 (또는 "현재 진행 중"이면 undefined)
  title: string;
  shortTitle: string;
  region: "KR" | "US" | "GLOBAL";
  kospiDrop?: number;  // % 낙폭 (예: -47)
  spDrop?: number;     // % 낙폭
  summary: string;     // 1-2문장
  causes: string[];    // 원인 (3-5개 bullet)
  effects: string[];   // 결과 / 시사점 (3-5개 bullet)
  recoveryMonths?: number;
  bestSector?: string; // 당시 가장 잘 버틴 섹터 (참고용)
  worstSector?: string;
};

export const HISTORICAL_EVENTS: HistoricalEvent[] = [
  {
    id: "asian-fc-1997",
    startDate: "1997-07-02",
    peakDate: "1998-06-16",
    endDate: "1999-12-31",
    title: "1997 아시아 외환위기 (IMF 사태)",
    shortTitle: "1997 IMF",
    region: "KR",
    kospiDrop: -65,
    summary:
      "태국 바트화 폭락이 도화선이 되어 아시아 전역으로 확산. 한국은 외환보유고 고갈로 IMF 구제금융 신청.",
    causes: [
      "단기외채 과다 / 외환보유고 부족",
      "재벌 차입경영 + 부실 대출 누적",
      "환율 방어 실패로 원화 1,962원까지 폭락",
      "동남아 통화 위기 전염",
    ],
    effects: [
      "재벌 30대 중 16개 부도/구조조정",
      "대량 실업 + 기업 외국인 매각 (외환은행, 삼성차 등)",
      "주식시장 -65% (1991의 1/3 수준)",
      "IMF 구조조정 → 외환보유고 중시 + 자본시장 개방",
    ],
    recoveryMonths: 30,
    bestSector: "수출 대기업 (환율 효과)",
    worstSector: "금융 / 건설",
  },
  {
    id: "dotcom-2000",
    startDate: "2000-03-10",
    peakDate: "2002-10-09",
    endDate: "2007-10-15",
    title: "닷컴 버블 붕괴 (2000)",
    shortTitle: "Dotcom 2000",
    region: "US",
    spDrop: -49,
    summary:
      "1990년대 후반 인터넷 기업 과열 → NASDAQ -78% 폭락. 실적 없는 IT 기업의 천문학적 밸류에이션 붕괴.",
    causes: [
      "1995-2000 NASDAQ 5배 상승, P/E 200배+ 종목 다수",
      "Y2K 대비 IT 투자 폭증의 부메랑",
      "닷컴 회사들 실제 매출 없이 IPO + burn rate 무한정",
      "FOMC 1999-2000 금리 인상 (6.5%)",
    ],
    effects: [
      "NASDAQ -78% (5,048 → 1,114)",
      "Pets.com 등 수많은 닷컴 폐업",
      "Amazon, Cisco 등도 -90% 이상 (이후 회복)",
      "테크 IPO 시장 4년 동결",
    ],
    recoveryMonths: 90,
    worstSector: "테크 / 인터넷",
    bestSector: "필수소비재 / 유틸리티",
  },
  {
    id: "gfc-2008",
    startDate: "2007-12-01",
    peakDate: "2009-03-09",
    endDate: "2013-03-28",
    title: "글로벌 금융위기 (2008)",
    shortTitle: "GFC 2008",
    region: "GLOBAL",
    kospiDrop: -56,
    spDrop: -57,
    summary:
      "미국 서브프라임 모기지 부실 → 리먼브라더스 파산 → 전 세계 신용경색. 2차 대공황 수준의 위기.",
    causes: [
      "서브프라임 모기지 + CDO/CDS 과도한 레버리지",
      "신용평가사 무책임한 AAA 등급 부여",
      "주택가격 거품 + 무자격 대출 (NINJA loans)",
      "리먼브라더스 파산으로 신용 동결",
    ],
    effects: [
      "S&P 500 -57% (1576 → 666)",
      "전 세계 GDP 0% 성장 (1945년 이래 처음)",
      "QE(양적완화) 도입 + 제로금리 시대 개막",
      "Dodd-Frank 등 금융규제 강화",
    ],
    recoveryMonths: 60,
    worstSector: "금융 / 부동산",
    bestSector: "필수소비재 / 헬스케어",
  },
  {
    id: "covid-2020",
    startDate: "2020-02-19",
    peakDate: "2020-03-23",
    endDate: "2020-08-18",
    title: "COVID-19 팬데믹 (2020)",
    shortTitle: "코로나 2020",
    region: "GLOBAL",
    kospiDrop: -37,
    spDrop: -34,
    summary:
      "1개월 만에 시장 -34% 폭락 후 6개월 만에 V자 회복. 사상 최단기 약세장 + 사상 최단기 회복.",
    causes: [
      "코로나19 팬데믹 → 전 세계 lockdown",
      "수요 충격 + 공급망 마비",
      "관광·항공·유가(-WTI 음수까지) 대폭락",
      "VIX 82.69 도달 (역대 2위)",
    ],
    effects: [
      "초유의 통화·재정 부양책 (Fed 자산 4조 → 9조 달러)",
      "기술주 폭등 (Amazon, Tesla, Zoom)",
      "리테일 투자 붐 (Robinhood 효과)",
      "K자 회복 — 자산가격 vs 실물경제 디커플링",
    ],
    recoveryMonths: 6,
    worstSector: "여행 / 항공 / 호텔",
    bestSector: "테크 / 헬스케어 / 비대면",
  },
  {
    id: "inflation-2022",
    startDate: "2022-01-04",
    peakDate: "2022-10-13",
    endDate: "2024-01-19",
    title: "2022 인플레이션 + Fed 긴축",
    shortTitle: "2022 긴축",
    region: "GLOBAL",
    kospiDrop: -27,
    spDrop: -25,
    summary:
      "코로나 부양책 부메랑 + 우크라이나 전쟁 → CPI 9.1% (40년 만의 최고치). Fed가 4.25%p 급격히 인상.",
    causes: [
      "팬데믹 부양책 → 통화량 폭증 (M2 +40%)",
      "공급망 차질 + 우크라이나 전쟁 → 에너지/식료품 급등",
      "Fed 최대 75bp 4회 인상 (1980 이후 최단기 긴축)",
      "성장주 듀레이션 영향 — 미래현금흐름 할인율 ↑",
    ],
    effects: [
      "60/40 portfolio -17% (주식·채권 동반 하락 — 역사적으로 매우 드문 일)",
      "NASDAQ -36%, 메타 -76%, 테슬라 -73%",
      "한국 -27% (원달러 1,440원 돌파)",
      "디플레 30년 끝 → 인플레 시대 회귀 논의",
    ],
    recoveryMonths: 14,
    worstSector: "성장주 / 테크 / 부동산",
    bestSector: "에너지 / 금융 / 방산",
  },
  {
    id: "kr-2024-shock",
    startDate: "2024-08-05",
    peakDate: "2024-08-05",
    endDate: "2024-09-30",
    title: "2024년 8월 블랙먼데이",
    shortTitle: "2024.8 블랙먼데이",
    region: "GLOBAL",
    kospiDrop: -8.77,
    spDrop: -3,
    summary:
      "엔캐리 트레이드 청산 + AI 거품 우려 + 미국 고용지표 부진 trifecta로 단 하루 KOSPI -8.77% (역대 2위).",
    causes: [
      "BOJ 금리인상 → 엔화 급등 + 엔캐리 청산",
      "미국 7월 고용지표 부진 → 경기침체 우려",
      "AI/반도체 burst 위험성 부각",
      "VIX 65 도달 (코로나 이후 최고)",
    ],
    effects: [
      "단일 일자 KOSPI 사상 최대 낙폭 +8% (역대 2위)",
      "코스닥 -11%, 사이드카·서킷브레이커 동시 발동",
      "1주일 만에 대부분 회복",
      "변동성·VaR 모델 재평가 계기",
    ],
    recoveryMonths: 2,
    worstSector: "반도체 / 성장주",
    bestSector: "방어주 / 필수소비재",
  },
];
