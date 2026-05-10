# 모의 주식 트레이딩 웹앱 — 설계 문서

**작성일**: 2026-05-10
**작성자**: 사용자 + Claude (브레인스토밍 협업)
**상태**: Draft (검토 대기)

---

## 1. 개요

한국(KOSPI/KOSDAQ)·미국(NYSE/NASDAQ) 거래소의 종목을 대상으로 하는 모의 주식 트레이딩 웹앱을 구축한다. 본인을 포함한 친구 단위(소규모)에서 수익률 경쟁을 핵심 사용 시나리오로 삼는다. PWA로 배포하여 PC/모바일 모두에서 동작하며, 한국 증권사 실전 UX(KRW + USD 분리 계좌, 환전, 시장가/지정가 주문)를 단순화된 형태로 재현한다.

### 1.1 목표 (Goals)

- **친구 단위 경쟁**: 호스트가 방을 만들어 친구를 초대하고, 시작자금/기간/통화 비율을 자유 설정한 챌린지를 운영
- **글로벌 리더보드**: 가입한 모든 사용자의 누적 수익률을 비교
- **실전 유사성**: 시장가/지정가 주문, 분리 계좌, 환전, 수수료, 배당, 분할 처리까지 시뮬레이션
- **저비용 운영**: 외부 유료 API 사용 없이 무료 티어만으로 친구 수십 명 규모 운영
- **모바일 친화**: PWA로 iPhone/Android 홈 화면 설치 후 네이티브 앱 같은 경험

### 1.2 비목표 (Non-Goals, v1 기준)

- 옵션·선물·공매도·마진 거래 (v2)
- 모바일 네이티브 앱 (v2)
- 친구 채팅 (v2)
- LLM 기반 AI 인사이트 (v3 또는 보류)
- 결제·유료화 (전부 무료 운영)
- 실시간(<1분) 시세 (15분 지연만 사용)

---

## 2. 핵심 의사결정 요약

| 항목 | 결정 |
|------|------|
| 사용자 모델 | 본인 + 친구 단위, 글로벌 + 친구방 시스템 |
| 플랫폼 | 웹 (PWA) — Vercel 배포 |
| 시세 신선도 | 15분 지연 |
| 종목 범위 | 검색 기반 동적 추가 (인기 100종목 prefetch) |
| 주문 종류 | 시장가 + 지정가 (GTC, 30일 만료) |
| 통화 처리 | KRW + USD 분리 계좌, 환전 명시적 |
| 시작 자금 (글로벌) | 1억 KRW + $0 |
| 시작 자금 (방) | 호스트 자유 설정 (KRW/USD 각각) |
| 시장 시간 | 시장가는 장중만, 지정가는 24/7 접수 |
| 경쟁 단위 | 글로벌 리더보드 + 친구방 (둘 다) |
| 차트 스코프 | 풀 스펙 — 캔들 + 지표(MA/RSI/MACD/볼린저) + 뉴스 + 재무 |
| 차트 라이브러리 | Lightweight Charts (TradingView 무료) |
| 방 최대 기간 | 호스트 자유 설정, 무제한 허용 |
| 추가 v1 기능 | 배당 시뮬, 분할/병합 자동 처리, Web Push, 룰 기반 종목 추천 |

---

## 3. 아키텍처

### 3.1 컴포넌트

```
┌─────────────────────────────┐
│   브라우저 (PWA)             │  Next.js 프론트엔드
│   - 로그인/거래/차트/리더보드  │  Lightweight Charts
│   - 서비스 워커 (Push)        │
└──────┬──────────────┬───────┘
       │ REST/RPC     │ WebSocket (Realtime)
       ▼              ▼
┌─────────────────────────────┐
│   Next.js API Routes         │  주문 접수, 사용자 액션
│   (Vercel)                   │  Supabase 클라이언트로 DB 조작
└──────┬──────────────────────┘
       │
       ▼
┌─────────────────────────────┐
│   Supabase                   │
│   - Postgres (스키마, RLS)    │
│   - Auth (이메일/구글)         │
│   - Realtime (포트폴리오 푸시) │
└──────▲──────────────────────┘
       │ service_role 키 사용 (RLS 우회)
       │
┌──────┴──────────────────────┐
│   Python Worker (Railway)    │
│   - 시세 fetch (yfinance/PyKRX)
│   - 매칭 엔진 (지정가)
│   - 리더보드 스냅샷
│   - FX 환율 갱신
│   - 배당/분할 자동 처리
│   - 종목 추천 계산
│   - Web Push 발송
│   - APScheduler
└──────────────────────────────┘
```

### 3.2 책임 분리

- **Next.js**: 사용자 액션 (주문 접수, UI, 인증). DB 접근은 RLS 위에서 사용자 토큰으로
- **Python 워커**: 외부 데이터 통합 + 시간 기반 자동화. 사용자 요청 처리 안 함
- **Supabase**: 진실의 단일 원천(SoT). 두 컴포넌트가 모두 여기서 통신
- **격리**: 워커 다운 시 사용자는 캐시된 가격으로 거래는 가능하나 가격 갱신은 멈춤 (지정가 매칭도 멈춤)

### 3.3 기술 스택

| 영역 | 선택 | 비고 |
|------|------|------|
| 프론트 | Next.js 15 (App Router) + TypeScript | RSC + PWA |
| UI | Tailwind CSS + shadcn/ui | 모바일 우선 |
| 차트 | Lightweight Charts | 사용자 지정 |
| 상태 관리 | TanStack Query + Zustand | 서버 상태 + 로컬 상태 |
| 인증 | Supabase Auth | 이메일 + 구글 OAuth |
| DB | Supabase Postgres | 무료 티어 (500MB) |
| 실시간 | Supabase Realtime | WebSocket |
| Edge Functions | (사용 안 함) | 워커가 대신 |
| 시세 워커 | Python 3.12 | yfinance, PyKRX |
| 워커 호스팅 | Railway | $5/월 무료 크레딧 |
| 스케줄링 | APScheduler (워커 내장) | cron 표현식 |
| 푸시 | Web Push API + VAPID | 자체 발송 |
| 에러 트래킹 | Sentry 무료 티어 | 옵션 |

---

## 4. 데이터 모델

### 4.1 핵심 개념: "포트폴리오"

각 사용자는 여러 포트폴리오를 가질 수 있다.
- **글로벌 포트폴리오** (1개) — 영구, 글로벌 리더보드용
- **방 포트폴리오** (방마다 1개) — 방 시작 시 생성, 종료 시 잠김

거래·잔고·주문은 모두 `portfolio_id`로 묶인다.

### 4.2 스키마

```sql
-- 사용자 프로필 (auth.users 보강)
profiles
  id UUID PRIMARY KEY REFERENCES auth.users(id)
  display_name TEXT NOT NULL
  avatar_url TEXT
  created_at TIMESTAMPTZ

-- 경쟁 단위
portfolios
  id UUID PRIMARY KEY
  user_id UUID NOT NULL REFERENCES profiles(id)
  room_id UUID REFERENCES rooms(id)  -- NULL = 글로벌
  starting_krw NUMERIC NOT NULL
  starting_usd NUMERIC NOT NULL
  fx_rate_at_start NUMERIC NOT NULL  -- 가입 시점 USD→KRW 환율 (수익률 기준점)
  krw_balance NUMERIC NOT NULL
  usd_balance NUMERIC NOT NULL
  status TEXT NOT NULL  -- 'active' | 'ended'
  started_at TIMESTAMPTZ NOT NULL
  ended_at TIMESTAMPTZ
  -- room_id가 NULL(글로벌)인 경우와 NOT NULL(방)인 경우를 모두 사용자별 1개로 제약:
  --   CREATE UNIQUE INDEX portfolios_user_global_uniq
  --     ON portfolios(user_id) WHERE room_id IS NULL;
  --   CREATE UNIQUE INDEX portfolios_user_room_uniq
  --     ON portfolios(user_id, room_id) WHERE room_id IS NOT NULL;

-- 종목 마스터 캐시
stocks
  symbol TEXT PRIMARY KEY  -- 005930.KS, AAPL
  market TEXT NOT NULL     -- 'KRX_KS' | 'KRX_KQ' | 'NASDAQ' | 'NYSE'
  currency TEXT NOT NULL   -- 'KRW' | 'USD'
  name TEXT NOT NULL
  name_ko TEXT             -- 한국어명 (US 종목은 NULL 허용)
  sector TEXT
  market_cap NUMERIC
  per NUMERIC
  last_price NUMERIC
  last_price_at TIMESTAMPTZ
  fifty_two_week_high NUMERIC
  fifty_two_week_low NUMERIC
  is_active BOOLEAN DEFAULT TRUE  -- 상폐 여부
  updated_at TIMESTAMPTZ

-- 차트용 OHLCV
stock_bars
  symbol TEXT REFERENCES stocks(symbol)
  interval TEXT  -- '15m' | '1h' | '1d'
  ts TIMESTAMPTZ
  open NUMERIC, high NUMERIC, low NUMERIC, close NUMERIC, volume BIGINT
  PRIMARY KEY (symbol, interval, ts)

-- 보유 종목
holdings
  portfolio_id UUID REFERENCES portfolios(id)
  symbol TEXT REFERENCES stocks(symbol)
  quantity NUMERIC NOT NULL
  avg_cost NUMERIC NOT NULL  -- 체결 통화 기준
  updated_at TIMESTAMPTZ
  PRIMARY KEY (portfolio_id, symbol)

-- 주문
orders
  id UUID PRIMARY KEY
  portfolio_id UUID REFERENCES portfolios(id)
  symbol TEXT REFERENCES stocks(symbol)
  side TEXT NOT NULL  -- 'buy' | 'sell'
  order_type TEXT NOT NULL  -- 'market' | 'limit'
  quantity NUMERIC NOT NULL
  limit_price NUMERIC  -- order_type='limit'에서만
  status TEXT NOT NULL  -- 'pending' | 'filled' | 'cancelled' | 'rejected' | 'expired'
  filled_quantity NUMERIC DEFAULT 0
  filled_avg_price NUMERIC
  fee_total NUMERIC DEFAULT 0
  expires_at TIMESTAMPTZ  -- 지정가 GTC: created_at + 30일
  created_at TIMESTAMPTZ
  filled_at TIMESTAMPTZ
  cancelled_at TIMESTAMPTZ
  rejection_reason TEXT

-- 체결 기록
trades
  id UUID PRIMARY KEY
  order_id UUID REFERENCES orders(id)
  portfolio_id UUID REFERENCES portfolios(id)
  symbol TEXT REFERENCES stocks(symbol)
  side TEXT NOT NULL
  quantity NUMERIC NOT NULL
  price NUMERIC NOT NULL
  currency TEXT NOT NULL
  fee NUMERIC NOT NULL
  executed_at TIMESTAMPTZ NOT NULL

-- 환율
fx_rates
  ts TIMESTAMPTZ
  base TEXT  -- 'USD'
  quote TEXT  -- 'KRW'
  rate NUMERIC
  PRIMARY KEY (base, quote, ts)

-- 환전 내역
fx_transactions
  id UUID PRIMARY KEY
  portfolio_id UUID REFERENCES portfolios(id)
  from_currency TEXT NOT NULL
  to_currency TEXT NOT NULL
  from_amount NUMERIC NOT NULL
  to_amount NUMERIC NOT NULL
  rate NUMERIC NOT NULL
  fee_pct NUMERIC NOT NULL  -- 시뮬 0.5%
  executed_at TIMESTAMPTZ NOT NULL

-- 친구방
rooms
  id UUID PRIMARY KEY
  host_id UUID REFERENCES profiles(id)
  name TEXT NOT NULL
  invite_code TEXT NOT NULL UNIQUE
  starting_krw NUMERIC NOT NULL
  starting_usd NUMERIC NOT NULL
  starts_at TIMESTAMPTZ NOT NULL
  ends_at TIMESTAMPTZ  -- NULL = 무제한
  late_join_until TIMESTAMPTZ  -- NULL = 무기한 가입 허용
  max_members INT DEFAULT 10
  status TEXT NOT NULL  -- 'open' | 'active' | 'ended'
  created_at TIMESTAMPTZ

-- 방 멤버
room_members
  room_id UUID REFERENCES rooms(id)
  user_id UUID REFERENCES profiles(id)
  portfolio_id UUID REFERENCES portfolios(id) UNIQUE
  joined_at TIMESTAMPTZ
  PRIMARY KEY (room_id, user_id)

-- 리더보드 시계열
portfolio_snapshots
  portfolio_id UUID REFERENCES portfolios(id)
  ts TIMESTAMPTZ
  total_value_krw NUMERIC NOT NULL
  return_pct NUMERIC NOT NULL
  PRIMARY KEY (portfolio_id, ts)

-- 관심 종목
watchlists
  portfolio_id UUID REFERENCES portfolios(id)
  symbol TEXT REFERENCES stocks(symbol)
  added_at TIMESTAMPTZ
  PRIMARY KEY (portfolio_id, symbol)

-- 배당 이벤트
dividend_events
  id UUID PRIMARY KEY
  symbol TEXT REFERENCES stocks(symbol)
  ex_date DATE NOT NULL
  payable_date DATE
  amount_per_share NUMERIC NOT NULL
  currency TEXT NOT NULL
  applied BOOLEAN DEFAULT FALSE
  UNIQUE (symbol, ex_date)

-- 배당 입금 내역 (사용자별)
dividend_payouts
  id UUID PRIMARY KEY
  portfolio_id UUID REFERENCES portfolios(id)
  symbol TEXT REFERENCES stocks(symbol)
  ex_date DATE NOT NULL
  qty NUMERIC NOT NULL
  gross NUMERIC NOT NULL  -- 세전
  tax NUMERIC NOT NULL    -- 원천징수
  net NUMERIC NOT NULL    -- 실수령
  currency TEXT NOT NULL
  executed_at TIMESTAMPTZ

-- 코퍼릿 액션 (분할/병합)
corporate_actions
  id UUID PRIMARY KEY
  symbol TEXT REFERENCES stocks(symbol)
  action_type TEXT NOT NULL  -- 'split' | 'reverse_split'
  ratio NUMERIC NOT NULL     -- 2:1 분할 → 2.0
  ex_date DATE NOT NULL
  applied BOOLEAN DEFAULT FALSE
  UNIQUE (symbol, ex_date, action_type)

-- Web Push 구독
push_subscriptions
  id UUID PRIMARY KEY
  user_id UUID REFERENCES profiles(id)
  endpoint TEXT NOT NULL
  p256dh TEXT NOT NULL
  auth TEXT NOT NULL
  user_agent TEXT
  created_at TIMESTAMPTZ
  UNIQUE (user_id, endpoint)

-- 알림 환경설정
notification_settings
  user_id UUID PRIMARY KEY REFERENCES profiles(id)
  order_filled BOOLEAN DEFAULT TRUE
  order_expiring_soon BOOLEAN DEFAULT TRUE
  room_starting BOOLEAN DEFAULT TRUE
  room_ending BOOLEAN DEFAULT TRUE
  dividend_received BOOLEAN DEFAULT TRUE
  corporate_action_applied BOOLEAN DEFAULT TRUE

-- 종목 추천 캐시
recommendations
  id UUID PRIMARY KEY
  category TEXT NOT NULL  -- 'top_gainers' | 'top_losers' | 'volume_surge' |
                          -- 'near_52w_high' | 'low_per_value'
  market_scope TEXT NOT NULL  -- 'KR' | 'US' | 'ALL'
  symbol TEXT REFERENCES stocks(symbol)
  rank INT NOT NULL
  score NUMERIC NOT NULL
  reason TEXT
  computed_at TIMESTAMPTZ NOT NULL
```

### 4.3 Row-Level Security (RLS) 정책

| 테이블 | SELECT | INSERT/UPDATE/DELETE |
|--------|--------|----------------------|
| profiles | 누구나 | 본인 |
| portfolios | 본인 + 같은 방 멤버 | 서버(service_role) |
| holdings | 본인 + 같은 방 멤버 | 서버 |
| orders | 본인 | 본인 (검증 거쳐 INSERT, 본인 cancel) |
| trades | 본인 + 같은 방 멤버(수량 요약만) | 서버 |
| fx_transactions | 본인 | 서버 |
| rooms | 멤버 | 호스트 |
| room_members | 같은 방 멤버 | 본인 (가입), 호스트 (제거) |
| stocks / stock_bars / fx_rates | 누구나 | 워커 (service_role) |
| portfolio_snapshots | 본인 + 같은 방 멤버 | 워커 |
| watchlists | 본인 | 본인 |
| dividend_events / corporate_actions | 누구나 | 워커 |
| dividend_payouts | 본인 | 워커 |
| push_subscriptions / notification_settings | 본인 | 본인 |
| recommendations | 누구나 | 워커 |

→ **방 멤버끼리는 서로의 보유종목/총자산을 볼 수 있고**, 주문 내역/환전 내역은 비공개.

### 4.4 시뮬 수수료

| 시장/사이드 | 수수료 |
|------------|--------|
| KR 매수 | 0.015% |
| KR 매도 | 0.215% (수수료 + 거래세) |
| US 매수 | 0.05% |
| US 매도 | 0.05% |
| 환전 (양방향) | 0.5% |

→ 데이트레이딩이 마냥 유리하지 않게 유지하여 친구 간 경쟁의 공정성 보장.

---

## 5. 거래 & 환전 플로우

### 5.1 시장가 주문

```
[사용자] 매수 100주 클릭
  ↓
[프론트] POST /api/orders { symbol, side, qty, type:'market', portfolio_id }
  ↓
[Next.js API]
  1. Supabase Auth로 인증 확인
  2. 해당 종목의 market 기준 장 운영 시간 확인
     → 닫혀있으면 422 "장 마감"
  3. stocks.last_price SELECT (트랜잭션 시작)
     - last_price_at이 30분 이상 stale → 워커에 동기 fetch 요청 (HTTP RPC, 5초 timeout)
     - 실패 시 503 반환
  4. 통화 매칭 검증 (KR 종목 = krw_balance 참조)
  5. 매수: krw_balance >= qty × price × (1 + buy_fee_rate)
     매도: holdings.quantity >= qty
     → 미달 시 거부
  6. 트랜잭션 (SELECT FOR UPDATE로 잔고/보유 잠금):
       - INSERT orders (status='filled', filled_quantity=qty, filled_avg_price=price)
       - INSERT trades
       - UPSERT holdings (avg_cost는 가중평균)
       - UPDATE portfolios.{krw|usd}_balance
  7. 200 OK + 체결 정보 반환
  ↓
[프론트] Realtime 채널이 holdings/portfolios 변경을 푸시 → UI 자동 갱신
```

### 5.2 지정가 주문 (24/7 접수)

```
[사용자] 매수 100주 @ ₩70,000 제출
  ↓
[Next.js API]
  1. 인증 + 통화 매칭 확인
  2. 잔고 즉시 차감 (예약 처리)
       - krw_balance -= qty × limit_price × (1 + buy_fee_rate)
       - 실잔고가 음수가 되면 거부
  3. INSERT orders (status='pending', expires_at=now+30d)
  4. 200 OK
  ↓
[Python Worker, 1분 주기] 매칭 엔진
  - SELECT * FROM orders WHERE status='pending'
  - 각 주문:
      current_price = stocks.last_price (캐시)
      가격 stale 정책: stocks.last_price_at이 30분 이상 stale인 종목은 매칭 스킵
                       (다음 사이클에 가격 갱신되면 자동 재시도)
      매수: current_price <= limit_price → 체결
      매도: current_price >= limit_price → 체결
  - 체결 트랜잭션 (SELECT FOR UPDATE):
      - UPDATE orders (status='filled', filled_avg_price=limit_price)
      - INSERT trades
      - UPSERT holdings
      - UPDATE portfolios — 잔고는 주문 제출 시 limit_price+max_fee로 차감되어 있으므로
                            추가 차감 없음. 단, 분할/병합으로 limit_price가 조정된 케이스
                            (§9.2 참고)에선 차감액과 실제 체결액의 차이를 환원
  - expires_at < now → status='expired', 차감했던 잔고 환원
```

#### 5.2.1 잔고 예약 모델

지정가 주문 제출 시 **즉시 잔고에서 차감**하는 모델을 사용한다.
- 별도의 `reserved_balance` 필드 없이 단순 차감
- 주문 취소/만료 시 환원
- 체결 시 차감된 금액과 실제 체결가 차이를 보정 (수수료 절약 등)

장점: 구현 단순, 동시성 단순. 단점: 잔고 표시가 "예약 잔고 포함" 개념이 없어 사용자가 헷갈릴 수 있음 → UI에서 "활성 주문 N건"을 명시.

### 5.3 환전 플로우

```
[사용자] KRW → USD, ₩1,000,000 환전
  ↓
[Next.js API]
  1. fx_rates에서 최신 USD/KRW 환율 조회
  2. 스프레드 0.5% 적용:
     - KRW→USD: usd_amount = krw / rate / 1.005
     - USD→KRW: krw_amount = usd × rate × 0.995
  3. 잔고 확인
  4. 트랜잭션:
     - UPDATE portfolios.krw_balance, usd_balance
     - INSERT fx_transactions
  5. 200 OK
```

### 5.4 주문 취소

- 펜딩 지정가 주문만 취소 가능 (시장가는 즉시 체결됨)
- API: `DELETE /api/orders/:id`
- 트랜잭션: orders.status='cancelled', 잔고 환원

### 5.5 검증 규칙 (서버측)

| 항목 | 규칙 |
|------|------|
| 최소 주문 수량 | 1주 (소수점 거래 미지원, v1) |
| 통화 매칭 | KR 종목 = KRW 잔고로만, US = USD 잔고로만 |
| 잔고 부족 | 즉시 거부, 한국어 메시지 |
| 보유 부족 매도 | 거부 (공매도 미지원) |
| 장 마감 시 시장가 | 거부 |
| 같은 종목 중복 펜딩 | 허용 |

### 5.6 가격 신선도 처리

- 워커가 1분마다 **보유 + 펜딩 주문 + 관심종목** 합집합 종목들의 가격 갱신
- 시장가 체결 시 last_price_at이 30분 이상 stale → 워커에 동기 fetch 요청 (5초 timeout)
- 30분 이상 stale + 워커 응답 실패 → 503 반환, 사용자에게 재시도 안내

---

## 6. 가격 피드 & 시장 시간

### 6.1 데이터 소스

| 데이터 | 1차 소스 | 2차 |
|--------|---------|-----|
| KR 시세 (15분 지연) | PyKRX | yfinance (`005930.KS`) |
| US 시세 (15분 지연) | yfinance | Twelve Data 무료티어 |
| KR 종목 마스터 | PyKRX `get_market_ticker_list` | — |
| US 종목 마스터 | NASDAQ Trader / NYSE 공식 | — |
| OHLCV (15m/1h/1d) | yfinance / PyKRX | — |
| 환율 USD/KRW | exchangerate.host | yfinance `KRW=X` |
| 펀더멘털 (PER, 시총) | yfinance `Ticker.info` | — |
| 뉴스 | yfinance `Ticker.news` | NewsAPI 무료티어 |
| 재무제표 | yfinance `Ticker.financials` | — |
| 배당 데이터 | yfinance `Ticker.dividends`, PyKRX | — |
| 분할/병합 데이터 | yfinance `Ticker.splits` | — |

→ 외부 API 키 발급이 거의 필요 없음.

### 6.2 워커 스케줄러 (APScheduler)

```python
# 시장 시간 내에서만 (장중 판정은 sites/regions별로)
@every(60s) during_kr_or_us_market_hours:
    fetch_prices(active_symbols)  # 보유∪펜딩∪관심 합집합

@every(60s):
    matching_engine.run()

@every(5min):
    portfolio_snapshot.record_all()

@every(30min):
    fetch_fx_rate('USD', 'KRW')

@every(1h):
    compute_recommendations()

@every(1day, 06:00 KST):
    expire_old_orders()
    refresh_stock_master()

@every(1day, 16:00 KST):  # KR 마감 후
    fetch_daily_bars(KR_symbols)
    process_kr_dividends_and_splits()

@every(1day, 07:00 KST):  # US 마감 후 안전 마진 (DST 05:00, 표준시 06:00 마감 + 1h)
    fetch_daily_bars(US_symbols)
    process_us_dividends_and_splits()
```

### 6.3 시장 시간 정의

| 시장 | 운영 시간 (현지) | 한국 시간 환산 |
|------|------------------|---------------|
| KRX | 평일 09:00–15:30 KST | 09:00–15:30 KST |
| NASDAQ/NYSE (DST) | 평일 09:30–16:00 ET | 22:30–05:00 KST 다음날 |
| NASDAQ/NYSE (표준시) | 평일 09:30–16:00 ET | 23:30–06:00 KST 다음날 |

휴장일:
- KRX: PyKRX `get_open_days()` 연 단위 캐시
- NYSE: `pandas_market_calendars` 라이브러리

### 6.4 종목 검색 & 동적 추가

```
부팅 시: 시가총액 상위 KR 50 + US 50 = 100개 prefetch (마스터 + 가격)

사용자 검색 입력:
  1. stocks 테이블 부분일치 검색 (즉시 응답)
  2. 0건 또는 사용자가 "더 찾기" 클릭 시:
     → 워커에 ad-hoc lookup RPC
     → yfinance/PyKRX로 심볼 검증 + 마스터 fetch + INSERT INTO stocks
  3. 첫 거래 발생한 종목은 자동으로 1분 갱신 풀에 포함
```

### 6.5 차트 데이터

| 인터벌 | 보존 기간 | 갱신 |
|--------|-----------|------|
| 15분봉 | 60일 | 매일 장 마감 후 백필 |
| 1시간봉 | 2년 | 매일 |
| 일봉 | 10년+ | 매일 |

분봉(1m)은 사용 안 함 (15분 지연이라 의미 없음).

### 6.6 외부 API 장애 대응

- yfinance/PyKRX 호출 실패 시:
  - 3회 지수 백오프 재시도 (1s → 2s → 4s)
  - 최종 실패 시 stocks.last_price 갱신 안 함 (기존 가격 유지)
  - last_price_at 30분 이상 stale인 종목은 시장가 주문 거부

---

## 7. 리더보드 & 방 시스템

### 7.1 총자산 계산

```
total_value_krw =
    krw_balance
  + usd_balance × current_fx(USD→KRW)
  + Σ(KR 보유: quantity × stocks.last_price)
  + Σ(US 보유: quantity × stocks.last_price × current_fx(USD→KRW))

starting_krw_equivalent =
    starting_krw + starting_usd × fx_rate_at_portfolio_start

-- fx_rate_at_portfolio_start 정의:
--   글로벌 포트폴리오: starting_usd=0이므로 무관
--   방 포트폴리오: 해당 멤버의 joined_at 시점 환율 (가입 시 portfolios 행에 함께 스냅샷 저장)
--                 → 같은 방이라도 멤버마다 가입 시점이 달라 시작 환산값이 다를 수 있음
--                 → 모든 멤버가 동일 starts_at 기준이면 더 공정하지만, 후발 가입자가
--                   환율 변동을 그대로 떠안게 됨. joined_at 기준이 게임 공정성에 더 적합.

return_pct = (total_value_krw - starting_krw_equivalent) / starting_krw_equivalent × 100
```

### 7.2 스냅샷 전략

- 워커가 5분마다 모든 활성 포트폴리오의 `total_value_krw`, `return_pct` 계산 → `portfolio_snapshots` INSERT
- 보존 기간:
  - 모든 활성 포트폴리오: 5분 간격 raw 데이터는 90일까지 보존
  - 90일 초과분: 일별 종가 1포인트로 다운샘플 (워커가 일별 압축 작업)
  - 종료된 방 포트폴리오: 종료 후 90일까지 raw 유지, 이후 일별 다운샘플
  - 무제한 방(`ends_at = NULL`)도 동일하게 90일 raw + 이후 일별로 압축

### 7.3 글로벌 리더보드

- 모든 사용자의 글로벌 포트폴리오 한 표
- 정렬: 누적 수익률 % 내림차순
- 기간 필터: 전체 / 30일 / 7일 / 24시간 (스냅샷 차분으로 계산)
- 페이지네이션: 상위 100명 + 본인 위치 표시
- 갱신: 5분마다 (스냅샷 주기와 동일)
- **머터리얼라이즈드 뷰** `leaderboard_global_cache` 사용 (워커가 5분마다 REFRESH)

### 7.4 방 리더보드

- 방 멤버만 표시 (RLS)
- 방 멤버끼리 보유 종목 Top 5 노출 (수량/평단/평가금)
- 종료일 도달 시 → status='ended', 거래 잠김, 펜딩 주문 자동 취소 후 환원
- 갱신: 매 요청 시 즉시 계산 (멤버 수 적어 부담 없음)

### 7.5 방 라이프사이클

```
[open] 호스트 생성 → 멤버 가입 가능 → starts_at까지 거래 X
   ↓ starts_at 도달 (워커가 자동 전이)
[active] 거래 가능, 리더보드 표시
   ↓ ends_at 도달 또는 호스트 수동 종료
[ended] 거래 잠금, 펜딩 주문 자동 취소, 최종 결과 화면, 90일간 조회 가능
```

### 7.6 방 제약

| 항목 | 값 |
|------|-----|
| 호스트 최대 활성 방 수 | 5개 |
| 사용자가 동시 가입 가능 방 수 | 10개 |
| 방 최대 멤버 수 | 50명 (호스트 설정) |
| 방 최소 기간 | 1일 |
| 방 최대 기간 | 호스트 자유, 무제한 허용 (`ends_at = NULL`) |
| 시작자금 KRW | 호스트 자유 (≥0) |
| 시작자금 USD | 호스트 자유 (≥0) |
| 시작 후 가입 허용 | 호스트 토글, `late_join_until` (NULL = 무기한) |

### 7.7 멤버끼리 공개 정보

| 정보 | 공개 |
|------|------|
| 닉네임, 아바타 | ✅ |
| 총자산 KRW | ✅ |
| 누적 수익률 % | ✅ |
| 보유 Top 5 (수량/평단/평가금) | ✅ |
| 전체 보유 목록 | ✅ |
| 주문 내역 | ❌ |
| 환전 내역 | ❌ |

---

## 8. 프론트엔드 페이지 & PWA

### 8.1 라우팅 (Next.js App Router)

```
/                       랜딩 (로그아웃)
/auth/login             이메일/구글 로그인
/auth/callback          OAuth 콜백

/app/                   ★ 인증 후 앱 셸 (PWA)
  ├── dashboard         포트폴리오 요약, 추천, 빠른 액세스
  ├── trade
  │   ├── search        검색 입력 → 결과 리스트
  │   └── [symbol]      종목 상세 (캔들+지표+뉴스+재무+매수/매도 시트)
  ├── portfolio
  │   ├── overview      현재 보유, 평가금, 자산 분포
  │   ├── orders        펜딩/체결/취소/만료 주문 이력
  │   └── transactions  환전/배당 내역
  ├── leaderboard
  │   ├── global        글로벌 (기간 필터)
  │   └── rooms/[id]    방 리더보드 + 멤버 보유 Top 5
  ├── rooms
  │   ├── index         내가 호스트/멤버인 방 목록
  │   ├── new           방 생성
  │   └── join          초대 코드 입력
  ├── watchlist         관심 종목 + 가격 위젯
  └── settings          닉네임, 아바타, 알림 설정, 로그아웃
```

### 8.2 포트폴리오 스위처

- 앱 셸 상단 드롭다운: 글로벌 ↔ 방 1 ↔ 방 2 ...
- 선택된 portfolio_id가 거래/주문/포트폴리오 페이지 컨텍스트
- 종목 상세 매수/매도는 항상 현재 컨텍스트 포트폴리오에 적용

### 8.3 모바일 PWA

- 하단 탭 바: 홈 / 거래 / 포폴 / 순위 / 설정 (5개)
- 종목 상세: 차트가 메인, 매수/매도는 BottomSheet (슬라이드업)
- iPhone Safari "홈 화면에 추가" 시 전체화면 + 자체 아이콘
- `manifest.json` + `apple-touch-icon` 설정
- 다크모드 기본

### 8.4 실시간 채널

| 채널 | 용도 |
|------|------|
| `portfolios:{portfolio_id}` | 잔고 변경 |
| `holdings:{portfolio_id}` | 보유 변경 |
| `orders:{portfolio_id}` | 주문 상태 변경 |
| `stocks:[viewing_symbol]` | 가격 변경 |
| `portfolio_snapshots:{portfolio_id}` | 5분 단위 평가금 |

페이지 떠나면 unsubscribe.

### 8.5 Web Push 알림

- 서비스 워커 (`/sw.js`) 등록
- VAPID 키 환경변수
- 트리거:
  - 지정가 주문 체결
  - 펜딩 주문 만료 24시간 전
  - 방 시작 / 종료 24시간 전
  - 배당 입금
  - 분할/병합 적용
- 사용자 설정에서 알림 종류별 토글
- iOS Safari 16.4+ 지원 (PWA 홈 화면 추가 시)

---

## 9. 추가 v1 기능 상세

### 9.1 배당 시뮬

```
[워커, 일별]
  for symbol in stocks where active:
    upcoming = yfinance/PyKRX로 다음 ex-date + amount 조회
    UPSERT dividend_events (symbol, ex_date, amount, currency)

[워커, ex_date 도달 시]
  for evt in dividend_events where ex_date <= today and not applied:
    holders = SELECT portfolio_id, quantity FROM holdings WHERE symbol = evt.symbol
    트랜잭션:
      for h in holders:
        gross = h.quantity × evt.amount_per_share
        tax = gross × tax_rate(evt.currency)  -- KR 15.4%, US 15%
        net = gross - tax
        INSERT dividend_payouts (portfolio_id, symbol, ex_date, qty, gross, tax, net, currency)
        UPDATE portfolios.{krw|usd}_balance += net
      UPDATE dividend_events SET applied=true
    Web Push 발송
```

### 9.2 분할/병합 자동 처리

```
[워커, 일별]
  for symbol in stocks where active:
    splits = yfinance/PyKRX `Ticker.splits` 폴링
    UPSERT corporate_actions (symbol, action_type, ratio, ex_date)

[워커, ex_date 도달 시]
  for ca in corporate_actions where ex_date <= today and not applied:
    holders = SELECT portfolio_id, quantity, avg_cost FROM holdings WHERE symbol = ca.symbol
    트랜잭션:
      for h in holders:
        new_qty = floor(h.quantity × ca.ratio)         -- 정수 강제 (소수점 거래 미지원)
        leftover_value = h.quantity × ca.ratio × current_price - new_qty × current_price
        UPDATE holdings SET quantity=new_qty, avg_cost = h.quantity × h.avg_cost / new_qty
        UPDATE portfolios.{krw|usd}_balance += leftover_value  -- 단수주는 현금 환원
      모든 펜딩 주문 비례 조정:
        new_quantity = floor(o.quantity × ca.ratio)
        new_limit_price = o.limit_price / ca.ratio
        if new_quantity == 0 → 주문 취소 + 차감 잔고 환원
        else → UPDATE orders, 잔고 차감 차이는 보정
      UPDATE corporate_actions SET applied=true
    Web Push 발송
```

### 9.3 Web Push 알림

#### 등록 흐름
```
[사용자] settings에서 "푸시 알림 켜기" 클릭
  → Notification.requestPermission()
  → ServiceWorkerRegistration.pushManager.subscribe({ vapidPublicKey })
  → POST /api/push/subscribe { endpoint, p256dh, auth }
  → INSERT push_subscriptions
```

#### 발송 흐름
```
[워커] 트리거 발생 (지정가 체결, 배당, 분할 등)
  → notification_settings 확인
  → 해당 user의 push_subscriptions 조회
  → web-push 라이브러리로 각 endpoint에 발송
  → 410 Gone 응답 시 해당 구독 삭제
```

### 9.4 종목 자동 추천 (룰 기반)

```
[워커, 시간별]
  recommendations TRUNCATE (또는 카테고리별 DELETE)
  
  카테고리별 SQL 계산:
    top_gainers (KR/US):
      SELECT symbol, (today_close - prev_close) / prev_close AS change_pct
      FROM stock_bars (interval='1d')
      ORDER BY change_pct DESC LIMIT 10
    
    top_losers: (역순)
    
    volume_surge:
      WHERE today_volume / avg_5d_volume >= 3.0
      ORDER BY ratio DESC LIMIT 10
    
    near_52w_high:
      WHERE last_price / fifty_two_week_high >= 0.95
      ORDER BY market_cap DESC LIMIT 10
    
    low_per_value (KR only, market_cap top 200 중):
      WHERE per > 0
      ORDER BY per ASC LIMIT 10
  
  INSERT INTO recommendations
```

UI: dashboard와 trade/search 페이지에 카테고리별 가로 스크롤 카드 5개씩 노출.

---

## 10. 에러 처리 & 보안

### 10.1 에러 처리 정책

| 에러 종류 | 처리 |
|-----------|------|
| 네트워크 실패 | TanStack Query 자동 재시도 |
| 401 Unauthorized | 자동 로그인 페이지 리다이렉트 |
| 422 검증 실패 | 폼에 한국어 메시지 표시 |
| 503 가격 stale | 토스트 + 재시도 버튼 |
| 워커 다운 | 사용자에 보이지 않음. 매칭 지연. 복구 시 백로그 매칭 |
| Supabase 다운 | Vercel 정적 fallback 페이지 |
| 동시성 (잔고 차감) | Postgres 트랜잭션 + SELECT FOR UPDATE |

### 10.2 보안 설계

- **1차 방어선**: Supabase RLS (모든 테이블에 정책)
- **2차 방어선**: Next.js API Route 비즈니스 검증
- **3차 방어선**: 워커는 service_role 키 사용, 환경변수만 보관, 클라이언트 노출 금지
- Supabase Auth JWT를 Realtime 채널 인증에도 활용
- API rate limit: Vercel 기본 + Next.js 미들웨어로 ip별 제한 (예: 분당 60건)

---

## 11. 테스트 전략

| 레이어 | 도구 | 커버 |
|--------|------|------|
| 단위 (서버) | Vitest | 잔고 계산, FX 환산, 평단가, 수수료, 검증 로직 |
| 단위 (워커) | pytest | 매칭 엔진, 가격 fetch 모킹, 휴장일 판정, 배당/분할 적용 |
| 통합 (DB) | pytest + Supabase 로컬 + 테스트 DB | RLS 정책, 트랜잭션 동시성, 주문 플로우 |
| E2E | Playwright | 회원가입 → 환전 → 매수 → 매도 → 리더보드 |
| 시각 회귀 | Storybook + Chromatic | 종목 상세, 포트폴리오 페이지 |

→ TDD 권장 영역: 매칭 엔진, 잔고 트랜잭션, FX 환산, 배당/분할 적용 (돈 다루는 코드).

---

## 12. 관측성 & 배포

### 12.1 로깅 / 모니터링

- Next.js: Vercel 빌트인 + Sentry 무료티어
- 워커: stdout + Railway 로그 뷰어
- DB: Supabase Logs 패널

### 12.2 배포

| 컴포넌트 | 호스팅 | 트리거 |
|----------|--------|--------|
| Next.js | Vercel | GitHub `main` 푸시 → 자동 |
| Python 워커 | Railway | GitHub `main` 푸시 → 자동 |
| Supabase 스키마 | Supabase 클라우드 | `supabase db push` 수동 |

### 12.3 환경 분리

- 로컬: Supabase 로컬 (Docker), 워커 로컬 실행
- 프로덕션: Vercel + Railway + Supabase Cloud
- 스테이징은 v1에서 생략 (1인 개발이므로)

---

## 13. v1.5 / v2 / v3 로드맵 (비목표)

### v1.5 (v1 다 끝낸 직후)

| Plan | 내용 |
|------|------|
| **Plan #8: Design Polish** | shadcn 기본 스타일 → 커스텀 디자인 시스템. 브랜딩, 타이포그래피, 색상 팔레트, 마이크로인터랙션. `redesign-skill` 또는 `frontend-design` 스킬 활용 |
| Plan #4.5 (선택) | 인트라데이 봉, RSI/MACD/볼린저, 뉴스, 재무제표, 포트폴리오 overview |

### v2 (다음 마일스톤)

| 기능 | 우선순위 | 비고 |
|------|----------|------|
| 친구 채팅 | 🟢 빠름 | 방별 실시간 텍스트, ~3일 |
| 공매도/마진 | 🟡 중 | 잔고 모델 확장 필요 |
| 옵션 거래 | 🔴 큼 | 별도 모듈 |
| 선물 거래 | 🔴 큼 | 옵션 다음 |
| 모바일 네이티브 앱 | 🔴 큼 | iOS 우선 (React Native 또는 Swift) |

### v3 또는 보류

- LLM 기반 AI 인사이트

---

## 14. 열려있는 질문 (Open Questions)

1. 글로벌 포트폴리오 시작 시점: 사용자 가입 시 자동 생성? 첫 로그인 시?
   - **잠정**: 가입 시 즉시 1억 KRW로 자동 생성
2. 방 호스트가 자기 방에서 나갈 수 있는가?
   - **잠정**: 호스트는 방을 종료하거나, 다른 멤버에게 호스트 양도 후 탈퇴 가능
3. 종목 상폐 시 보유자 처리?
   - **잠정**: 마지막 거래가로 자동 매도 → 현금화. 사용자에 알림.
4. 환전 1회 최소 금액?
   - **잠정**: 없음 (소액 환전 허용). 단, fee 0.5%로 소액 환전은 손해.
5. 무제한 방의 리더보드 시계열은 무한히 누적?
   - **잠정**: 90일 이상은 일별 다운샘플로 압축.
6. iOS Web Push: PWA 홈 화면 추가 안 한 사용자에는 미지원. 안내?
   - **잠정**: 설정 페이지에서 "푸시 사용하려면 홈 화면에 추가하세요" 안내 배너.

---

## 부록 A — 환경변수

### Next.js (Vercel)
```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY        (Server-side only)
NEXT_PUBLIC_VAPID_PUBLIC_KEY
WORKER_RPC_URL                    (워커 동기 fetch RPC)
WORKER_RPC_SECRET
SENTRY_DSN
```

### Python Worker (Railway)
```
SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
VAPID_PUBLIC_KEY
VAPID_PRIVATE_KEY
VAPID_SUBJECT                     (mailto:rms6654@gmail.com)
WORKER_RPC_SECRET
```

---

## 부록 B — 무료 티어 한도 추정

| 서비스 | 한도 | 친구 10명 운영 시 |
|--------|------|-------------------|
| Vercel Hobby | 100GB 대역, 100 build hr | 충분 |
| Supabase Free | 500MB DB, 5GB 대역, 50K MAU | 충분 |
| Railway Free | $5/월 크레딧 | 워커 1개 충분 |
| yfinance | 무공식, rate limit 관대 | 분당 100req 이내면 OK |
| PyKRX | 무료, KRX 직접 조회 | 충분 |
| exchangerate.host | 무료 무인증 | 30분마다 호출이면 충분 |

→ 친구 ~50명 규모까지 무료 가능 추정. 그 이상 시 Supabase Pro($25/월)로 업그레이드.
