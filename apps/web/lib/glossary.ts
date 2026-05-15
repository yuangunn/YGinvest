/**
 * 금융 용어 사전 — `<Term>` 컴포넌트가 참조.
 * key는 lowercase + dash, value는 사용자에게 보일 정의.
 */

export type GlossaryEntry = {
  term: string; // 표시될 이름
  short: string; // 한 줄 요약
  detail: string; // 상세 설명 (여러 줄, paragraph 단위 \n\n 사용 가능)
  example?: string; // 예시
  formula?: string; // 공식
  related?: string[]; // 관련 용어 키
};

export const GLOSSARY: Record<string, GlossaryEntry> = {
  // ─────────── 가치평가 지표 ───────────
  per: {
    term: "PER (Price/Earnings Ratio)",
    short: "주가가 1주당 순이익의 몇 배인지",
    detail:
      "주가수익비율 (Price-to-Earnings Ratio). 현재 주가를 주당 순이익(EPS)으로 나눈 값으로, 회사가 1년 동안 벌어들이는 이익에 대해 시장이 몇 배의 가격을 매기고 있는지 보여준다.\n\nPER이 낮으면 '이익 대비 싸다(저평가)', 높으면 '미래 성장에 대한 기대가 크다(고평가 또는 성장주)'고 해석한다. 다만 같은 PER이라도 산업별로 평균이 다르다 — 성장 산업(반도체, 바이오)은 평균 PER 30+, 가치주 산업(은행, 보험)은 평균 PER 5-10이 흔하다.\n\n주의: 일회성 손실로 EPS가 비정상이거나, 적자 기업이면 PER 자체가 의미 없다. trailing PER(최근 12개월)과 forward PER(향후 12개월 추정)을 구분해서 봐야 한다.",
    formula: "PER = 현재 주가 ÷ 주당 순이익(EPS)",
    example: "삼성전자 주가 ₩80,000, EPS ₩6,000 → PER 13.3. 같은 섹터 중간 PER이 20이라면 상대적 저평가.",
    related: ["pbr", "eps", "fair-value"],
  },
  pbr: {
    term: "PBR (Price/Book Ratio)",
    short: "주가가 1주당 순자산의 몇 배인지",
    detail:
      "주가순자산비율 (Price-to-Book Ratio). 주가를 주당 순자산가치(BPS, Book Value Per Share)로 나눈 값. 회사가 청산될 때 받을 가치 대비 현재 주가가 몇 배인지를 보여준다.\n\nPBR < 1 → '청산가치보다 싸게 거래' (저평가 또는 자산이 부실하다는 시장 의구심)\nPBR = 1 → 청산가치 = 시장가격\nPBR > 1 → 시장이 미래 수익 창출 능력을 추가 가치로 인정\n\n전통 제조업/금융은 PBR 1 근처, IT/플랫폼은 PBR 5-10이 흔함. 영업이익이 크지만 자산이 적은 인터넷 기업은 PBR로 평가하기 부적합.",
    formula: "PBR = 현재 주가 ÷ 주당 순자산(BPS)",
    related: ["per", "roe", "fair-value"],
  },
  eps: {
    term: "EPS (Earnings Per Share)",
    short: "1주당 회사가 번 순이익",
    detail:
      "주당 순이익. 회사의 당기순이익을 발행주식수로 나눈 값으로, 주주 1주가 받을 수 있는 이론적 이익이다.\n\nEPS 성장률이 주가 상승의 가장 직접적인 동력이다. 분기마다 발표되는 EPS가 시장 예상치를 상회하면 주가가 급등하기도 한다(어닝 서프라이즈).",
    formula: "EPS = 당기순이익 ÷ 발행주식수",
    related: ["per", "earnings-surprise"],
  },
  roe: {
    term: "ROE (Return on Equity)",
    short: "자본 대비 얼마나 이익을 내는지",
    detail:
      "자기자본이익률. 회사가 주주의 돈(자본)으로 얼마나 효율적으로 이익을 만드는지 보여주는 지표. ROE 15% 이상이 우수, 20% 이상은 매우 우수.\n\nROE = 순이익률 × 자산회전율 × 레버리지(부채 비율). 따라서 ROE가 높다고 무조건 좋은 게 아니라, 부채를 많이 끌어다 쓰는 것일 수도 있다. ROE와 부채비율을 함께 봐야 한다.",
    formula: "ROE = 당기순이익 ÷ 자기자본 × 100%",
    related: ["roa", "debt-ratio"],
  },
  "market-cap": {
    term: "시가총액 (Market Cap)",
    short: "회사 전체의 시장 평가 가격",
    detail:
      "주가 × 발행주식수. 회사가 시장에서 통째로 거래될 때의 가격이다. 시가총액이 클수록 대형주, 작을수록 소형주.\n\n시가총액별 분류 (한국):\n- 초대형주: 10조원 이상 (삼성전자, SK하이닉스, LG에너지솔루션)\n- 대형주: 1-10조원 (KOSPI 상위 100)\n- 중형주: 1000억 ~ 1조원\n- 소형주: 1000억원 미만\n\n대형주는 일반적으로 변동성이 작고 안정적, 소형주는 변동성 크지만 성장 잠재력 큼.",
    formula: "시가총액 = 현재 주가 × 발행주식수",
    related: ["per", "liquidity"],
  },

  // ─────────── 가격 지표 ───────────
  "52w-high": {
    term: "52주 최고가",
    short: "최근 1년 중 가장 높았던 주가",
    detail:
      "지난 52주(약 1년) 동안 종목이 도달한 최고 가격. 현재 주가가 52주 최고가에 가까우면 '강한 상승 추세 (모멘텀)' 으로 해석한다.\n\n반대로 52주 최고 대비 -30%, -50% 같은 하락은 'value 매수 후보' 또는 '구조적 약세'를 시사한다. '신고가 돌파' 는 기술적 분석에서 강력한 매수 신호로 자주 인용된다.",
    related: ["52w-low", "momentum"],
  },
  "52w-low": {
    term: "52주 최저가",
    short: "최근 1년 중 가장 낮았던 주가",
    detail:
      "지난 52주 동안 도달한 최저 가격. 현재가가 52주 최저에 가까우면 '바닥권', 'value 매수 후보' 또는 '구조적 문제 진행 중' 으로 해석.\n\n52주 최저 갱신은 약세 신호로, 추가 하락이나 반등의 분기점으로 자주 작용한다.",
    related: ["52w-high"],
  },
  "fair-value": {
    term: "적정 주가 (Fair Value)",
    short: "이론적으로 합당한 주가",
    detail:
      "회사의 펀더멘털(실적, 자산, 성장률 등)을 기반으로 산출한 이론 적정 가격. 다양한 방법론이 있다:\n\n- 상대평가: 동종 섹터 PER 평균 × 자사 EPS\n- DCF (할인현금흐름): 미래 현금흐름의 현재가치 합\n- 자산가치: 순자산 × 적정 PBR\n\nYGinvest의 큐레이션 시스템은 '섹터 중간 PER × EPS'의 상대평가를 사용한다. 단, 모델 추정치는 항상 가정에 의존하므로 절대적이지 않다.",
    related: ["per", "target-price", "valuation"],
  },
  "target-price": {
    term: "목표 주가 (Target Price)",
    short: "단기 도달 기대 가격",
    detail:
      "적정 주가에 모멘텀/성장 프리미엄을 반영한, 향후 6-12개월 내 도달할 것으로 기대되는 가격. 증권사 애널리스트가 발표하는 목표가는 보통 12개월 기준.\n\nYGinvest의 목표가는 적정 주가 × (1 + 52주 위치 기반 프리미엄), ±50% 범위로 cap.",
    related: ["fair-value", "upside"],
  },
  upside: {
    term: "기대 수익률 (Upside)",
    short: "목표가까지 도달 시 수익률",
    detail:
      "(목표 주가 / 현재 주가 - 1) × 100%. 양수면 상승 여력, 음수면 하락 여력.\n\nYGinvest 큐레이션 등급:\n- Strong Buy: ≥ +20%\n- Buy: +5% ~ +20%\n- Hold: -5% ~ +5%\n- Sell: -20% ~ -5%\n- Strong Sell: < -20%",
    related: ["target-price", "fair-value"],
  },
  spread: {
    term: "스프레드 (Bid-Ask Spread)",
    short: "매수 호가와 매도 호가의 차이",
    detail:
      "시장 참여자가 '사겠다고 부르는 가격(Bid)' 과 '팔겠다고 부르는 가격(Ask)' 의 차이. 스프레드가 좁을수록 유동성이 풍부한 종목, 넓을수록 거래가 적은 종목.\n\n시장가 매수는 ask로 체결, 시장가 매도는 bid로 체결되므로 스프레드는 매매 시 즉시 발생하는 비용이다. bps(basis point) 단위로 표시 — 10 bps = 0.1%.\n\nYGinvest의 NXT 시간외 거래는 시가총액 티어별로 spread를 시뮬레이션 (대형주 5 bps, 중형 10, 소형 20).",
    related: ["liquidity", "midpoint", "nxt"],
  },
  midpoint: {
    term: "미드포인트 (Midpoint Order)",
    short: "Bid와 Ask의 중간 가격",
    detail:
      "(Bid + Ask) / 2. 시장가 매수가 ask를, 매도가 bid를 부담하는 반면 미드포인트 주문은 중간 가격에 체결되어 spread를 절약한다.\n\n실제 시장에서는 다크풀(dark pool) 같은 OTC 거래에서 자주 쓰이며, YGinvest에서는 NXT pre/after 시간(08:00-08:50, 15:30-20:00 KST) 한정으로 제공.",
    related: ["spread", "nxt"],
  },
  liquidity: {
    term: "유동성 (Liquidity)",
    short: "쉽게 사고 팔 수 있는 정도",
    detail:
      "거래량, 거래대금, 스프레드 좁기, 호가창 두께 등으로 판단. 유동성이 높을수록:\n- 원하는 가격에 매매 성공 가능성 ↑\n- 슬리피지(slippage, 호가 차이로 인한 손실) ↓\n- 대형주(시총 10조 이상)가 일반적으로 유동성 높음\n\n유동성이 낮은 종목은 대량 매수/매도 시 가격이 급변할 수 있다. 일별 거래대금 100억 미만 종목은 주의.",
    related: ["spread", "trading-value", "market-cap"],
  },
  "trading-value": {
    term: "거래대금 (Trading Value)",
    short: "하루 동안 거래된 금액의 합",
    detail:
      "거래량 × 평균 단가의 합. 거래대금이 높으면 시장 관심이 큰 종목. KOSPI 거래대금 상위는 시장 주도주로 분류.\n\n거래대금 급증 = 새로운 정보 유입, 추세 전환 가능성을 시사. YGinvest의 '거래대금 상위' 카테고리는 매일 갱신.",
    related: ["volume-surge", "liquidity"],
  },

  // ─────────── 차트 / 기술적 지표 ───────────
  ma: {
    term: "이동평균선 (Moving Average)",
    short: "N일 동안의 평균 주가 선",
    detail:
      "MA20 (20일선) = 최근 20거래일 종가 평균. MA60 (60일선) = 최근 60거래일 종가 평균.\n\n사용:\n- 추세 파악: 주가 > MA = 상승 추세\n- 지지선/저항선: 하락 시 MA에서 반등 또는 돌파 후 강한 추세 지속\n- 골든 크로스: 단기 MA (20일)가 장기 MA (60일)를 상향 돌파 → 매수 신호\n- 데드 크로스: 단기 MA가 장기 MA 하향 돌파 → 매도 신호\n\n단순 이동평균(SMA)은 모든 날짜에 동일 가중치, 지수 이동평균(EMA)은 최근일에 더 큰 가중치.",
    related: ["bollinger", "macd"],
  },
  rsi: {
    term: "RSI (Relative Strength Index)",
    short: "과매수/과매도를 0-100으로 표시",
    detail:
      "상대강도지수. 최근 N일(보통 14일)의 상승폭과 하락폭 비율로 0-100 스케일 산출.\n\n해석:\n- RSI > 70: 과매수 (단기 조정 가능성)\n- RSI < 30: 과매도 (반등 가능성)\n- 50: 중립\n\nRSI 단독으로 매매 결정은 위험. 강한 추세에서는 RSI가 70+에 오래 머물 수 있다. 다른 지표와 조합해서 사용.",
    formula: "RSI = 100 - 100 / (1 + 평균 상승폭 / 평균 하락폭)",
    related: ["macd", "bollinger"],
  },
  macd: {
    term: "MACD",
    short: "단기/장기 이동평균의 차이",
    detail:
      "Moving Average Convergence Divergence. 단기 EMA(12)에서 장기 EMA(26)를 뺀 값을 MACD line, 그 9일 EMA를 signal line, 둘의 차이를 histogram으로 표시.\n\n해석:\n- MACD > Signal (histogram 양수): 상승 모멘텀\n- MACD < Signal (histogram 음수): 하락 모멘텀\n- 0 라인 돌파: 추세 전환 가능\n- Divergence (주가는 신고가, MACD는 신고가 못 만들 때): 추세 약화 경고",
    related: ["ma", "rsi"],
  },
  bollinger: {
    term: "볼린저 밴드 (Bollinger Bands)",
    short: "주가 변동성을 보여주는 상하단 밴드",
    detail:
      "MA20 ± 2σ (표준편차). 95% 확률로 주가가 밴드 안에 있어야 한다는 통계적 가정.\n\n해석:\n- 밴드 폭이 좁아지면 (스퀴즈) → 큰 변동 임박\n- 상단 터치 → 단기 고점 (반락 가능)\n- 하단 터치 → 단기 저점 (반등 가능)\n- 밴드 돌파 후 추세 지속 가능\n\nRSI와 함께 자주 쓰이는 지표.",
    related: ["ma", "volatility"],
  },
  stochastic: {
    term: "스토캐스틱 (Stochastic Oscillator)",
    short: "현재가가 최근 변동폭의 어느 위치인지",
    detail:
      "최근 N일(14)의 최고-최저 범위에서 현재가의 상대 위치를 0-100으로 표시.\n\n%K = (현재가 - 최저) / (최고 - 최저) × 100\n%D = %K의 3일 이동평균 (smoothing)\n\n해석:\n- %K > 80: 과매수\n- %K < 20: 과매도\n- %K와 %D 교차: 매매 신호\n\nRSI보다 더 빠르게 반응하지만 노이즈도 많음.",
    related: ["rsi", "macd"],
  },
  vwap: {
    term: "VWAP (Volume-Weighted Average Price)",
    short: "거래량 가중 평균가",
    detail:
      "Σ(가격 × 거래량) / Σ(거래량). 단순 평균과 달리 거래가 많이 일어난 가격대에 더 큰 가중치.\n\n사용:\n- 기관 투자자가 매매 효율을 측정하는 벤치마크\n- VWAP 아래에서 매수, 위에서 매도 = 시장 평균보다 유리한 거래\n- 일중(intraday) 추세 판단 — 주가 > VWAP는 강세, < VWAP는 약세\n\n주로 데이트레이딩에서 활용.",
    related: ["ma", "trading-value"],
  },
  candlestick: {
    term: "캔들 (Candlestick Chart)",
    short: "시가/고가/저가/종가를 한 막대로",
    detail:
      "일본의 봉차트. 각 봉(캔들)이 한 기간의 OHLC를 보여준다.\n\n구성:\n- 몸통(body): 시가-종가\n- 꼬리/심지(wick): 고가-저가\n- 색: 종가 > 시가면 양봉(빨강 한국 / 초록 미국), 반대면 음봉\n\n캔들 패턴(망치형, 도지, 흑운형 등)은 단기 추세 전환을 시사. YGinvest는 4가지 색 팔레트 지원 (글로벌/한국식/모노/색약).",
    related: ["ma", "volume"],
  },
  volume: {
    term: "거래량 (Volume)",
    short: "거래된 주식 수",
    detail:
      "하루 동안 거래된 주식의 총 수량. 거래대금 = 거래량 × 평균가.\n\n거래량 의미:\n- 거래량 급증 + 상승 = 강한 매수세\n- 거래량 급증 + 하락 = 강한 매도세\n- 거래량 없는 상승 = 약세 가능성\n- 거래량 폭증 후 횡보 = 매물 소화 단계\n\n차트 아래 막대로 표시. 봉 색은 전일 종가 대비 등락에 따라.",
    related: ["trading-value", "volume-surge"],
  },
  "volume-surge": {
    term: "거래량 급증",
    short: "평소 대비 거래량이 폭증",
    detail:
      "오늘 거래량 / 최근 5일 평균 거래량 ≥ 3.0 인 경우. 새로운 정보 유입, 작전, 실적 발표 등으로 시장 관심이 집중된 신호.\n\n주의: 거래량 급증 자체는 방향성을 알려주지 않는다. 상승/하락과 함께 봐야 의미 있음. YGinvest 추천 카테고리 중 하나.",
    related: ["volume", "trading-value"],
  },
  "fib-retracement": {
    term: "피보나치 되돌림 (Fibonacci Retracement)",
    short: "상승/하락 후 되돌림 비율",
    detail:
      "주가가 강한 추세 후 일부 되돌릴 때, 23.6% / 38.2% / 50% / 61.8% / 78.6% 지점에서 지지/저항이 자주 발생한다는 기술적 분석.\n\n적용:\n1. 최근 의미 있는 저점-고점 선택\n2. 자동으로 5개 레벨에 가로선 표시\n3. 38.2%-61.8% 구간 = '황금 되돌림 구간', 매수 후보\n\n과학적 근거는 약하나 시장 참여자들이 의식해서 자기충족적으로 작용. YGinvest 차트 도구로 두 점 클릭하여 그릴 수 있다.",
    related: ["trendline", "support-resistance"],
  },
  trendline: {
    term: "추세선 (Trendline)",
    short: "두 점을 잇는 추세 라인",
    detail:
      "주가의 고점-고점 또는 저점-저점을 직선으로 잇는 도구. 추세선이 우상향 = 상승 추세, 우하향 = 하락 추세, 수평 = 박스권.\n\n추세선을 깨고 나오면 추세 전환 신호. YGinvest 차트에서 두 점 클릭해 그릴 수 있다.",
    related: ["fib-retracement", "support-resistance"],
  },

  // ─────────── 시장 / 거래 ───────────
  nxt: {
    term: "NXT (Next Trade)",
    short: "한국 시간외 대체거래소",
    detail:
      "넥스트레이드. 2025년 출범한 한국의 대체거래소(ATS). KRX 정규장 외에 거래 시간을 확장:\n\n- Pre-market: 08:00-08:50 KST\n- Regular: 09:00-15:20 KST (KRX와 동일)\n- After-market: 15:30-20:00 KST\n\nYGinvest는 NXT 시간에 매수=ask, 매도=bid 가격을 적용해 spread 비용을 시뮬레이션. 미드포인트 주문은 NXT 시간에만 가능.",
    related: ["midpoint", "spread"],
  },
  "market-order": {
    term: "시장가 주문",
    short: "즉시 체결되는 주문",
    detail:
      "현재 시장에 있는 가장 좋은 가격으로 즉시 체결. 매수면 ask, 매도면 bid에 체결.\n\n장점: 빠른 체결\n단점: 정확한 가격을 모르고 매매 → 슬리피지 가능\n\nYGinvest는 KRX 정규장 + NXT 시간 한정으로 허용 (장 마감 시간엔 지정가만 가능).",
    related: ["limit-order", "spread"],
  },
  "limit-order": {
    term: "지정가 주문",
    short: "원하는 가격을 지정하는 주문",
    detail:
      "매수 지정가 = 이 가격 이하로만 사겠다, 매도 지정가 = 이 가격 이상으로만 팔겠다. 가격 도달 시까지 펜딩(대기) 상태로 남는다.\n\n장점: 원하는 가격에 체결, 슬리피지 없음\n단점: 가격 미도달 시 체결 안 됨\n\nYGinvest는 24/7 지정가 주문 허용. 매칭 엔진이 1분마다 펜딩 주문을 처리.",
    related: ["market-order", "midpoint"],
  },
  sector: {
    term: "섹터 (Sector)",
    short: "산업 분류",
    detail:
      "회사의 주력 사업 분야. 글로벌 분류(GICS)는 11개 섹터:\n\n- Technology (반도체, SW, 하드웨어)\n- Financial Services (은행, 증권, 보험)\n- Healthcare (제약, 의료기기)\n- Consumer Cyclical (자동차, 명품, 의류)\n- Consumer Defensive (식음료, 생필품)\n- Energy (정유, 가스)\n- Industrials (조선, 항공, 건설)\n- Communication Services (통신, 미디어)\n- Basic Materials (철강, 화학)\n- Utilities (전력, 가스)\n- Real Estate (부동산)\n\n같은 섹터 종목들은 거시환경(금리, 유가 등)에 비슷하게 반응. YGinvest 큐레이션은 sector-relative valuation 사용.",
    related: ["industry", "fair-value"],
  },
  theme: {
    term: "테마 (Theme)",
    short: "특정 트렌드에 묶이는 종목군",
    detail:
      "정식 섹터 분류와 별개로, 특정 트렌드/기술/이벤트에 영향 받는 종목 묶음. 예:\n\n- 반도체 → 메모리, 시스템반도체, 파운드리, HBM/AI...\n- 2차전지 → 셀, 양극재, 음극재, 분리막...\n- AI/소프트웨어 → LLM, 클라우드, SaaS, 로봇\n- K-방위산업, K-콘텐츠 등 한국 특화 테마\n\n테마는 단기 모멘텀 매매 또는 산업 트렌드 베팅 시 유용. YGinvest는 14개 root × 평균 4-6 sub-theme.",
    related: ["sector", "momentum"],
  },

  // ─────────── 경제 ───────────
  "interest-rate": {
    term: "금리 (Interest Rate)",
    short: "돈을 빌리는 가격",
    detail:
      "중앙은행이 정하는 기준금리. 한국은 한국은행이 결정.\n\n금리 변화의 영향:\n- 금리 인상 → 채권 수익률 ↑, 주식 매력도 ↓, 부동산 침체\n- 금리 인하 → 채권 수익률 ↓, 주식/부동산 매력도 ↑\n\n특히 성장주(고PER)는 금리에 민감 (미래 현금흐름 할인율 변화로 가치 변동 큼).",
    related: ["bond", "inflation"],
  },
  inflation: {
    term: "인플레이션 (Inflation)",
    short: "물가가 오르는 현상",
    detail:
      "통화 가치 하락 = 같은 돈으로 살 수 있는 양 감소. CPI(소비자물가지수)로 측정.\n\n주식 vs 인플레이션:\n- 가격 전가력 있는 기업(브랜드, 독과점) → 인플레 hedge\n- 원자재 가격 상승 → 정유, 광물 종목 유리\n- 금/부동산도 hedge 자산\n- 채권은 인플레에 약함 (고정 이자가 실질 가치 하락)",
    related: ["interest-rate", "bond", "real-estate"],
  },
  bond: {
    term: "채권 (Bond)",
    short: "고정 이자를 받는 빚 증서",
    detail:
      "정부/기업이 발행한 빚. 만기까지 정해진 이자를 받고 원금 회수.\n\n주식 vs 채권:\n- 채권 = 고정 수익, 낮은 변동성, 발행자 부도 위험만\n- 주식 = 변동 수익, 높은 변동성, 회사 가치 상승 시 무제한 이익\n\n금리와 채권 가격은 반비례 (금리 ↑ → 신규 발행 채권이 더 좋은 이자 → 기존 채권 가격 ↓).",
    related: ["interest-rate", "stock-bond-correlation"],
  },
  "real-estate": {
    term: "부동산 (Real Estate)",
    short: "토지 + 건물 자산",
    detail:
      "주식, 채권, 부동산은 자산 3대 클래스. 부동산 vs 주식:\n- 부동산: 유동성 ↓, 거래 비용 ↑ (취득세 4-12%), 레버리지 활용 가능 (담보대출)\n- 주식: 유동성 ↑, 거래 비용 ↓ (수수료 0.1% 내외)\n\n부동산과 주식 모두 금리에 영향 받는다. 금리 인상 → 둘 다 압박. 다만 부동산은 지역성/실수요 등으로 주식보다 덜 민감.\n\n관련 ETF로 부동산 노출 가능 (REIT).",
    related: ["interest-rate", "inflation"],
  },
  "stock-bond-correlation": {
    term: "주식-채권 상관관계",
    short: "보통 반대로 움직이지만 항상 그렇지는 않음",
    detail:
      "전통적으로:\n- 경기 호황 → 주식 ↑, 채권 ↓\n- 경기 침체/공포 → 주식 ↓, 채권 ↑ (안전자산 선호)\n\n포트폴리오 분산의 핵심 — '60/40 (주식 60% + 채권 40%)' 같은 클래식 자산배분이 가능한 이유.\n\n예외: 2022년처럼 인플레이션 + 금리 급등 시 주식 + 채권 동시 하락 (자산배분 효과 실종).",
    related: ["bond", "interest-rate", "inflation"],
  },
  fx: {
    term: "환율 (FX, Foreign Exchange)",
    short: "통화 간 교환 비율",
    detail:
      "1 USD = ? KRW. 환율이 오르면 (KRW 약세):\n- 수출 기업 유리 (현대차, 삼성전자 등 매출 ↑)\n- 수입 기업 불리\n- 외국인 자금 유출 가능\n\n환율 변동 요인: 양국 금리 차이, 무역수지, 정치적 사건, 글로벌 위험 회피 등.\n\nYGinvest는 KRW ↔ USD 환전 시뮬 (수수료 0.5%) 제공.",
    related: ["export-stocks", "trade-balance"],
  },
  diversification: {
    term: "분산투자 (Diversification)",
    short: "여러 자산에 나눠 투자해 위험 줄이기",
    detail:
      "'계란을 한 바구니에 담지 말라'. 다른 섹터/지역/자산 클래스에 나눠 투자해 개별 위험을 평준화.\n\n분산 효과:\n- 동일 섹터 5종목 < 5개 다른 섹터 5종목 < 주식 + 채권 + 부동산\n- 한국 + 미국 같이 보유 = 환율 hedge\n\nKR 시장은 IT/반도체 비중이 압도적이라 KOSPI 자체가 이미 한쪽으로 쏠려 있음. 글로벌 분산 권장.",
    related: ["correlation", "risk"],
  },
  dividend: {
    term: "배당 (Dividend)",
    short: "회사 이익을 주주에게 분배",
    detail:
      "분기별/연간 회사 이익의 일부를 주주에게 현금으로 지급. 배당수익률 = 1주당 배당금 / 주가.\n\n특징:\n- 안정적 현금흐름 (시세차익 외 수익)\n- 한국 평균 배당수익률 ~2-3%, 미국 ~1.5%\n- 배당주는 변동성이 낮은 경향 (가치주 성격)\n- 한국은 배당소득세 15.4%, 분리과세 한도 2000만원\n\nYGinvest는 ex-date 기준 자동 배당 지급 시뮬레이션.",
    related: ["dividend-yield", "ex-date"],
  },
  "fee-tax": {
    term: "수수료 / 세금",
    short: "거래 시 발생하는 비용",
    detail:
      "한국 주식 매매:\n- 매수: 0.015% (증권사 수수료 ~0.015%)\n- 매도: 0.215% (수수료 + 증권거래세 0.20%)\n\n미국 주식: 0.05% (수수료만, 세금은 양도소득세로 별도)\n\nFX 환전: 0.5% (시장 평균)\n\nYGinvest는 위 비율로 시뮬레이션 (실제 증권사마다 다를 수 있음).",
    related: ["liquidity"],
  },

  // ─────────── 큐레이션 / 분석 ───────────
  rating: {
    term: "투자 의견 (Rating)",
    short: "Buy/Hold/Sell 등급",
    detail:
      "전통적으로 증권사 애널리스트가 부여하는 의견. 5단계:\n\n- **Strong Buy**: 강한 매수 추천 (목표가 +20% 이상)\n- **Buy**: 매수 추천 (+5% ~ +20%)\n- **Hold**: 보유/중립 (-5% ~ +5%)\n- **Sell**: 매도 권고 (-20% ~ -5%)\n- **Strong Sell**: 강한 매도 (-20% 이하)\n\nYGinvest는 rule-based 알고리즘으로 sector-relative PER 기반 등급 산출. 실제 투자 자문이 아님 (시뮬레이션 용도).",
    related: ["target-price", "upside", "fair-value"],
  },
  "growth-vs-value": {
    term: "성장주 vs 가치주",
    short: "투자 스타일 두 갈래",
    detail:
      "**성장주 (Growth)**: 매출/이익이 빠르게 늘어나는 회사. 높은 PER(20-100+) 정당화. 예: NVDA, 테슬라, 신약 바이오. 금리 인하기에 유리.\n\n**가치주 (Value)**: 시장이 저평가했다고 보는 회사. 낮은 PER(5-15), 높은 배당. 예: 은행, 보험, 정유. 금리 인상기에 상대 강세.\n\n두 스타일은 거시 환경에 따라 번갈아 우세. 'Value Rotation', 'Growth Rotation' 같은 표현.",
    related: ["per", "interest-rate", "dividend"],
  },

  // ─────────── 가치평가 확장 ───────────
  "forward-pe": {
    term: "Forward PER",
    short: "내년 예상 이익 기준 PER",
    detail:
      "현재 주가를 향후 12개월 예상 EPS로 나눈 값. 이미 발표된 과거 12개월 EPS로 계산하는 trailing PER과 대비된다.\n\n성장주는 매년 EPS가 빠르게 증가하므로 forward PER이 trailing PER보다 훨씬 낮게 나옴. 시장은 forward PER을 더 중요하게 본다 — 미래 가치를 가격에 반영하기 때문.\n\n단, forward EPS는 애널리스트 추정치라 항상 정확하지 않다. 경기 침체기엔 추정치가 과대평가될 위험.",
    formula: "Forward PER = 현재 주가 ÷ 향후 12개월 예상 EPS",
    related: ["per", "eps"],
  },
  peg: {
    term: "PEG (Price/Earnings to Growth)",
    short: "PER을 성장률로 나눈 값",
    detail:
      "Peter Lynch가 대중화한 지표. PER이 성장률 대비 합리적인지 보는 도구.\n\nPEG < 1: 성장 대비 저평가 (좋음)\nPEG = 1: 적정\nPEG > 1: 성장 대비 비쌈\n\n예: PER 30이라도 EPS가 매년 30% 성장한다면 PEG=1로 정당. PER 15이라도 성장률 5%면 PEG=3으로 비싼 셈.",
    formula: "PEG = PER ÷ EPS 연 성장률(%)",
    related: ["per", "growth-vs-value"],
  },
  "ev-ebitda": {
    term: "EV/EBITDA",
    short: "기업가치/감가상각전 영업이익 — 자본구조 중립적 valuation",
    detail:
      "Enterprise Value를 EBITDA로 나눈 값. PER의 단점(부채 무시, 회계상 비현금 비용 영향)을 보완.\n\nEV = 시가총액 + 부채 - 현금. 즉 회사를 통째로 인수할 때 드는 돈.\nEBITDA = 영업이익 + 감가상각비 + 무형자산 상각비. 현금 창출력.\n\nM&A 시장에서 가장 자주 쓰이는 지표. 산업 평균과 비교 — 통신/유틸리티 6-8배, 테크 15-25배가 흔함.",
    formula: "EV/EBITDA = (시가총액 + 부채 - 현금) ÷ EBITDA",
    related: ["per", "ebitda", "market-cap"],
  },
  dcf: {
    term: "DCF (Discounted Cash Flow)",
    short: "미래 현금흐름을 현재가치로 할인한 적정 가치",
    detail:
      "주식 적정 가치를 평가하는 가장 정통한 방법. 향후 10-20년 잉여현금흐름(FCF)을 예측하고, 현재의 할인율로 할인해 합산.\n\n할인율로 보통 WACC(가중평균자본비용) 사용. 금리가 오르면 할인율↑ → DCF 가치↓.\n\n단점: 추정 변수가 많아(성장률, 마진, 할인율) 결과가 크게 달라짐. 'DCF는 자기 결론을 정당화하는 도구'라는 말도 있음. 정통 가치투자자는 보수적 가정으로 안전마진 확보.",
    related: ["interest-rate", "fcf", "fair-value"],
  },
  fcf: {
    term: "FCF (Free Cash Flow)",
    short: "회사가 실제로 자유롭게 쓸 수 있는 현금",
    detail:
      "잉여현금흐름. 영업현금흐름에서 CAPEX(설비투자)를 뺀 값. 회사가 운영을 유지하면서도 배당/자사주매입/M&A에 쓸 수 있는 돈.\n\n순이익은 회계 조작 여지가 있지만 FCF는 실제 현금이라 신뢰도가 높다. 'FCF 머신' = 자본 적게 들이면서 현금을 많이 만드는 회사 (예: 애플, 코카콜라).\n\nFCF Yield = FCF / 시가총액. 채권 yield와 직접 비교 가능.",
    formula: "FCF = 영업현금흐름 - 자본적 지출(CAPEX)",
    related: ["dcf", "capex", "dividend"],
  },
  "payout-ratio": {
    term: "배당성향 (Payout Ratio)",
    short: "이익 중 배당으로 지급하는 비율",
    detail:
      "순이익 대비 배당금 비율. 30-50%면 건전, 70%+면 무리(이익 감소 시 배당컷 위험), 100%+면 부채로 배당 지급 — 위험 신호.\n\nREITs / MLP는 법적으로 90%+ 의무. 성장주는 0-10% (재투자 우선). 한국 코스피 평균 약 25-30%.",
    formula: "배당성향 = 배당금 총액 ÷ 순이익",
    related: ["dividend", "dividend-yield"],
  },
  "dividend-yield": {
    term: "배당수익률 (Dividend Yield)",
    short: "주가 대비 연간 배당금 비율",
    detail:
      "연간 배당금 ÷ 현재 주가. 채권 yield와 직접 비교 가능.\n\nKR 시장 평균 약 2-3%, US S&P 평균 약 1.5%. 5%+면 배당주, 8%+면 yield trap 의심 (주가 폭락으로 yield가 가성으로 높아진 경우).\n\n장기 보유 시 배당 성장률도 중요. 'Dividend Aristocrats' = 25년+ 연속 배당 증액 종목.",
    formula: "배당수익률 = 연간 1주당 배당금 ÷ 현재 주가",
    example: "주가 ₩50,000 + 연배당 ₩2,000 → 배당수익률 4%",
    related: ["dividend", "payout-ratio"],
  },
  "intrinsic-value": {
    term: "내재가치 (Intrinsic Value)",
    short: "회사의 진짜 가치 — 시장 가격과는 별개",
    detail:
      "주식의 본질적 가치. 미래 현금흐름의 현재가치(DCF) 또는 자산 청산가치 등으로 추정.\n\n워런 버핏 철학의 핵심: \"시장가격이 내재가치보다 낮을 때 매수 (안전마진)\". 시장은 단기적으로 비합리적이지만 장기적으로는 내재가치로 수렴한다는 가정.\n\n다만 내재가치 추정엔 주관이 들어가므로, 보수적으로 잡고 30%+ 할인된 가격에만 매수하는 것이 일반적 가치투자 원칙.",
    related: ["dcf", "fair-value", "growth-vs-value"],
  },

  // ─────────── 재무제표 / 기업 분석 ───────────
  "balance-sheet": {
    term: "재무상태표 (Balance Sheet)",
    short: "특정 시점의 자산 = 부채 + 자본",
    detail:
      "회사의 '스냅샷'. 한 시점에 갖고 있는 자산, 갚아야 할 부채, 주주 몫의 자본을 보여준다.\n\n핵심 점검:\n• 현금 보유량 (현금 + 단기금융자산)\n• 부채비율 (총부채/자본) — 200% 미만이면 안전권\n• 유동비율 (유동자산/유동부채) — 1.5-2배 적정\n• 자본잠식 여부 (자본총계 < 자본금)\n\n급격한 자산 변화 = 빅 딜 발생 가능성 (M&A, 매각).",
    related: ["debt-to-equity", "current-ratio", "income-statement"],
  },
  "income-statement": {
    term: "손익계산서 (Income Statement)",
    short: "한 기간의 매출에서 이익까지 흐름",
    detail:
      "특정 기간 (분기/연간)의 영업 성과. 위에서 아래로 차감 구조.\n\n매출 (Revenue)\n  - 매출원가 (COGS)\n= 매출총이익 (Gross Profit)\n  - 판관비 (SG&A)\n= 영업이익 (EBIT)\n  - 이자비용 + 세금\n= 순이익 (Net Income)\n\n각 단계의 마진율 = 회사의 효율성. 동종업계 평균과 비교하면 경쟁력 보임.",
    related: ["gross-margin", "operating-margin", "net-margin", "ebitda"],
  },
  "cash-flow-statement": {
    term: "현금흐름표 (Cash Flow Statement)",
    short: "현금이 실제 어디서 들어오고 어디로 나가는가",
    detail:
      "회계상 이익은 조작 여지가 있지만 현금은 거짓말 안한다. 3가지 영역:\n\n• 영업활동 현금흐름 (OCF): 본업으로 번 현금. 가장 중요.\n• 투자활동 현금흐름: CAPEX, M&A 등. 보통 음수 (투자 중).\n• 재무활동 현금흐름: 배당, 자사주매입, 차입 등.\n\n주의 신호: 순이익은 +지만 OCF는 - → 매출채권 급증 또는 회계 조작 의심.",
    related: ["fcf", "capex"],
  },
  ebitda: {
    term: "EBITDA",
    short: "이자·세금·감가상각 전 이익 — 현금 창출력",
    detail:
      "Earnings Before Interest, Taxes, Depreciation, and Amortization.\n\n감가상각은 회계 처리이지 실제 현금 유출이 아니므로 제외. 자본 구조(부채/자본 비율)와 무관해 비교가 쉬움.\n\nM&A · 사모펀드 평가의 표준. 단점: CAPEX를 무시하므로 자본집약 산업(통신, 정유)에서 진짜 현금 창출력 과대평가.",
    related: ["ev-ebitda", "fcf", "income-statement"],
  },
  "operating-margin": {
    term: "영업이익률 (Operating Margin)",
    short: "매출 중 영업이익으로 남는 비율",
    detail:
      "회사 본업의 수익성을 보는 핵심 지표. 영업이익 / 매출.\n\n산업별 평균:\n• 소프트웨어/플랫폼: 30-50%\n• 반도체: 15-30%\n• 자동차: 5-10%\n• 유통/마트: 2-5%\n• 항공: 0-5% (변동성 큼)\n\n영업이익률 추세가 더 중요. 5년 연속 상승 = 가격 결정력 ↑ (Pricing Power).",
    formula: "영업이익률 = 영업이익 ÷ 매출",
    related: ["gross-margin", "net-margin"],
  },
  "gross-margin": {
    term: "매출총이익률 (Gross Margin)",
    short: "매출에서 원가 빼고 남는 비율",
    detail:
      "(매출 - 매출원가) / 매출. 원가 효율과 가격결정력을 본다.\n\n명품/소프트웨어는 70%+, 가공식품은 30%, 원자재 가공은 10-20%. 매출총이익률이 높을수록 R&D · 마케팅에 투자할 여력이 큼.\n\nGross Margin이 하락하면 = 원자재 가격 상승 또는 가격 경쟁 격화. 반대로 상승하면 = 차별화 성공 또는 규모의 경제 작동.",
    related: ["operating-margin", "net-margin"],
  },
  "net-margin": {
    term: "순이익률 (Net Margin)",
    short: "최종 남는 이익률",
    detail:
      "순이익 / 매출. 영업이익에 이자비용, 세금, 일회성 손익 모두 반영된 최종 결과.\n\n순이익률 vs 영업이익률 차이가 크면 = 부채가 많거나 세율 불리.\n\nROE = 순이익률 × 자산회전율 × 레버리지 (DuPont 분해). 즉 순이익률은 ROE의 핵심 구성 요소.",
    formula: "순이익률 = 순이익 ÷ 매출",
    related: ["operating-margin", "roe"],
  },
  "debt-to-equity": {
    term: "부채비율 (Debt-to-Equity)",
    short: "총부채를 자본으로 나눈 비율",
    detail:
      "재무 건전성의 가장 기본 지표. 총부채 / 자본총계.\n\n100% 이하: 매우 안전\n200% 이하: 안전\n400% 이상: 위험 (금융기관 제외)\n\n은행은 본업이 차입경영이라 부채비율 1000%도 정상. 산업별 기준이 다르므로 동종업계 비교 필수.\n\n부채는 양면성: 적절한 부채는 ROE 레버리지로 작용, 과한 부채는 금리상승기에 위기.",
    formula: "부채비율 = 총부채 ÷ 자본총계",
    related: ["roe", "balance-sheet"],
  },
  "current-ratio": {
    term: "유동비율 (Current Ratio)",
    short: "단기부채 갚을 능력",
    detail:
      "유동자산 ÷ 유동부채. 1년 안에 갚아야 할 돈 대비 1년 안에 현금화 가능한 자산 비율.\n\n1 미만: 단기 유동성 위험\n1.5-2: 안전\n3+: 안전하지만 자산을 너무 놀리는 셈\n\n비슷한 지표 Quick Ratio = (유동자산 - 재고) / 유동부채. 재고 못 팔 위험 제외.",
    related: ["balance-sheet"],
  },
  capex: {
    term: "CAPEX (자본적 지출)",
    short: "공장·설비·R&D 등 미래를 위한 투자",
    detail:
      "Capital Expenditure. 1년 이상 사용할 자산(공장, 장비, 토지, 무형자산) 매입 비용.\n\nCAPEX 많은 산업: 반도체, 정유, 통신, 항공 — 진입장벽 ↑\nCAPEX 적은 산업: 소프트웨어, 컨설팅, 광고 — capital-light 비즈니스\n\nFCF = 영업현금흐름 - CAPEX이므로 CAPEX 급증 = FCF 감소. 다만 미래 성장 위한 투자라면 긍정적.",
    related: ["fcf", "cash-flow-statement"],
  },

  // ─────────── 거래 메커니즘 ───────────
  "bid-ask": {
    term: "매수호가 / 매도호가 (Bid / Ask)",
    short: "현재 시장에서 사려는 가격 / 팔려는 가격",
    detail:
      "Bid = 매수 주문 중 가장 높은 가격\nAsk = 매도 주문 중 가장 낮은 가격\nSpread = Ask - Bid\n\n유동성이 높은 종목은 spread 좁고(0.01%), 잡주는 spread 넓다(1%+). 시장가 매수는 ask로, 시장가 매도는 bid로 체결.",
    related: ["spread", "liquidity", "market-order"],
  },
  slippage: {
    term: "슬리피지 (Slippage)",
    short: "체결가가 기대가에서 벗어난 정도",
    detail:
      "큰 시장가 주문은 호가창 여러 단계를 거치며 평균 체결가가 첫 호가보다 불리해진다. 이 차이가 슬리피지.\n\n잡주 + 큰 주문 → 슬리피지 큼. 같은 종목이라도 장 마감 직전이나 공시 직후 슬리피지 ↑.\n\n알고리즘 트레이딩은 슬리피지 줄이기 위해 큰 주문을 작게 쪼개 시간차 체결 (TWAP, VWAP).",
    related: ["liquidity", "market-order"],
  },
  "short-selling": {
    term: "공매도 (Short Selling)",
    short: "남에게 빌린 주식을 팔고 나중에 사서 갚는 거래",
    detail:
      "주가 하락에 베팅. 빌려서 매도 → (주가 하락 후) 더 싸게 매수해서 빌려준 사람에게 반환. 차익이 이익.\n\n위험:\n• 손실이 무한대 가능 (주가는 무한히 오를 수 있음)\n• 빌린 주식엔 이자 지급\n• 숏 스퀴즈(short squeeze) — 갑작스런 폭등에 매수 강요됨\n\n한국: 개인 공매도 제약 많음. 미국: Robinhood 등에서 일반인도 가능. 시장 효율성에 도움이지만 위기 시엔 매도 압력 가중.",
    related: ["margin", "leverage"],
  },
  margin: {
    term: "신용거래 / 마진 (Margin)",
    short: "증권사에서 돈/주식을 빌려 거래",
    detail:
      "자기자본만으로 살 수 있는 것보다 더 큰 포지션을 만드는 방법.\n\n• 신용매수: 매수 자금의 일부만 자기 돈, 나머지는 빌림\n• 대주거래: 공매도용 주식 빌리기\n\n레버리지로 수익도 손실도 배수. 마진 콜 (담보 비율 부족 시 추가 입금 요구) 위험. 빌린 자금에 이자 발생.\n\n한국 증권사 신용 이자율 연 5-10%, 미국 0.5-12% (브로커마다 천차만별).",
    related: ["leverage", "short-selling"],
  },
  leverage: {
    term: "레버리지 (Leverage)",
    short: "자기 자본 대비 큰 포지션 만들기",
    detail:
      "수익과 손실을 배수로 키우는 도구. 신용거래 / 옵션 / 선물 / 레버리지 ETF가 대표적.\n\n2배 레버리지 + 10% 상승 = +20% 수익\n2배 레버리지 + 10% 하락 = -20% 손실 (그리고 본전 회복엔 +25% 필요)\n\n변동성 큰 자산에 레버리지 적용하면 'volatility decay'로 장기 수익 잠식. 레버리지 ETF는 단타 도구이지 장기 보유용 X.",
    related: ["margin", "hedge"],
  },
  hedge: {
    term: "헤지 (Hedge)",
    short: "반대 포지션으로 위험 상쇄",
    detail:
      "보유 자산의 하락 위험을 다른 거래로 막는 것. 100% 헤지 시 수익도 손실도 0.\n\n예:\n• 주식 보유 + 풋옵션 매수 = 하락 보험\n• 수출기업 + 달러 선도매도 = 환율 하락 위험 제거\n• 채권 + CDS 매수 = 부도 보험\n\n보험료(헤지 비용)이 발생하므로 평소 수익률은 줄어듦. 위기 대응 보험으로 생각.",
    related: ["leverage", "futures"],
  },
  arbitrage: {
    term: "차익거래 (Arbitrage)",
    short: "같은 자산의 가격 차이로 무위험 이익",
    detail:
      "두 시장에서 같은 자산이 다른 가격일 때 싼 곳에서 사고 비싼 곳에서 팔아 차익 확보. 효율적 시장에서는 즉시 사라지지만 일시적으로는 존재.\n\n예:\n• 같은 종목의 KR/US 듀얼 리스팅\n• ETF와 기초자산\n• 인수 합병 발표 후 인수가 vs 시장가\n\n현대엔 HFT가 microsecond 단위로 잡아먹어 일반인은 거의 불가능. 다만 비효율 시장(작은 코인, 잡주)엔 여전히 기회.",
    related: ["efficient-market-hypothesis"],
  },
  "circuit-breaker": {
    term: "서킷브레이커 (Circuit Breaker)",
    short: "급락 시 거래 일시 중단",
    detail:
      "주가지수가 단기간 크게 빠지면 시장 패닉을 진정시키기 위해 거래를 멈추는 제도.\n\nKR (KOSPI):\n• 1단계: -8% 도달 → 20분 정지\n• 2단계: -15% 도달 → 20분 정지\n• 3단계: -20% 도달 → 당일 매매 종료\n\nUS (S&P 500):\n• Level 1: -7% → 15분\n• Level 2: -13% → 15분\n• Level 3: -20% → 종일 정지\n\n2020.3 코로나 폭락 때 미국에서 4번 발동.",
    related: ["vi", "halt"],
  },
  vi: {
    term: "VI (변동성 완화장치)",
    short: "특정 종목 급변 시 2분 단기 정지",
    detail:
      "Volatility Interruption. 한국 시장에서 개별 종목이 단기간 크게 움직이면 발동.\n\n• 정적 VI: 직전 종가 대비 ±10% 도달 → 2분 단일가\n• 동적 VI: 직전 체결가 대비 ±2-3% 도달 → 2분 단일가\n\n오버슈팅 진정시키는 효과. 진짜 상승/하락은 VI 후에도 이어지지만 패닉 매수/매도는 막힘.",
    related: ["circuit-breaker"],
  },
  ipo: {
    term: "IPO (기업공개)",
    short: "비상장 기업이 처음 공모해 상장",
    detail:
      "Initial Public Offering. 기존 주주(창업자, VC)가 주식을 일반 투자자에게 처음 매각하면서 상장.\n\n공모가 결정 → 청약 → 상장 (보통 1-2주 후).\n\n첫날 상승률(첫날 시가/공모가)은 '언더프라이싱' 정도 — 너무 크면 공모가 의도적으로 낮춤. 너무 작거나 마이너스면 시장 수요 부족.\n\n락업 기간 (보통 6개월): 내부자 매도 금지. 락업 만료 시 매도 압력 ↑.",
    related: ["buyback"],
  },
  buyback: {
    term: "자사주 매입 (Buyback / Share Repurchase)",
    short: "회사가 자기 주식을 시장에서 사들임",
    detail:
      "주주환원 방식 중 하나. 배당과 비교해:\n\n장점:\n• EPS ↑ (분모 감소) → 주가 부양\n• 배당과 달리 세금 효율적 (시세차익으로 인식)\n• 유연성 (배당은 컷하면 신호 나쁨)\n\n단점:\n• 고점에서 매입하면 자본 낭비\n• 부채로 매입하면 위험 (2008 GE 사례)\n\n바이백 비율 = 자사주매입액 / 시가총액. 5%+면 적극적.",
    related: ["dividend", "payout-ratio"],
  },
  "stock-split": {
    term: "주식 분할 (Stock Split)",
    short: "1주를 여러 주로 쪼개기",
    detail:
      "주가가 너무 높아서 거래 진입장벽이 생기면 분할로 낮춤. 시가총액은 변하지 않음.\n\n예: 4:1 분할 → 주가 1/4, 보유 주식 수 4배. 본질적 가치 동일.\n\n2020 애플 4:1, 테슬라 5:1, 2022 아마존 20:1, 2024 NVDA 10:1.\n\n역분할(Reverse Split): 주가가 너무 낮아져서 상폐 위험일 때 1:10 등. 보통 부정적 신호.",
    related: ["market-cap"],
  },

  // ─────────── 채권 / 금리 ───────────
  yield: {
    term: "수익률 (Yield)",
    short: "채권/배당주의 연 수익률",
    detail:
      "채권의 경우 액면가/시장가 대비 연간 이자 지급액의 비율. 채권 가격이 오르면 yield 떨어지고, 가격이 떨어지면 yield 오름 (반비례).\n\n주요 yield:\n• Coupon Yield: 액면가 기준 표면이율\n• Current Yield: 현재 시장가 기준\n• YTM (Yield to Maturity): 만기까지 보유 시 실효수익률\n\n주식의 dividend yield와 직접 비교 가능 — 채권 yield 5% vs 배당주 3%면 채권 우위.",
    related: ["bond", "dividend-yield"],
  },
  "yield-curve": {
    term: "수익률 곡선 (Yield Curve)",
    short: "만기별 국채 yield를 그린 곡선",
    detail:
      "보통 2년물, 5년물, 10년물, 30년물 yield를 X축 만기, Y축 yield로 그림.\n\n정상 (Upward sloping): 장기 yield > 단기 yield. 경제 정상.\n역전 (Inverted): 단기 yield > 장기 yield. **경기침체 선행 지표** — 1980 이후 거의 모든 미국 침체를 12-18개월 앞서 예측.\n평탄 (Flat): 전환점.\n\n2022년 7월 ~ 2024년: 미국 yield curve 역사상 최장 역전 (730일+). 침체 우려.",
    related: ["yield", "recession", "interest-rate"],
  },
  duration: {
    term: "듀레이션 (Duration)",
    short: "금리 변동에 대한 채권 가격의 민감도",
    detail:
      "Modified Duration이 X면 금리 +1%p 시 채권 가격 -X% 변동.\n\n장기채일수록 듀레이션 ↑ — 금리 위험 큼. 30년 국채 듀레이션 약 20 → 금리 +1%면 -20%.\n\n2022년 금리 5%p 급등 시 미국 장기국채 ETF TLT -30%. '안전자산'이라 알려진 채권도 큰 손실 가능.\n\n경제 사이클 보고 듀레이션 조절: 금리 인상기엔 단기채, 인하기엔 장기채.",
    related: ["bond", "yield", "interest-rate"],
  },
  "credit-rating": {
    term: "신용등급 (Credit Rating)",
    short: "발행자의 신용도 평가",
    detail:
      "S&P/Moody's/Fitch가 평가. AAA(최고) → BBB-(투자등급 하한) → BB+(투기등급/Junk).\n\n등급 낮을수록 yield 높음(위험 프리미엄). 등급 강등(downgrade) 시 채권 가격 폭락 + 기관 강제 매도.\n\nKR 정부 등급 AA (S&P, 2024). 미국 정부는 AA+ (2011 S&P, 2023 Fitch 강등).\n\n회사채 펀드 투자 시 평균 등급 확인 — high yield(정크본드) 펀드는 BB 이하.",
    related: ["bond", "junk-bond"],
  },
  "junk-bond": {
    term: "정크본드 (Junk Bond / High Yield Bond)",
    short: "BB 등급 이하의 고위험 회사채",
    detail:
      "투기등급 회사채. 부도 위험 큰 만큼 yield 높음 (보통 국채 +3-6%p).\n\n경기 좋을 때: 국채와 yield 차이(스프레드) 좁아짐 → 정크본드 가격 ↑\n경기 침체 시: 스프레드 벌어짐 → 정크본드 폭락 (주식과 함께)\n\nHigh-Yield 스프레드는 경기 침체의 선행 지표. 6%p 넘어가면 위험.",
    related: ["credit-rating", "yield"],
  },
  treasury: {
    term: "국채 (Treasury / 국고채)",
    short: "정부가 발행하는 채권 — 무위험 기준자산",
    detail:
      "정부의 신용으로 발행되는 채권. 자국 통화로 발행한 자국 국채는 사실상 무부도(money printing 가능).\n\nUS Treasury:\n• T-Bill: 1년 미만 단기\n• T-Note: 2-10년\n• T-Bond: 10-30년\n\n10년물 yield는 모든 자산 가격의 기준 (할인율 base). 주식 valuation에도 큰 영향.",
    related: ["yield", "yield-curve", "bond"],
  },

  // ─────────── 거시경제 / 지표 ───────────
  gdp: {
    term: "GDP (국내총생산)",
    short: "한 국가가 1년간 생산한 부가가치 총합",
    detail:
      "경제 규모의 가장 기본 지표. 분기별 발표 (전 분기 대비 연율 % 또는 전년 동기 대비).\n\nGDP 성장률이 2분기 연속 마이너스면 통상 'Technical Recession' 정의. 다만 미국 NBER은 종합적으로 판단.\n\n한국 평균 2-3%, 미국 2-2.5%, 중국 5-6% (둔화 중), 인도 6-7%.\n\n명목 GDP vs 실질 GDP: 인플레 제거한 게 실질. 비교는 항상 실질로.",
    related: ["inflation", "recession"],
  },
  "cpi-core": {
    term: "CPI / Core CPI (소비자물가지수)",
    short: "인플레이션 측정의 표준",
    detail:
      "Consumer Price Index. 가계가 사는 재화·서비스 가격의 평균 변동.\n\n• Headline CPI: 모든 품목 (식품·에너지 포함)\n• Core CPI: 식품·에너지 제외 (변동성 큰 항목 제거)\n\nFed의 인플레 목표 2%는 PCE(개인소비지출) Core 기준이지만 CPI도 주요. 매월 둘째 주 화/수 발표 — 시장 변동성 큰 이벤트.\n\n한국 1-2%, 미국 2-3%가 평균. 2022년 미국 CPI 9.1% 도달 (40년 최고).",
    related: ["inflation", "fomc"],
  },
  ppi: {
    term: "PPI (생산자물가지수)",
    short: "기업이 생산자에게 지불하는 가격",
    detail:
      "Producer Price Index. 도매 단계의 가격. CPI의 선행 지표 — 원자재/중간재 가격 변동이 1-3개월 뒤 소비자에게 전가.\n\nPPI 급등 → 기업 마진 압박 또는 향후 소비자가 인상. 디스인플레이션 추세를 PPI에서 먼저 확인 가능.",
    related: ["cpi-core", "inflation"],
  },
  unemployment: {
    term: "실업률 (Unemployment Rate)",
    short: "구직 의사 있는 사람 중 미취업 비율",
    detail:
      "노동시장 건전성. 미국 매월 첫째 주 금 NFP(비농업 고용)와 함께 발표.\n\n• 완전고용 수준: 미국 4-5%, 한국 3% 정도\n• 자연실업률(NAIRU): 인플레 가속 없이 유지 가능한 최저 수준 (미국 4.5%)\n• 4% 미만 → 임금 인상 압력 → 인플레 상승 (Phillips Curve)\n\nFed dual mandate: 물가 안정 + 완전고용.",
    related: ["nfp", "fomc"],
  },
  nfp: {
    term: "NFP (비농업 고용지표)",
    short: "미국 매월 신규 고용자 수",
    detail:
      "Non-Farm Payrolls. 농업 부문 제외한 신규 고용 인원수. 미국 노동부 발표.\n\n200K+ 강한 고용, 100K 미만 둔화, 0이나 음수면 침체 진입.\n\n발표 후 시장 반응: 너무 강하면 → Fed 매파 기조 우려 → 주식 ↓\n너무 약하면 → 침체 우려 → 주식 ↓\n적당하면 → 골디락스 → 주식 ↑\n\n주가에 양면적 효과 (Bad news is good news 같은 비대칭).",
    related: ["unemployment", "fomc"],
  },
  fomc: {
    term: "FOMC (연방공개시장위원회)",
    short: "미국 연준의 금리 결정 회의",
    detail:
      "Federal Open Market Committee. 8주에 1회(연 8회) 기준금리 결정. 12명 위원이 투표.\n\n발표 후 2:30 PM ET 의장 회견. 점도표(분기별)는 3월/6월/9월/12월에 발표.\n\n주요 변수: 기준금리, 양적완화/긴축, 경제 전망(SEP). 시장 영향력 글로벌 최대.\n\nFed Watch Tool (CME)에서 시장이 보는 다음 회의 금리 인상/인하 확률 확인 가능.",
    related: ["fed", "interest-rate"],
  },
  fed: {
    term: "Fed (연준 / Federal Reserve)",
    short: "미국 중앙은행",
    detail:
      "공식 명칭 Federal Reserve System. 의장 임기 4년(연임 가능), 부의장 + 5명 이사 + 12명 지역 연은 총재.\n\n역할:\n1) 통화정책 (금리, QE)\n2) 은행 감독\n3) 시스템 안정성\n\nDual Mandate: 물가 안정(인플레 2%) + 완전고용. ECB(인플레만), BOJ(인플레만)와 다른 점.\n\n2008 이후 '실질적 글로벌 중앙은행' 역할 — 달러 기축 + 외환스왑.",
    related: ["fomc", "bok", "qe"],
  },
  bok: {
    term: "한은 (한국은행)",
    short: "한국 중앙은행",
    detail:
      "Bank of Korea. 1950 설립. 금융통화위원회(금통위)가 기준금리 결정 — 연 8회.\n\n총재 임기 4년. 정부에서 독립적 정책 결정.\n\nKR 기준금리 변화 (2024-2026):\n• 2023.1: 3.5% (4년만의 최고)\n• 2024.10: 3.25% (인하 시작)\n• 2025: 3.0% → 2.75%\n\n미국과의 금리 격차 → 환율/자본유출 압력.",
    related: ["interest-rate", "fed"],
  },
  qe: {
    term: "양적완화 (QE / Quantitative Easing)",
    short: "중앙은행이 채권을 사들여 시중에 돈 풀기",
    detail:
      "기준금리가 0에 가까워 더 내릴 수 없을 때 쓰는 비전통적 정책. 중앙은행이 장기국채/MBS를 매입해 시중 유동성 공급.\n\n효과: 장기금리 ↓ + 자산가격 ↑ + 통화량 ↑\n부작용: 자산 거품, 부의 불평등 심화\n\nFed QE 시기:\n• 2008-2014: QE1-3 (4조→4.5조)\n• 2020-2022: 코로나 QE (4→9조 USD)\n\n반대는 QT (양적긴축) — 보유 채권 만기 도래 시 재투자 안 함.",
    related: ["qt", "monetary-policy"],
  },
  qt: {
    term: "양적긴축 (QT / Quantitative Tightening)",
    short: "중앙은행이 보유 채권을 축소해 유동성 회수",
    detail:
      "QE의 반대. 중앙은행 대차대조표를 줄여 시중 통화량 회수.\n\nFed 2022.6 시작 — 매월 최대 950억 USD 축소. 시장 유동성 위축 → 변동성 ↑.\n\n2024.9 Fed QT 속도 둔화. 2025 종료 예상.",
    related: ["qe"],
  },
  "monetary-policy": {
    term: "통화정책 (Monetary Policy)",
    short: "중앙은행이 금리/통화량으로 경제 조절",
    detail:
      "도구:\n1) 기준금리 조정 (가장 기본)\n2) 양적완화/긴축 (QE/QT)\n3) 지급준비율\n4) 포워드 가이던스 (말로 시장 방향 제시)\n\n목표: 물가 안정 + 완전고용 + 시스템 안정.\n\n재정정책(정부 지출/세금)과 구분. 두 정책이 같이 가면 효과 증폭(2020 코로나), 충돌하면 약화.",
    related: ["fed", "interest-rate", "fiscal-policy"],
  },
  "fiscal-policy": {
    term: "재정정책 (Fiscal Policy)",
    short: "정부가 지출/세금으로 경제 조절",
    detail:
      "통화정책의 한계(zero lower bound)를 보완. 정부가 직접 돈을 쓰거나 세금을 줄여 수요 자극.\n\n도구:\n• 재정지출 (인프라, 사회복지)\n• 감세 / 증세\n• 보조금\n• 정부부채 발행\n\n장점: 직접적 효과. 단점: 정치적 지연, 부채 누적.\n\n미국 GDP 대비 정부부채 120% (2024) — 역사적으로 매우 높음.",
    related: ["monetary-policy", "gdp"],
  },
  recession: {
    term: "경기침체 (Recession)",
    short: "경제가 두 분기 연속 위축",
    detail:
      "Technical Recession: 실질 GDP가 2분기 연속 마이너스.\nNBER 공식 정의: 광범위한 경제활동 위축 — 고용/소득/생산 모두.\n\n역사적 선행지표:\n• Yield curve 역전 (-100%)\n• PMI 50 하회 (제조업 위축)\n• Sahm Rule (실업률 급등)\n• Leading Economic Index 6개월 연속 하락\n\n침체 평균 11개월 지속. 시장은 침체 6-12개월 앞서 하락 시작, 침체 중간에 바닥 잡고 회복.",
    related: ["gdp", "yield-curve"],
  },
  "soft-landing": {
    term: "연착륙 (Soft Landing)",
    short: "침체 없이 인플레 잡기",
    detail:
      "금리 인상으로 인플레는 잡으면서 경기 침체는 피하는 시나리오. 매우 어려움 — 역사적으로 1995년 한 번만 성공.\n\nHard Landing = 침체 동반.\nNo Landing = 인플레가 잡히지 않고 경제는 강함 (가장 안 좋은 시나리오 for Fed).\n\n2024 시장: Fed의 soft landing 성공 시나리오 가격 반영. 2025-2026 검증 중.",
    related: ["recession", "inflation"],
  },
  stagflation: {
    term: "스태그플레이션 (Stagflation)",
    short: "물가는 오르는데 경제는 침체",
    detail:
      "1970년대 미국 — 오일쇼크 + 닉슨 가격통제 + 베트남 전비 → 인플레 + 실업 동시.\n\n중앙은행에 최악의 상황 — 금리 올리면 침체 악화, 내리면 인플레 가속.\n\n2022 일부 우려 (CPI 9% + 경기 둔화)였으나 다행히 연착륙 방향. 자산: 금/원자재 강세, 주식/채권 약세.",
    related: ["inflation", "recession"],
  },
  deflation: {
    term: "디플레이션 (Deflation)",
    short: "물가가 지속적으로 하락",
    detail:
      "CPI 마이너스. 듣기엔 좋아 보이지만 경제엔 독:\n• 소비 지연 → 수요 위축 → 기업 매출 ↓ → 임금 ↓ → 더 큰 수요 위축\n• 실질 부채 부담 ↑ (돈의 가치 ↑)\n\n일본 1990-2010 'lost decades'. 중국 2023-2024 일부 신호.\n\nFed/BOJ가 인플레 2% 목표하는 이유 — 0% 근처는 디플레 위험.",
    related: ["inflation"],
  },

  // ─────────── 통화 / 환율 ───────────
  dxy: {
    term: "달러 인덱스 (DXY)",
    short: "달러의 6개 주요 통화 대비 강도",
    detail:
      "USD vs EUR(58%) + JPY(14%) + GBP(12%) + CAD(9%) + SEK(4%) + CHF(4%) 가중평균.\n\nDXY ↑ = 달러 강세\n• 신흥국 자산 약세 (자금 유출)\n• 원자재(USD 표시) 가격 ↓\n• 미국 수출 기업 불리\n\n100이 기준. 2022 114까지 (20년 최고), 2024 100-105 박스권.",
    related: ["fx", "interest-rate"],
  },
  "carry-trade": {
    term: "캐리 트레이드 (Carry Trade)",
    short: "저금리 통화 빌려 고금리 통화에 투자",
    detail:
      "예: 일본 0% → 엔화 빌려 미국 5% 채권 매수. 금리 차이 5% 수익.\n\n위험: 환율 변동. 엔화가 강세 전환되면 → 빌린 돈 갚을 때 큰 손실.\n\n2024.8 블랙먼데이 — BOJ 금리 인상 + 엔화 급등 → 엔캐리 청산 → 글로벌 자산 폭락.",
    related: ["fx", "leverage"],
  },

  // ─────────── 원자재 / 선물 / 옵션 ───────────
  commodity: {
    term: "원자재 (Commodity)",
    short: "원유, 금속, 농산물 등 기초 재화",
    detail:
      "에너지(WTI, Brent, 천연가스), 금속(금, 은, 구리), 농산물(옥수수, 콩, 밀) 등.\n\n주식과의 상관관계: 보통 낮음 → 분산 효과. 인플레 시기엔 강세.\n\n투자 방법: 원자재 ETF (선물 추적), 광산/정유 주식, 원자재 지수 펀드.",
    related: ["futures", "inflation"],
  },
  futures: {
    term: "선물 (Futures)",
    short: "미래 특정일에 정해진 가격으로 사고팔기 약속",
    detail:
      "원자재/주가지수/통화 등의 미래 가격 거래. 표준화된 계약 (한국 거래소, CME 등).\n\n장점: 레버리지 (증거금 일부), 헤지 가능\n단점: 매일 mark-to-market — 손실 시 추가 증거금 (마진콜)\n\n만기 시 실물 인도 또는 현금 정산. 대부분 만기 전 청산.",
    related: ["leverage", "hedge", "options-basic"],
  },
  "options-basic": {
    term: "옵션 (Options)",
    short: "특정 가격에 사거나 팔 권리 (의무 아님)",
    detail:
      "콜옵션 (Call): 살 수 있는 권리 — 가격 상승 베팅\n풋옵션 (Put): 팔 수 있는 권리 — 가격 하락 베팅\n\n프리미엄 (옵션 가격) = 내재가치 + 시간가치. 만기 다가올수록 시간가치 ↓ (Theta decay).\n\nIn-the-Money / At-the-Money / Out-of-the-Money.\n\n블랙숄즈 모형으로 가격 결정. 변동성(IV) ↑ → 프리미엄 ↑. VIX는 S&P 옵션의 평균 IV.",
    related: ["futures", "vix"],
  },
  vix: {
    term: "VIX (변동성 지수 / 공포 지수)",
    short: "S&P 500 30일 IV 기대치",
    detail:
      "CBOE Volatility Index. S&P 500 옵션 가격으로부터 역산된 30일 예상 변동성(%).\n\n평상시: 12-20\n불안: 20-30\n패닉: 30+\n극단: 50+\n\n역대 최고: 2020.3 코로나 82.7, 2008 GFC 80.86, 2024.8 65.\n\nVIX와 S&P는 음의 상관관계. 폭락 시 VIX 폭등 — '공포는 가격이 있다'.",
    related: ["options-basic"],
  },
  contango: {
    term: "콘탱고 (Contango)",
    short: "선물가 > 현물가",
    detail:
      "원자재 선물의 정상적 상태. 보관/운반/이자 비용이 반영되어 미래 선물이 더 비쌈.\n\n원자재 ETF의 함정: 만기 다가오면 비싼 다음 선물로 롤오버 — 매번 손실. 'Contango Decay'.\n\n예: 원유 ETF USO 장기 보유 시 현물 상승해도 ETF는 underperform. WTI 자체 +50%일 때 USO는 +20% 수준.",
    related: ["futures", "backwardation"],
  },
  backwardation: {
    term: "백워데이션 (Backwardation)",
    short: "선물가 < 현물가",
    detail:
      "현물 공급 부족으로 즉시 인도가 미래 인도보다 더 비싼 상태. 콘탱고의 반대.\n\n원자재 ETF엔 호재 — 롤오버 시 이익. 보통 위기 시 (전쟁, 공급망 차질) 발생.\n\n2022 우크라이나 전쟁 직후 원유 백워데이션 → 원유 ETF outperform.",
    related: ["futures", "contango"],
  },

  // ─────────── 펀드 / ETF ───────────
  "index-fund": {
    term: "인덱스 펀드 (Index Fund)",
    short: "주가지수를 따라가는 패시브 펀드",
    detail:
      "S&P 500, KOSPI 200 같은 지수의 종목을 시총 비중으로 보유. 펀드매니저의 종목 선택 없음 — 운용보수 매우 저렴 (0.03-0.15%).\n\nSPIVA 보고서: 미국 액티브 펀드의 85%가 10년 기준 S&P 500 underperform. 그래서 워런 버핏도 '일반인은 인덱스에 묻어둬라'.\n\n현대 인덱스 펀드의 대부분은 ETF 형태.",
    related: ["etf", "mutual-fund"],
  },
  etf: {
    term: "ETF (상장지수펀드)",
    short: "주식처럼 거래되는 펀드",
    detail:
      "Exchange Traded Fund. 펀드 1주 = 기초자산 묶음에 대한 청구권. 실시간 매매 가능, 운용보수 저렴, 분산 효과.\n\n대표:\n• SPY, VOO: S&P 500\n• QQQ: NASDAQ 100\n• VTI: 미국 전체 시장\n• KODEX 200: KOSPI 200\n• 섹터(SOXX 반도체, XLV 헬스케어)\n• 테마(ARKK, BOTZ AI)\n• 채권(BND, AGG)\n• 원자재(GLD 금)\n\n주의: 레버리지 ETF (TQQQ, SOXL)는 단타용. 장기 보유 시 volatility decay로 손실.",
    related: ["index-fund", "leverage"],
  },
  "mutual-fund": {
    term: "뮤추얼 펀드 (Mutual Fund)",
    short: "전통적 펀드 — 하루 1회 NAV 거래",
    detail:
      "ETF 이전의 표준. 장 마감 후 NAV(순자산가치) 한 번 산정해 그 가격에 매수/매도.\n\n장점: 펀드매니저 적극 운용 (액티브)\n단점: 보수 비쌈 (1%+), 실시간 거래 X, 환매 수수료\n\n선진국에서는 ETF로 대체되는 추세. 한국은 IRP/연금저축에서 여전히 주요.",
    related: ["etf", "index-fund"],
  },
  "hedge-fund": {
    term: "헤지펀드 (Hedge Fund)",
    short: "고액 투자자 대상 절대수익 추구 펀드",
    detail:
      "공매도/레버리지/파생상품 등 자유롭게 활용. 시장과 무관한 절대 수익 목표.\n\n특징:\n• 고액 (보통 $1M+ 진입)\n• 운용보수 2% + 성과보수 20% (Two and Twenty)\n• 락업 기간 (1-3년 환매 제한)\n• 비공개\n\nLong/Short, Macro, Event-Driven, Quant 등 전략별 다양. 평균 수익률은 S&P를 못 이기는 경우 많아 미국에선 인기 하락.",
    related: ["leverage", "short-selling"],
  },

  // ─────────── 위험 / 통계 ───────────
  beta: {
    term: "베타 (β)",
    short: "시장 대비 종목의 변동성",
    detail:
      "회귀분석으로 산출. β=1은 시장과 같이 움직임, β=2는 2배 변동, β=0은 시장과 무관.\n\nβ < 1: 방어주 (KT&G, 유틸리티)\nβ ≈ 1: 시장 평균 (삼성전자 약 1.1)\nβ > 1.5: 변동성 큰 성장주 (테슬라 2.3, NVDA 1.8)\nβ < 0: 시장과 반대 (금, 채권)\n\nCAPM에서 위험 프리미엄 계산에 사용.",
    formula: "기대수익률 = 무위험금리 + β × (시장수익률 - 무위험금리)",
    related: ["sharpe-ratio", "correlation"],
  },
  alpha: {
    term: "알파 (α)",
    short: "벤치마크 대비 초과수익률",
    detail:
      "포트폴리오 수익률 - (예측된 시장 수익률 × β). 즉 베타 위험으로 설명되지 않는 추가 수익.\n\n+5% 알파: 시장보다 5%p 잘함\n0 알파: 시장과 같은 수익 (그냥 ETF가 더 효율적)\n- 알파: 시장보다 못함\n\n장기 + 알파를 내는 펀드매니저는 1% 미만. 그래서 '알파를 못 내면 비용 낮은 베타(ETF)가 답'.",
    related: ["beta", "sharpe-ratio"],
  },
  "sharpe-ratio": {
    term: "샤프 비율 (Sharpe Ratio)",
    short: "위험 1단위당 초과수익",
    detail:
      "(포트폴리오 수익률 - 무위험금리) ÷ 표준편차.\n\n0.5 미만: 평범\n1+: 좋음\n2+: 매우 좋음\n3+: 비현실적 (가장 큰 헤지펀드도 1.5-2)\n\n같은 수익률이라도 변동성 작으면 샤프 ↑. 위험조정 수익률의 표준 측정.",
    formula: "Sharpe = (Rp - Rf) ÷ σp",
    related: ["alpha", "beta", "standard-deviation"],
  },
  "sortino-ratio": {
    term: "소르티노 비율 (Sortino Ratio)",
    short: "하방 변동성만 보는 샤프",
    detail:
      "Sharpe는 상승 변동성도 위험으로 봄. Sortino는 하방 표준편차만 사용 — 상승은 위험 X.\n\n실제 투자자 심리에 더 맞음 — 떨어지는 게 위험이지 오르는 건 행복.\n\nSharpe 1, Sortino 2면 = 손실 변동성이 작고 수익 변동성이 큰 좋은 패턴.",
    related: ["sharpe-ratio"],
  },
  "max-drawdown": {
    term: "최대 낙폭 (Max Drawdown)",
    short: "역대 고점에서 저점까지 최대 손실률",
    detail:
      "포트폴리오가 견딘 최악의 손실. -50% drawdown 후 본전 회복엔 +100% 수익 필요.\n\n역사적 MDD:\n• S&P 500: -57% (2008-2009)\n• KOSPI: -65% (1997-1998 IMF), -47% (2008)\n• 비트코인: -85% (2018, 2022)\n\n장기 투자엔 MDD를 견딜 심리적 준비가 필수. 짧은 시계열의 MDD는 비현실적으로 낮을 수 있음.",
    related: ["sharpe-ratio"],
  },
  "value-at-risk": {
    term: "VaR (Value at Risk)",
    short: "특정 신뢰수준에서 최악 손실 추정",
    detail:
      "95% VaR이 100만원이면 = 95% 확률로 1일 손실이 100만원 이하. 5% 확률로 그 이상.\n\n금융기관 리스크 관리의 표준. 정규분포 가정 — fat-tail 위험은 과소평가 (1998 LTCM, 2008 GFC가 증명).\n\nCVaR (Conditional VaR) = VaR 초과 시 평균 손실. 꼬리 위험 더 잘 잡음.",
    related: ["max-drawdown", "standard-deviation"],
  },
  cagr: {
    term: "CAGR (연평균 복리수익률)",
    short: "장기 수익을 연 단위로 환산",
    detail:
      "Compound Annual Growth Rate. 시작값/종료값/햇수로 계산.\n\n예: 1억 → 3년 후 1.5억\nCAGR = (1.5/1)^(1/3) - 1 = 14.5%/년\n\n단순 평균 수익률과 다름. 변동성 큰 자산일수록 단순평균 > CAGR (volatility drag).\n\nS&P 500 장기 CAGR 약 10%, KOSPI 약 7%.",
    formula: "CAGR = (종료값/시작값)^(1/년수) - 1",
    related: ["sharpe-ratio"],
  },
  "standard-deviation": {
    term: "표준편차 (σ)",
    short: "수익률의 변동성",
    detail:
      "데이터의 평균에서 얼마나 흩어져 있는지. 주식 수익률 분포에 적용하면 위험 측정.\n\n정규분포 가정:\n• ±1σ 안: 68%\n• ±2σ 안: 95%\n• ±3σ 안: 99.7%\n\n주의: 주가 수익률은 정규분포 아님 — fat-tail (극단 사건이 정규분포 예측보다 자주). 1987 블랙먼데이는 25σ 사건 — 우주 나이 동안 일어날 수 없는 확률이었으나 일어남.",
    related: ["beta", "value-at-risk"],
  },
  "kelly-criterion": {
    term: "켈리 기준 (Kelly Criterion)",
    short: "장기 자산 성장을 최대화하는 베팅 비중",
    detail:
      "원래 도박 이론. 매 베팅마다 얼마를 걸어야 장기 자산이 최대로 자라는가.\n\nKelly% = (승률 × 평균수익률 - 패률 × 평균손실률) ÷ 평균수익률\n\n주식에 적용 시 보통 풀 Kelly의 1/2~1/4만 사용 (Half Kelly) — 추정 오차 + 변동성 견디기 위함.\n\n켈리가 시사하는 것: 한 종목/한 베팅에 자산의 100% 넣으면 장기 파산 확률 높음.",
    related: ["max-drawdown"],
  },
  correlation: {
    term: "상관계수 (Correlation)",
    short: "두 자산이 함께 움직이는 정도",
    detail:
      "-1 (완전 반대) ~ +1 (완전 동조). 0은 무관.\n\n분산투자의 핵심: 낮은 상관관계의 자산을 섞으면 같은 수익률에서 변동성 ↓.\n\n역사적 상관관계:\n• 주식 vs 채권: -0.2 ~ +0.3 (시기별 변동)\n• 주식 vs 금: -0.1 ~ +0.1\n• 미국 주식 vs 한국 주식: 0.5-0.7\n\n주의: 위기 시 모든 상관관계가 1로 수렴 — 분산효과 약화.",
    related: ["diversification", "beta"],
  },

  // ─────────── 투자 스타일 / 행동 ───────────
  "value-investing": {
    term: "가치 투자 (Value Investing)",
    short: "내재가치 < 시장가격일 때 매수",
    detail:
      "벤저민 그레이엄 → 워런 버핏 → 찰리 멍거 계보.\n\n원칙:\n• 안전마진 (내재가치의 70% 이하 매수)\n• 장기 보유 (3-10년)\n• 사업 이해도 (Circle of Competence)\n• 우량 사업 + 합리적 가격\n\n저PER/저PBR 단순 가치주 ≠ 가치투자. 사업이 구조적으로 안 좋으면 'Value Trap'.",
    related: ["growth-vs-value", "intrinsic-value"],
  },
  "growth-investing": {
    term: "성장 투자 (Growth Investing)",
    short: "고성장 기업에 비싸도 투자",
    detail:
      "필립 피셔 → 피터 린치 → 캐시 우드 계보.\n\n원칙:\n• 매출/이익 연 20%+ 성장\n• TAM (Total Addressable Market) 큰 시장\n• 경영진의 비전\n• 가격은 부차적 (할인보다 성장이 중요)\n\n위험: 성장 둔화 시 멀티플 contraction. 50% PER → 20% PER만 되도 가격 -60%.",
    related: ["growth-vs-value", "peg"],
  },
  "dollar-cost-averaging": {
    term: "정기적립 매수 (DCA)",
    short: "매월 일정액 분산 매수",
    detail:
      "Dollar Cost Averaging. 시장 타이밍을 포기하고 일정 금액을 주기적으로 매수. 단기 변동성 신경 안 씀.\n\n장점:\n• 감정 배제\n• 평균 매수단가 안정화\n• 시간 분산 효과\n\n단점: 강한 상승장에선 일시불(lump sum)보다 수익률 낮음. 통계상 일시불이 평균적으로 더 우수하지만, 사람은 lump sum 직후 -20% 보면 못 버팀.",
    related: ["rebalancing"],
  },
  rebalancing: {
    term: "리밸런싱 (Rebalancing)",
    short: "목표 자산 비중으로 주기적 재조정",
    detail:
      "예: 주식/채권 60/40 목표. 주식이 잘 올라 70/30이 됐다면 → 주식 10% 매도, 채권 10% 매수.\n\n효과:\n• 자연스러운 'Buy Low, Sell High'\n• 위험 수준 유지\n• 행동편향 견제\n\n주기: 분기 또는 반기 1회. 너무 자주 하면 수수료 손해.",
    related: ["asset-allocation", "dollar-cost-averaging"],
  },
  "asset-allocation": {
    term: "자산 배분 (Asset Allocation)",
    short: "주식/채권/원자재/현금 등 비중 결정",
    detail:
      "장기 수익률의 90%가 자산 배분에서 결정된다는 연구 (Brinson 1986). 종목 선택보다 훨씬 중요.\n\n대표 전략:\n• 60/40 (주식/채권)\n• All Weather (Ray Dalio): 30/55/7.5/7.5 (주식/채권/금/원자재)\n• 70/30 공격적\n• 40/60 보수적\n\n나이/위험성향/투자기간에 따라 다름. 100 - 나이 = 주식 비중이라는 단순 룰도 있음.",
    related: ["rebalancing", "diversification"],
  },
  "loss-aversion": {
    term: "손실회피 (Loss Aversion)",
    short: "같은 크기 손실이 이익보다 2배 아픔",
    detail:
      "Kahneman & Tversky 발견. 1만원 잃는 고통 ≈ 2만원 얻는 기쁨.\n\n결과:\n• 손실 종목 끝까지 보유 (원금만 회복하면...)\n• 수익 종목 일찍 익절\n→ 처분효과 (Disposition Effect)\n\n해결: 매수 시 손절/익절 가격 미리 정하기. 시스템화로 감정 배제.",
    related: ["disposition-effect", "behavioral-biases"],
  },
  "disposition-effect": {
    term: "처분효과 (Disposition Effect)",
    short: "수익은 빨리 팔고 손실은 오래 들고있는 경향",
    detail:
      "Shefrin & Statman 1985. Loss aversion의 자연스러운 결과.\n\n통계: 일반 투자자는 수익 종목을 평균 102일, 손실 종목을 평균 124일 보유. 즉 손실을 22일 더 오래.\n\n반대로 우수한 트레이더는 winner를 오래 보유, loser를 빨리 손절 (Cut losses short, let winners run).",
    related: ["loss-aversion"],
  },
  "anchoring-bias": {
    term: "닻 효과 (Anchoring Bias)",
    short: "첫 정보에 비합리적으로 매달림",
    detail:
      "Tversky & Kahneman 1974. 매수가가 anchor가 되어 결정이 왜곡됨.\n\n매수가 10만원 → 12만원에서 무리하게 익절, 9만원이면 손절 못함. 매수가는 시장이 정한 가격이 아니라 내 결정일 뿐인데 판단 기준이 됨.\n\n극복: 매번 'Sunk cost는 무시하고 지금 다시 산다면 살까?'를 자문.",
    related: ["loss-aversion"],
  },
  "herd-mentality": {
    term: "군중심리 (Herd Mentality)",
    short: "남들 따라 사고팔기",
    detail:
      "혼자 틀리는 것보다 다같이 틀리는 게 덜 두려운 심리. 버블과 폭락의 핵심 원인.\n\n• 2021 GameStop, AMC: 레딧 군중\n• 1999 닷컴 IPO 광기\n• 2020-2022 NFT 광기\n\n역설적으로 군중과 반대로 가는 'Contrarian'이 장기적으로 우수한 경우 많음 — 단, 정확한 분석 필요.",
    related: ["fomo", "bubble"],
  },
  fomo: {
    term: "FOMO (Fear Of Missing Out)",
    short: "기회를 놓치는 두려움",
    detail:
      "남들이 다 돈을 벌고 있다는 SNS/뉴스 노출에 자극되어 충동 매수. 보통 고점 매수.\n\n2024 AI/NVDA 광기 시기 일반인 진입 급증 = 전형적 FOMO 패턴.\n\n해결: 매매 결정은 일과 분리된 시간에. SNS는 의도적으로 피하기.",
    related: ["herd-mentality", "behavioral-biases"],
  },
  "confirmation-bias": {
    term: "확증편향 (Confirmation Bias)",
    short: "본인 의견을 지지하는 정보만 받아들임",
    detail:
      "좋아하는 종목의 긍정적 뉴스만 보고 부정 뉴스는 무시 / 폄하. 매수 후엔 심해짐 — 본인 결정을 정당화.\n\n극복:\n• 의도적으로 반대 의견 찾기\n• 매수 전에 'Bear Case' 작성\n• 매매일지로 결정 근거 문서화",
    related: ["herd-mentality"],
  },
  "behavioral-biases": {
    term: "인지편향 (Behavioral Biases)",
    short: "투자 판단을 왜곡하는 심리 함정",
    detail:
      "행동경제학(Behavioral Economics)의 핵심 주제. 인간은 합리적이지 않다.\n\n주요 편향:\n• 손실회피 (Loss Aversion)\n• 닻 효과 (Anchoring)\n• 확증편향 (Confirmation Bias)\n• 최근 편향 (Recency)\n• 과신 (Overconfidence)\n• FOMO / 군중심리\n• 처분효과 (Disposition)\n\n해결책 공통: 시스템화 + 일지 작성 + 의도적 반대편 검토.",
    related: ["loss-aversion", "fomo", "anchoring-bias"],
  },

  // ─────────── 한국 시장 특이 ───────────
  "kr-trading-session": {
    term: "한국 거래 시간",
    short: "정규 09:00-15:30, 시간외 다양",
    detail:
      "• 정규시장: 09:00-15:30 KST (점심시간 없음)\n• 동시호가:\n  - 시가 동시호가: 08:30-09:00\n  - 종가 동시호가: 15:20-15:30\n• 시간외 단일가: 16:00-18:00 (10분 단위 동시호가)\n• 시간외 종가: 15:40-16:00 (당일 종가)\n• NXT (대체거래소): 다른 시간대 운영\n\n변동성: 시가/종가 동시호가 = 큰 주문 몰림.",
    related: ["nxt", "vi"],
  },
  "preferred-stock": {
    term: "우선주",
    short: "의결권 없는 대신 배당 우선",
    detail:
      "보통주 vs 우선주: 한국 특이 — 미국엔 의미 다름.\n\n특징:\n• 의결권 X\n• 배당 받을 권리 우선 (보통주보다 약간 더)\n• 보통주 대비 평균 20-50% 할인 거래\n\n예: 삼성전자 vs 삼성전자우(005935). 우선주 디스카운트가 너무 크면 가치주 후보로 거론되기도.",
    related: ["dividend"],
  },
  "rights-offering": {
    term: "유상증자",
    short: "기존 주주에게 신주 발행 권리",
    detail:
      "회사가 추가 자금이 필요할 때 신주를 발행. 기존 주주가 보유 비율대로 살 수 있는 권리 부여 (또는 일반 공모).\n\n단기 영향: 주식 수 ↑ → EPS 희석 → 주가 하락 압력. 보통 공시 직후 -5~-15%.\n\n무상증자와 다름 — 무상은 잉여금에서 주식으로 전환, EPS는 같음(주가만 분할 효과).",
    related: ["stock-split"],
  },
  "kosdaq-vs-kospi": {
    term: "KOSDAQ vs KOSPI",
    short: "한국의 두 주요 거래소",
    detail:
      "**KOSPI**: 한국거래소 본 시장. 대기업 + 우량주. 시총 가중. 평균 PER 10-15.\n**KOSDAQ**: 코스닥. 중소/벤처/기술주. 시총 가중. 평균 PER 15-25, 변동성 ↑.\n\n2024년 KOSPI 시총 약 2,200조원, KOSDAQ 400조원.\n\nKOSDAQ은 미국 NASDAQ 모델. 변동성 큰 만큼 잡주 비율도 ↑ — 종목 분석 더 신중.",
    related: ["kr-trading-session"],
  },

  // ─────────── 세금 / 절세 ───────────
  "capital-gains-tax": {
    term: "양도소득세",
    short: "주식 매도 차익에 부과되는 세금",
    detail:
      "한국:\n• 국내 상장 주식: 대주주(특정 종목 10억+ 또는 지분 1-4%) 외 면세\n• 미국 주식: 250만원 초과 양도차익에 22% 분리과세\n\n미국: 단기(1년 미만) 일반세율 / 장기(1년+) 0~20% — 장기 보유 유도.\n\n2025년 한국 금융투자소득세 도입 보류. 대주주 기준은 정부별 변동.",
    related: ["fee-tax"],
  },
  "isa-irp": {
    term: "ISA / IRP / 연금저축",
    short: "한국 세제혜택 투자 계좌",
    detail:
      "**ISA (개인종합자산관리계좌)**: 연 2000만원 한도. 200만원까지 비과세 + 초과분 9.9% 분리과세 (저율). 3년 유지.\n\n**연금저축**: 연 400만원 한도 + IRP 300만원 = 총 700만원. 세액공제 13.2~16.5%. 55세 이후 연금 수령.\n\n**IRP**: 퇴직금 + 추가 납입. 세제혜택 동일.\n\n장기 투자자라면 세금 효율로 일반 계좌 대비 1-2%/년 추가 수익 효과.",
    related: ["capital-gains-tax"],
  },

  // ─────────── 코퍼레이트 액션 ───────────
  "m-and-a": {
    term: "M&A (인수합병)",
    short: "회사가 다른 회사 사거나 합치는 거래",
    detail:
      "**인수 (Acquisition)**: A 회사가 B 회사를 매수 (현금/주식 교환)\n**합병 (Merger)**: 두 회사가 합쳐서 새 회사\n\n인수 공시 후 보통:\n• 인수 대상: +20-50% 즉시 (인수 프리미엄)\n• 인수 주체: -5~10% (희석 우려)\n\n주주 승인 + 규제 승인 (공정위) 필요. 무산되면 가격 즉시 폭락.",
    related: ["buyback"],
  },
  "earnings-season": {
    term: "어닝 시즌 (Earnings Season)",
    short: "분기 실적 발표가 몰리는 4-6주",
    detail:
      "미국: 1/4/7/10월 둘째 주부터 — 대형 은행이 먼저 시작.\n한국: 미국 시즌 직후 (보통 1-2주 늦음).\n\n주가 영향:\n• Beat (예상 초과): 보통 +5-15%\n• Miss (예상 미달): 보통 -5-20%\n• In-line (예상 부합): 가이던스에 따라 변동\n\n실적 자체보다 **다음 분기 가이던스(guidance)**가 더 중요. 컨퍼런스콜 분위기도 시장 반응 결정.",
    related: ["earnings-announcement"],
  },
  "ex-dividend": {
    term: "배당락 (Ex-Dividend Date)",
    short: "이날 이후 매수자는 배당 못 받음",
    detail:
      "배당락일 = Record Date 1-2영업일 전. 그 이전에 매수해서 보유해야 배당 수령.\n\n배당락일 아침 주가는 배당금만큼 하락 (이론적). 실제로는 다른 변수 섞여 항상 정확하진 않음.\n\n배당 추격(dividend stripping): 배당 직전 매수해서 받고 직후 매도 — 세금 고려하면 보통 손해.",
    related: ["dividend"],
  },

  // ─────────── 일반 경제 상식 ───────────
  "supply-demand": {
    term: "수요와 공급",
    short: "가격이 형성되는 가장 기본 원리",
    detail:
      "수요 > 공급 → 가격 ↑\n수요 < 공급 → 가격 ↓\n\n주식도 마찬가지: 사려는 사람 > 팔려는 사람 → 가격 상승.\n\n탄력성 (Elasticity): 가격 변화에 수요/공급이 얼마나 반응하는지. 필수품은 비탄력적, 사치품은 탄력적.\n\n공급 충격 (oil shock 1973) → 가격 폭등 + 수량 감소 → 스태그플레이션.",
    related: ["inflation"],
  },
  "opportunity-cost": {
    term: "기회비용 (Opportunity Cost)",
    short: "선택한 것 때문에 포기한 차선의 가치",
    detail:
      "돈을 어디 쓸지 결정할 때 진짜 비용은 '명시적 지출 + 포기한 차선'.\n\n예: 주식에 1억 투자 = 명시적 비용 0이지만 채권 5% 수익 포기 = 기회비용 500만원/년.\n\n실생활: 대학원 진학의 진짜 비용 = 학비 + (4년간 못 번 연봉).\n\n투자에선 모든 자산을 기회비용으로 비교 — 채권 yield, 부동산 임대수익 등.",
    related: ["yield"],
  },
  "efficient-market-hypothesis": {
    term: "효율적 시장 가설 (EMH)",
    short: "시장 가격은 이용 가능한 모든 정보를 반영",
    detail:
      "Eugene Fama 1970. 3단계:\n\n• Weak: 과거 가격 정보 모두 반영 → 차트분석 무용\n• Semi-Strong: 모든 공개 정보 반영 → 펀더멘털 분석도 알파 X\n• Strong: 비공개 정보까지 반영 → 인사이더도 못 이김\n\n실증: 대체로 Semi-Strong 정도 맞음. 그래서 액티브 펀드의 85%가 인덱스 underperform.\n\n반론: 행동경제학 — 비합리적 군중이 단기 비효율 만듦.",
    related: ["random-walk", "value-investing"],
  },
  "random-walk": {
    term: "랜덤 워크 (Random Walk)",
    short: "주가는 무작위적으로 움직인다",
    detail:
      "Burton Malkiel 'A Random Walk Down Wall Street'. 단기 주가는 예측 불가능한 랜덤 변동.\n\n결론: 시장 타이밍은 무용. 그냥 분산된 ETF에 장기 묻어두는 게 답.\n\n반론: 모멘텀/평균회귀 같은 통계적 패턴은 존재 (학계 100+ 논문). 다만 거래비용 차감 후엔 어려움.",
    related: ["efficient-market-hypothesis"],
  },
  "black-swan": {
    term: "블랙 스완 (Black Swan)",
    short: "예측 불가능한 극단 사건",
    detail:
      "Nassim Taleb 'The Black Swan'. 정규분포 모델이 예측 못하는 fat-tail 사건.\n\n특징:\n1) 발생 전엔 거의 불가능해 보임\n2) 일어나면 엄청난 영향\n3) 일어난 후엔 '예측 가능했다'고 합리화\n\n예: 1987 블랙먼데이, 1998 LTCM, 2008 GFC, 2020 코로나, 2024.8 엔캐리 청산.\n\n대비: VaR 같은 정규분포 모델 신뢰 X. 보유 자산의 5-10% 정도는 비대칭 위험(옵션 hedge 등)으로.",
    related: ["value-at-risk"],
  },
  bubble: {
    term: "버블 (Bubble)",
    short: "내재가치 훨씬 초과한 가격 광기",
    detail:
      "역사적 패턴 (Minsky):\n1) Displacement: 신기술/혁신\n2) Boom: 가격 상승\n3) Euphoria: '이번엔 다르다' 광기\n4) Profit-taking: 스마트 머니 매도\n5) Panic: 매도 도미노\n\n예: 1637 튤립, 1929 대공황, 2000 닷컴, 2007 부동산, 2021 SPAC/Meme.\n\n버블 인지 어려움 — Greenspan 2000 \"non-rational exuberance\" 발언 후에도 3년 더 상승. 'Bubbles only burst' (Soros).",
    related: ["herd-mentality"],
  },
  "moral-hazard": {
    term: "도덕적 해이 (Moral Hazard)",
    short: "위험을 남이 부담하니 더 위험하게 행동",
    detail:
      "2008 'Too Big to Fail' — 대형은행은 망하면 정부가 구제 → 더 큰 위험 감수.\n\n예:\n• 보험: 화재보험 들면 화재 예방 노력 ↓\n• 은행 구제: 망해도 정부가 살린다 → 무모한 대출\n• 중앙은행 Put: Fed가 위기 시 항상 풀어준다 → 자산 거품 키움\n\n금융위기 후 'Bail-in' (주주/채권자가 손실 부담) 제도 강화 추세.",
    related: ["bubble"],
  },
  "wealth-effect": {
    term: "부의 효과 (Wealth Effect)",
    short: "자산가치 상승이 소비 증가로",
    detail:
      "주식 +1조원, 부동산 +1억원 → 실현 안 해도 부자 느낌 → 소비 ↑ → GDP ↑.\n\nFed가 QE 하는 진짜 이유 중 하나. 자산가격 부양으로 소비 자극.\n\n역효과: 자산 폭락 시 'Negative Wealth Effect' — 소비 위축으로 침체 가속. 2008/2020 패턴.",
    related: ["qe", "gdp"],
  },
  "trickle-down": {
    term: "낙수효과 vs 분수효과",
    short: "부유층/저소득층 어느 쪽이 먼저인가",
    detail:
      "**낙수효과 (Trickle-Down)**: 부자 감세 → 투자/소비 → 일자리 → 저소득층까지. Reaganomics.\n**분수효과**: 저소득층 직접 지원 → 소비 → 경제 활성화. Keynesian 계열.\n\n실증: 낙수효과 의문. IMF 보고서 \"부자 감세는 GDP 거의 무영향, 빈곤층 지원은 직접적\". 다만 분수효과도 인플레 위험.",
    related: ["fiscal-policy", "monetary-policy"],
  },
  "gini-coefficient": {
    term: "지니계수 (Gini Coefficient)",
    short: "소득 불평등 측정 0~1",
    detail:
      "0 = 완전 평등, 1 = 완전 불평등.\n\n주요국 지니계수 (2024):\n• 북유럽: 0.25 (평등)\n• 한국: 0.33\n• 미국: 0.40 (선진국 중 높음)\n• 남아공: 0.63 (세계 최고)\n\n금융자산 불평등은 소득 불평등보다 훨씬 큼. 미국 상위 1%가 전체 자산의 30%+ 보유.",
    related: ["wealth-effect"],
  },
  "phillips-curve": {
    term: "필립스 곡선 (Phillips Curve)",
    short: "실업률과 인플레이션의 trade-off",
    detail:
      "1958 William Phillips 발견. 단기적으로 실업률 ↓ → 임금 ↑ → 물가 ↑.\n\n중앙은행 dual mandate의 이론적 기반. 실업률 = NAIRU(자연실업률)보다 낮으면 인플레 가속.\n\n1970년대 스태그플레이션 (실업+인플레 동시)으로 단순 필립스 곡선 깨짐. 현대엔 'Augmented Phillips Curve' — 기대 인플레가 변수.\n\n2022 미국: 실업 4% + 인플레 9% = 곡선 우상향 시프트 = 기대인플레 상승.",
    related: ["unemployment", "inflation", "fed"],
  },
  "real-vs-nominal": {
    term: "실질 vs 명목",
    short: "인플레 차감 vs 차감 안함",
    detail:
      "명목 (Nominal): 화폐 단위 그대로\n실질 (Real): 인플레 차감해서 구매력 기준\n\n명목 GDP 성장 5% + 인플레 3% = 실질 GDP 성장 2%. 인플레가 높으면 명목 수익률은 좋아 보여도 실질로는 마이너스일 수 있음.\n\n예금 3% + 인플레 4% = 실질 -1% (구매력 손실).\n\n장기 투자는 항상 실질 기준으로 평가.",
    related: ["inflation", "cagr"],
  },
  "lagging-leading": {
    term: "선행 / 동행 / 후행 지표",
    short: "경기 사이클 대비 시점",
    detail:
      "**선행 (Leading)**: 경기 변화 6-12개월 앞서 움직임\n• PMI (구매관리자지수)\n• 주택허가\n• 신규 주문\n• 주가지수 자체\n• Yield curve\n\n**동행 (Coincident)**:\n• GDP\n• 실업률\n• 산업생산\n\n**후행 (Lagging)**:\n• CPI (보통 6개월 lag)\n• 기업 이익\n• 금리 (중앙은행 후행 대응)\n\nFed가 후행 지표(CPI) 보고 결정하니 정책이 늘 늦는다는 비판.",
    related: ["fomc", "recession"],
  },
  "soft-vs-hard-currency": {
    term: "Hard Currency vs Soft Currency",
    short: "강한 통화 vs 약한 통화",
    detail:
      "**Hard**: USD, EUR, JPY, CHF, GBP — 안정적, 신뢰, 국제 거래 통용\n**Soft**: 신흥국 통화 (BRL, TRY, ARS 등) — 인플레/정치 위험 ↑\n\n위기 시 자금은 hard로 도피 → 신흥국 자본유출. KRW도 위기 시 약세 (1997 1962원, 2022 1440원).\n\n글로벌 기축통화 = USD. 무역의 80%가 USD 결제.",
    related: ["dxy", "fx"],
  },
  "barbell-strategy": {
    term: "바벨 전략 (Barbell Strategy)",
    short: "극단 안전 + 극단 위험 자산만",
    detail:
      "Nassim Taleb. 중간 위험 자산 X. 자산의 80-90%를 무위험(국채)에, 나머지 10-20%를 고위험(스타트업, 옵션 등)에.\n\n장점:\n• 최악 손실 = 10-20% (관리 가능)\n• 큰 수익 가능 (블랙스완 upside)\n\n중간 자산 (BBB 채권 등) 회피 이유: 위기 시 함께 망하면서 수익은 평범.",
    related: ["asset-allocation", "black-swan"],
  },
  "j-curve": {
    term: "J 커브 (J-Curve)",
    short: "초기 악화 후 개선되는 패턴",
    detail:
      "초기 부정적 효과 후 시간 지나면서 긍정 전환되는 곡선.\n\n예:\n• 환율 평가절하 후 무역수지: 초기 악화(가격 효과) → 시간 지나며 개선(수출 증가)\n• 기업 구조조정: 초기 비용 ↑, 이익 ↓ → 후반 마진 개선\n• 사모펀드 투자: 초기 손실 → 후반 회수\n\n장기 시각 필요. 단기 데이터로 판단 X.",
    related: ["fx"],
  },
  "comparative-advantage": {
    term: "비교우위 (Comparative Advantage)",
    short: "기회비용이 낮은 것을 생산",
    detail:
      "David Ricardo 1817. 절대 우위가 아닌 상대 우위가 무역 결정.\n\n예: 의사 변호사 둘 다 타이핑 잘하지만 의사는 진료 시간당 50만원, 변호사는 상담 30만원. 둘 다 비서를 고용하는 게 합리적.\n\n글로벌 무역의 핵심 원리. 한국이 반도체에 특화하고 농산물을 수입하는 이유.",
    related: ["supply-demand"],
  },
  "network-effect": {
    term: "네트워크 효과 (Network Effect)",
    short: "사용자 많을수록 가치 ↑",
    detail:
      "Metcalfe's Law: 네트워크 가치는 사용자 수의 제곱에 비례.\n\n적용: SNS (페이스북), 메신저(카카오톡), 마켓플레이스(쿠팡, Amazon), 결제(Visa).\n\n네트워크 효과 가진 기업은 'winner takes all' 구조 → 시장 지배 + 높은 PER 정당. 다만 동시에 독점 규제 위험도.\n\nMoat (해자) 중 가장 강력한 형태.",
    related: ["growth-investing"],
  },
  "lindy-effect": {
    term: "린디 효과 (Lindy Effect)",
    short: "오래 살아남은 것은 더 오래 살아남는다",
    detail:
      "기술/책/회사 등은 살아온 시간만큼 앞으로도 살 가능성 ↑.\n\n예:\n• 셰익스피어는 400년 후에도 읽힐 가능성 → 매우 높음\n• 작년 베스트셀러 → 10년 후 읽힐지 불명\n\n투자 적용: 100년+ 살아남은 기업(코카콜라, JP모건)은 살아남을 확률 높음. 신생 hot 종목은 반대.\n\n신상품/신기술에 너무 흥분하지 말라는 메시지.",
    related: ["value-investing"],
  },
};

/**
 * Slug normalize: 영문 lowercase + dash. 한국어는 영문 키로 입력.
 */
export function getTerm(key: string): GlossaryEntry | undefined {
  return GLOSSARY[key.toLowerCase()];
}
