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
};

/**
 * Slug normalize: 영문 lowercase + dash. 한국어는 영문 키로 입력.
 */
export function getTerm(key: string): GlossaryEntry | undefined {
  return GLOSSARY[key.toLowerCase()];
}
