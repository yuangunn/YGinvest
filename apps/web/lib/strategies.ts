// 유명 투자 전략의 종목 필터 룰.
// 기존 stocks 테이블 컬럼(per, market_cap, last_price, fifty_two_week_high/low, sector)으로
// 가능한 범위에서 구현. ROE/PBR 부재 → 단순화.

export type StrategyFilter = {
  id: string;
  name: string;
  author: string;
  description: string;
  /**
   * Supabase 쿼리에 적용할 필터.
   * - perMax / perMin: 가격 결정 후 PER 컷
   * - mcMin: 시가총액 최소 (시총 너무 작으면 노이즈)
   * - 52w*: 52주 고/저 대비 위치 (0~1)
   *   - near52wLowMax: 0.2 = 저점 +20% 이내 (저평가 후보)
   *   - near52wHighMin: 0.8 = 고점 -20% 이내 (모멘텀)
   */
  filters: {
    perMax?: number;
    perMin?: number;
    mcMin?: number;
    near52wLowMax?: number;
    near52wHighMin?: number;
    market?: ("KR" | "US")[];
  };
  /** UI 설명용 — 어떤 종목이 잡히는지 */
  highlightPoints: string[];
  /** 단점/주의사항 */
  warnings: string[];
};

export const STRATEGIES: StrategyFilter[] = [
  {
    id: "buffett-value",
    name: "버핏 스타일 (가치주)",
    author: "Warren Buffett",
    description:
      "낮은 PER + 시총 1조 이상 우량주 — 안정적 사업 + 합리적 밸류에이션",
    filters: {
      perMax: 12,
      perMin: 3,        // 너무 낮은 PER은 부실 위험 신호
      mcMin: 1_000_000_000_000,  // 1조원 (KR 기준)
    },
    highlightPoints: [
      "꾸준히 이익 내는 기업 (PER 산정 가능)",
      "초저평가는 함정일 수 있어 PER>3 컷",
      "대형주 중심 (작은 회사는 우량성 검증 부족)",
    ],
    warnings: [
      "PER만으로는 사업 모델 강건성을 판단 못함",
      "회계상 일회성 이익으로 PER이 낮아 보일 수 있음",
      "성장 정체 우려 종목도 포함될 수 있음",
    ],
  },
  {
    id: "lynch-growth",
    name: "린치 스타일 (성장주)",
    author: "Peter Lynch",
    description:
      "52주 고점 근처 + 적정 PER — 모멘텀 + 합리적 가격 (GARP: Growth At Reasonable Price)",
    filters: {
      perMax: 25,
      perMin: 8,
      mcMin: 100_000_000_000, // 1천억원
      near52wHighMin: 0.85,    // 52w 고점 -15% 이내
    },
    highlightPoints: [
      "이미 시장에서 인정받는 모멘텀 종목",
      "PER 25 이하 — 거품 종목 배제",
      "중·대형주 (작은 회사는 변동성 너무 큼)",
    ],
    warnings: [
      "고점 근처라 단기 조정 위험",
      "성장 둔화 시 멀티플 contract 위험 (de-rating)",
      "린치 본인은 PEG<1로 정교하게 봤지만 우리는 PER만 사용",
    ],
  },
  {
    id: "contrarian-deep-value",
    name: "역발상 (Deep Value)",
    author: "David Dreman / Joel Greenblatt",
    description:
      "52주 저점 근처 + 매우 낮은 PER — 과도하게 두들겨 맞은 우량주 (역발상)",
    filters: {
      perMax: 8,
      perMin: 2,
      mcMin: 500_000_000_000,   // 5천억원
      near52wLowMax: 0.25,      // 52w 저점 +25% 이내
    },
    highlightPoints: [
      "시장이 외면한 종목 — 평균회귀 후보",
      "PER 8 이하는 통계적으로 forward return ↑ (역사적 백테스트)",
      "대형주 컷으로 부실기업 배제 시도",
    ],
    warnings: [
      "Value trap (가치 함정) 위험 — 사업 구조적 쇠퇴 가능",
      "회복까지 1-3년 걸릴 수 있어 인내 필요",
      "거시환경 안 좋을 때 더 떨어질 수 있음",
    ],
  },
  {
    id: "momentum-52wh",
    name: "모멘텀 (52주 신고가)",
    author: "Mark Minervini / William O'Neil",
    description:
      "52주 신고가 돌파 + 충분한 유동성 — 추세 추종 (Trend Following)",
    filters: {
      mcMin: 300_000_000_000,
      near52wHighMin: 0.97,    // 52w 고점 -3% 이내
    },
    highlightPoints: [
      "신고가 돌파는 통계적으로 향후 6-12개월 outperform",
      "기관/외국인 매집 신호일 가능성",
      "AI/반도체 같은 메가 테마 종목이 자주 등장",
    ],
    warnings: [
      "고점 돌파 직후 가짜 돌파(false breakout) 위험",
      "Tight stop loss 필요 — 추세 끊기면 빠르게 손절",
      "거시환경 악화 시 모멘텀 종목이 가장 먼저 무너짐",
    ],
  },
  {
    id: "blue-chip-stable",
    name: "블루칩 (안정 대형주)",
    author: "일반적 가치투자",
    description: "시총 5조+ 우량주 — PER 무관, 안정성 위주",
    filters: {
      mcMin: 5_000_000_000_000,  // 5조원 (KR 기준 대형주)
    },
    highlightPoints: [
      "삼성전자, SK하이닉스, NAVER 등 시총 상위",
      "기업 부도 확률 극히 낮음 — 자본 보전",
      "배당주 가능성 높음 (확인 필요)",
    ],
    warnings: [
      "이미 시장에서 충분히 가격이 매겨졌을 가능성",
      "성장은 제한적 — 인덱스 수익률 수준 기대",
      "거시 충격에 대형주도 동반 하락 (분산 효과 제한)",
    ],
  },
];
