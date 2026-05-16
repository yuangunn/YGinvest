// Plan #30: 테마 간 supply chain / 파급 관계 매핑.
//
// 예시: AI boom → 데이터센터 인프라 수요 → 전력 / 냉각 / 반도체
//   - llm-ai → hbm-ai-semi (1차 강력 — AI 학습엔 GPU+HBM 필수)
//   - hbm-ai-semi → semi-equipment (2차 강력 — 첨단 패키징 장비)
//   - llm-ai → power-equipment (3차 중간 — 데이터센터 전력 인프라)
//
// 사용:
//   getUpstreamThemes(slug): 이 테마를 견인하는 상위 테마 (이 테마가 누구로부터 영향받나)
//   getDownstreamThemes(slug): 이 테마가 견인하는 후속 테마 (이 테마가 누구를 띄우나)

export type RelationStrength = "strong" | "medium" | "weak";

export type ThemeRelation = {
  /** 견인 테마 (예: 'llm-ai') */
  parent: string;
  /** 후속/수혜 테마 (예: 'hbm-ai-semi') */
  child: string;
  /** 연관 강도 */
  strength: RelationStrength;
  /** 파급 차수 (1=직접, 2=후속, 3=간접) */
  order: 1 | 2 | 3;
  /** 왜 연결되는지 설명 */
  reasoning: string;
};

/**
 * 하드코딩된 테마 관계 네트워크.
 * Supply chain + macro propagation 기반.
 */
export const THEME_RELATIONS: ThemeRelation[] = [
  // ─────────── AI / LLM 체인 ─────────────────────────────────
  {
    parent: "llm-ai",
    child: "hbm-ai-semi",
    strength: "strong",
    order: 1,
    reasoning:
      "AI 학습/추론엔 HBM 메모리가 필수. NVDA H100/B200 GPU에 SK하이닉스/삼성 HBM 탑재",
  },
  {
    parent: "llm-ai",
    child: "semiconductor",
    strength: "strong",
    order: 1,
    reasoning:
      "GPU 클러스터 확대 → 첨단 로직 칩 수요 폭증. TSMC/삼성 파운드리 호황",
  },
  {
    parent: "llm-ai",
    child: "foundry",
    strength: "strong",
    order: 1,
    reasoning: "NVDA/AMD 등 fabless가 의존하는 첨단 노드 (3nm/2nm) 수요 ↑",
  },
  {
    parent: "llm-ai",
    child: "cloud",
    strength: "strong",
    order: 1,
    reasoning: "AI 워크로드 = 클라우드 GPU 인스턴스. AWS/Azure/GCP capex 폭증",
  },
  {
    parent: "llm-ai",
    child: "saas",
    strength: "medium",
    order: 2,
    reasoning: "AI copilot 통합 SaaS 가격 인상 + 신규 도구 시장 확대",
  },
  {
    parent: "llm-ai",
    child: "cybersecurity",
    strength: "medium",
    order: 2,
    reasoning: "AI 활용 사이버 공격 증가 + AI 모델 보안 수요",
  },
  {
    parent: "llm-ai",
    child: "ai-software",
    strength: "strong",
    order: 1,
    reasoning: "LLM 기반 응용 소프트웨어 시장 확대",
  },
  {
    parent: "hbm-ai-semi",
    child: "semi-equipment",
    strength: "strong",
    order: 2,
    reasoning: "HBM 적층 첨단 패키징 (TSV, HBM 본더) 장비 수요",
  },
  {
    parent: "hbm-ai-semi",
    child: "semi-materials",
    strength: "medium",
    order: 2,
    reasoning: "HBM 적층용 EMC, 본딩 와이어 등 첨단 소재",
  },
  {
    parent: "hbm-ai-semi",
    child: "pcb-substrate",
    strength: "medium",
    order: 2,
    reasoning: "AI GPU용 고성능 ABF 기판 수요. 삼성전기/심텍 수혜",
  },
  {
    parent: "cloud",
    child: "power-equipment",
    strength: "strong",
    order: 2,
    reasoning:
      "AI 데이터센터 전력 밀도 ↑ → 변압기/송배전 인프라 수요. 효성중공업/LS일렉트릭",
  },
  {
    parent: "cloud",
    child: "electric-utility",
    strength: "medium",
    order: 2,
    reasoning: "AI 데이터센터 전력 소비 폭증 → 전력회사 매출 ↑",
  },
  {
    parent: "cloud",
    child: "non-ferrous",
    strength: "weak",
    order: 3,
    reasoning: "데이터센터 변압기·케이블에 구리 대량 사용",
  },
  {
    parent: "cloud",
    child: "nuclear",
    strength: "medium",
    order: 3,
    reasoning:
      "AI 전력 수요 → 안정적 base load 필요 → 원전 재조명. SMR(소형 원자로) 부상",
  },

  // ─────────── 전기차 (EV) 체인 ──────────────────────────────
  {
    parent: "auto-oem",
    child: "battery-cell",
    strength: "strong",
    order: 1,
    reasoning: "EV의 핵심 부품. 배터리 가격이 전기차 원가의 30-40%",
  },
  {
    parent: "auto-oem",
    child: "auto-parts",
    strength: "strong",
    order: 1,
    reasoning: "현대모비스/만도 등 자동차 부품 직접 수혜",
  },
  {
    parent: "auto-oem",
    child: "autonomous",
    strength: "medium",
    order: 2,
    reasoning: "전기차 + 자율주행은 보통 함께 진행",
  },
  {
    parent: "battery-cell",
    child: "cathode",
    strength: "strong",
    order: 2,
    reasoning: "양극재 (LFP, NCM 등). 배터리 원가의 40-50%",
  },
  {
    parent: "battery-cell",
    child: "anode",
    strength: "strong",
    order: 2,
    reasoning: "음극재 (그래파이트, 실리콘). 배터리 원가 약 10%",
  },
  {
    parent: "battery-cell",
    child: "electrolyte",
    strength: "strong",
    order: 2,
    reasoning: "전해질 (LiPF6 등). 배터리 핵심 소재",
  },
  {
    parent: "battery-cell",
    child: "separator",
    strength: "strong",
    order: 2,
    reasoning: "분리막. 배터리 안전성과 성능 결정",
  },
  {
    parent: "battery-cell",
    child: "battery-equipment",
    strength: "strong",
    order: 2,
    reasoning: "배터리 생산 라인 장비 (조립/포메이션). EV 수요 → 증설 → 장비 수혜",
  },
  {
    parent: "battery-cell",
    child: "battery-recycle",
    strength: "medium",
    order: 3,
    reasoning: "리튬/코발트 가격 ↑ → 폐배터리 재활용 경제성. 성일하이텍 등",
  },
  {
    parent: "battery-cell",
    child: "non-ferrous",
    strength: "medium",
    order: 3,
    reasoning: "리튬/니켈/코발트 광산 + 정제 산업",
  },

  // ─────────── 반도체 사이클 ─────────────────────────────────
  {
    parent: "memory",
    child: "semi-equipment",
    strength: "strong",
    order: 1,
    reasoning: "메모리 증설 → 노광/식각/CVD 장비 발주",
  },
  {
    parent: "memory",
    child: "semi-materials",
    strength: "strong",
    order: 1,
    reasoning: "포토레지스트, 가스, 슬러리 등 소재 수요",
  },
  {
    parent: "memory",
    child: "semi-test",
    strength: "medium",
    order: 2,
    reasoning: "메모리 검사 장비 수요 (테스트 핸들러 등)",
  },
  {
    parent: "memory",
    child: "pcb-substrate",
    strength: "medium",
    order: 2,
    reasoning: "메모리 패키지에 기판 사용",
  },
  {
    parent: "foundry",
    child: "system-semi",
    strength: "strong",
    order: 1,
    reasoning: "파운드리는 시스템 반도체 (모바일 AP, GPU 등) 제조",
  },
  {
    parent: "foundry",
    child: "semi-equipment",
    strength: "strong",
    order: 1,
    reasoning: "TSMC/삼성 파운드리 capex → 장비 발주",
  },

  // ─────────── 자율주행 ──────────────────────────────────────
  {
    parent: "autonomous",
    child: "semiconductor",
    strength: "strong",
    order: 1,
    reasoning: "자율주행 SoC (Tesla FSD, NVDA DRIVE, 모빌아이) 수요 ↑",
  },
  {
    parent: "autonomous",
    child: "auto-oem",
    strength: "strong",
    order: 1,
    reasoning: "자율주행 기술이 자동차 부가가치 ↑",
  },
  {
    parent: "autonomous",
    child: "llm-ai",
    strength: "medium",
    order: 2,
    reasoning: "End-to-end 자율주행에 비전 AI / VLA 모델 사용",
  },
  {
    parent: "autonomous",
    child: "mobility",
    strength: "medium",
    order: 2,
    reasoning: "로보택시 / 자율주행 모빌리티 서비스",
  },

  // ─────────── 로보틱스 ──────────────────────────────────────
  {
    parent: "robotics",
    child: "semiconductor",
    strength: "strong",
    order: 1,
    reasoning: "로봇 제어용 SoC + 센서 칩 수요",
  },
  {
    parent: "robotics",
    child: "llm-ai",
    strength: "strong",
    order: 1,
    reasoning: "Foundation model 기반 로봇 제어 (VLA: Vision-Language-Action)",
  },
  {
    parent: "robotics",
    child: "auto-parts",
    strength: "medium",
    order: 2,
    reasoning: "로봇 액츄에이터, 모터, 감속기 — 자동차 부품 기술 응용",
  },
  {
    parent: "robotics",
    child: "battery-cell",
    strength: "medium",
    order: 2,
    reasoning: "휴머노이드 로봇 전원으로 EV 배터리 기술 활용",
  },

  // ─────────── 신재생 / 에너지 전환 ──────────────────────────
  {
    parent: "renewable",
    child: "power-equipment",
    strength: "strong",
    order: 1,
    reasoning: "태양광/풍력 발전 → 그리드 연결 인버터, 변압기 수요",
  },
  {
    parent: "renewable",
    child: "battery-cell",
    strength: "strong",
    order: 1,
    reasoning: "ESS (에너지 저장 장치) — 신재생 변동성 흡수에 필수",
  },
  {
    parent: "renewable",
    child: "electric-utility",
    strength: "strong",
    order: 1,
    reasoning: "발전 사업자 직접 수혜 (한전, NextEra 등)",
  },
  {
    parent: "renewable",
    child: "non-ferrous",
    strength: "medium",
    order: 2,
    reasoning: "태양광 = 폴리실리콘, 풍력 = 구리/희토류",
  },
  {
    parent: "nuclear",
    child: "power-equipment",
    strength: "strong",
    order: 1,
    reasoning: "원자로 + 발전 설비. 두산에너빌리티 등",
  },
  {
    parent: "nuclear",
    child: "construction",
    strength: "medium",
    order: 2,
    reasoning: "원전 건설 EPC. 한수원/현대건설 등",
  },
  {
    parent: "nuclear",
    child: "heavy-machinery",
    strength: "strong",
    order: 2,
    reasoning: "원자로 압력용기, 증기발생기 등 중공업 부품",
  },
  {
    parent: "nuclear",
    child: "electric-utility",
    strength: "strong",
    order: 1,
    reasoning: "원전 운영회사 직접 수혜",
  },

  // ─────────── 조선 / 방산 ───────────────────────────────────
  {
    parent: "shipbuilding",
    child: "steel",
    strength: "strong",
    order: 1,
    reasoning: "선박 건조에 후판 등 철강 대량 사용",
  },
  {
    parent: "shipbuilding",
    child: "steel-materials",
    strength: "medium",
    order: 2,
    reasoning: "특수강, 코팅 등 철강 부자재",
  },
  {
    parent: "shipbuilding",
    child: "heavy-machinery",
    strength: "strong",
    order: 1,
    reasoning: "선박용 엔진, 크레인, 펌프 등",
  },
  {
    parent: "shipbuilding",
    child: "plant-engineering",
    strength: "medium",
    order: 2,
    reasoning: "LNG 선박 등 해양 플랜트 기술",
  },
  {
    parent: "shipping-marine",
    child: "shipbuilding",
    strength: "strong",
    order: 1,
    reasoning: "선사가 신조선 발주 → 조선소 수주",
  },
  {
    parent: "defense",
    child: "aerospace-defense",
    strength: "strong",
    order: 1,
    reasoning: "한화에어로/한국항공우주 — 항공/우주 방산",
  },
  {
    parent: "defense",
    child: "ground-defense",
    strength: "strong",
    order: 1,
    reasoning: "K9 자주포, K2 전차 등 지상 방산",
  },
  {
    parent: "defense",
    child: "cybersecurity",
    strength: "medium",
    order: 2,
    reasoning: "사이버전 수요 ↑ → 국방 사이버보안 발주",
  },
  {
    parent: "aerospace-defense",
    child: "semiconductor",
    strength: "weak",
    order: 3,
    reasoning: "위성/항공 시스템에 군용 반도체 사용",
  },
  {
    parent: "aerospace-defense",
    child: "telecom",
    strength: "medium",
    order: 2,
    reasoning: "위성 통신 / 군용 통신 인프라",
  },

  // ─────────── 바이오 / 의료 ─────────────────────────────────
  {
    parent: "new-drug",
    child: "bio",
    strength: "strong",
    order: 1,
    reasoning: "신약 개발 = 바이오 기업 본업",
  },
  {
    parent: "new-drug",
    child: "cmo-cdmo",
    strength: "strong",
    order: 1,
    reasoning: "신약 위탁 생산 (삼성바이오로직스 등)",
  },
  {
    parent: "bio",
    child: "biosimilar",
    strength: "strong",
    order: 2,
    reasoning: "오리지널 특허 만료 → 바이오시밀러 시장 확대",
  },
  {
    parent: "bio",
    child: "diagnostics",
    strength: "medium",
    order: 2,
    reasoning: "개인 맞춤 진단 + 동반진단 (Companion Dx)",
  },
  {
    parent: "medical-aesthetics",
    child: "cosmetics",
    strength: "medium",
    order: 2,
    reasoning: "보톡스/필러 등 미용 의료 + 화장품 시너지",
  },

  // ─────────── K-콘텐츠 ──────────────────────────────────────
  {
    parent: "k-content",
    child: "media-drama",
    strength: "strong",
    order: 1,
    reasoning: "K-드라마, 영화 제작사 직접 수혜",
  },
  {
    parent: "k-content",
    child: "k-ent",
    strength: "strong",
    order: 1,
    reasoning: "K-POP 엔터테인먼트 (HYBE, SM, JYP, YG)",
  },
  {
    parent: "k-content",
    child: "cosmetics",
    strength: "medium",
    order: 2,
    reasoning: "K-콘텐츠 성공 → K-뷰티 글로벌 확대",
  },
  {
    parent: "k-content",
    child: "telecom",
    strength: "weak",
    order: 3,
    reasoning: "콘텐츠 소비 ↑ → 트래픽/구독 ↑",
  },

  // ─────────── 인플레/원자재 ─────────────────────────────────
  {
    parent: "oil-refining",
    child: "chemicals",
    strength: "strong",
    order: 1,
    reasoning: "정유사의 후방 산업 — 석유화학",
  },
  {
    parent: "oil-refining",
    child: "shipping-marine",
    strength: "medium",
    order: 2,
    reasoning: "원유 운송 (VLCC)",
  },

  // ─────────── 물류 ──────────────────────────────────────────
  {
    parent: "retail-ecommerce",
    child: "logistics",
    strength: "strong",
    order: 1,
    reasoning: "이커머스 성장 → 풀필먼트/물류 서비스 ↑",
  },
  {
    parent: "retail-ecommerce",
    child: "logistics-parcel",
    strength: "strong",
    order: 1,
    reasoning: "택배사 (CJ대한통운, FedEx) 직접 수혜",
  },
];

// ─────────── Helper functions ────────────────────────────────

/** 이 테마가 누구로부터 영향받는지 (이 테마를 견인하는 상위) */
export function getUpstreamThemes(slug: string): ThemeRelation[] {
  return THEME_RELATIONS.filter((r) => r.child === slug).sort(
    (a, b) => strengthRank(b.strength) - strengthRank(a.strength),
  );
}

/** 이 테마가 누구를 견인하는지 (이 테마의 후속/수혜 테마) */
export function getDownstreamThemes(slug: string): ThemeRelation[] {
  return THEME_RELATIONS.filter((r) => r.parent === slug).sort(
    (a, b) => strengthRank(b.strength) - strengthRank(a.strength),
  );
}

function strengthRank(s: RelationStrength): number {
  return s === "strong" ? 3 : s === "medium" ? 2 : 1;
}

export const STRENGTH_LABEL: Record<RelationStrength, string> = {
  strong: "강력",
  medium: "중간",
  weak: "느슨",
};

export const STRENGTH_COLOR: Record<RelationStrength, string> = {
  strong:
    "text-red-600 dark:text-red-400 bg-red-500/10 border-red-500/30",
  medium:
    "text-amber-600 dark:text-amber-400 bg-amber-500/10 border-amber-500/30",
  weak: "text-muted-foreground bg-muted border",
};

export const ORDER_LABEL: Record<1 | 2 | 3, string> = {
  1: "1차 수혜",
  2: "2차 수혜",
  3: "3차 수혜",
};
