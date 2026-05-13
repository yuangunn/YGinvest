# YGinvest

모의 주식 트레이딩 PWA — 한국·미국 거래소, KRW/USD 분리 계좌, 글로벌 + 친구방 리더보드.

[설계 문서](./docs/superpowers/specs/2026-05-10-mock-stock-trading-app-design.md) ·
[Plan #1 (Foundation)](./docs/superpowers/plans/2026-05-10-foundation.md)

## 디렉토리

- `apps/web` — Next.js 프론트엔드 (배포: Vercel)
- `apps/worker` — Python 시세/매칭 워커 (배포: Railway)
- `supabase/` — DB 마이그레이션 + 로컬 설정
- `docs/superpowers/` — spec & plan 문서

## 사전 요구사항

- Node.js 20+
- Python 3.12+
- Docker Desktop (Supabase 로컬용)
- Supabase CLI (`winget install Supabase.CLI` 또는 [GitHub releases](https://github.com/supabase/cli/releases))
- uv (`pip install uv` 또는 `winget install astral-sh.uv`)

## 로컬 개발

```bash
# 1. DB 시작 (첫 실행은 Docker 이미지 풀링 ~5분)
supabase start
# 출력된 Project URL, Publishable, Secret 키를 메모

# 2. 환경변수 설정
cp apps/web/.env.local.example apps/web/.env.local
cp apps/worker/.env.example apps/worker/.env
# 두 파일에 위 키 채우기

# 3. 웹 (별도 터미널)
cd apps/web && npm install && npm run dev
# http://localhost:3000

# 4. 워커 (별도 터미널)
cd apps/worker && uv sync && PYTHONPATH=src uv run python -m ygworker.main

# 5. 테스트
cd apps/web && npm run test:e2e          # Playwright 2 tests
cd apps/worker && uv run pytest          # heartbeat unit + signup_trigger 통합
```

## 배포 (Plan #1 범위 외, 다음 세션)

| 컴포넌트 | 호스팅 | 환경변수 |
|---------|--------|---------|
| 웹 | Vercel (root: `apps/web`) | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` |
| 워커 | Railway (root: `apps/worker`, Dockerfile) | `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `LOG_LEVEL` |
| DB | Supabase Cloud | `supabase link --project-ref <ref>` 후 `supabase db push` |

배포 단계:
1. `supabase link --project-ref <YOUR_REF>` — 비밀번호 입력
2. `supabase db push` — 클라우드 DB에 5개 마이그레이션 적용
3. Supabase Dashboard → Authentication → Email → **Confirm email OFF**
4. `cd apps/web && vercel link && vercel env add ... && vercel --prod`
5. Supabase Dashboard → Authentication → URL Configuration → Site URL/Redirect URLs를 Vercel URL로 갱신
6. `cd apps/worker && railway init && railway variables set ... && railway up`

## 진행 상태

### Plan #1 — Foundation ✅ 완료 (master)

- [x] 모노레포 부트스트랩 (`apps/web`, `apps/worker`, `supabase/`)
- [x] Supabase 스키마: profiles, portfolios (글로벌만), notification_settings + RLS
- [x] 가입 트리거 (자동 글로벌 포트폴리오 ₩100M + $0 + notification_settings)
- [x] 이메일 가입/로그인 (Google OAuth는 v1.5)
- [x] 인증 셸 + 빈 대시보드 (포트폴리오 잔고 표시)
- [x] Python 워커 heartbeat (1분 주기 APScheduler, JSON 로그)
- [x] Dockerfile (Railway 배포용)
- [x] GitHub Actions CI (web, worker)
- [x] 테스트: 통합 3, 단위 2, E2E 2 — **7/7 PASS**

### Plan #2 — Stock Universe & Price Feed ✅ 완료

- [x] DB: stocks (pg_trgm 검색 인덱스), fx_rates 시계열 + RLS
- [x] 워커 데이터 소스: fdr (FinanceDataReader, KR + US prices) · yahoo (ad-hoc lookup용) · fx (exchangerate.host) — 모두 TDD with mocks
- [x] 워커 잡: bootstrap_stocks (KR top 100 동적 + US top 100 큐레이션), fetch_prices (1분 / 장중, KR 배치 + US 시퀀셜), fetch_fx (30분)
- [x] AsyncIOScheduler + FastAPI 통합 (1 process, port 8080)
- [x] /rpc/stocks/lookup ad-hoc ticker 조회 (X-Worker-Secret 인증)
- [x] Web: /api/stocks/{search,lookup}
- [x] Web: /app/trade/{search,[symbol]} 페이지 (한국어 이름·심볼·가격 표시)
- [x] E2E: 검색 → 상세 페이지 (KR 한국어, US 심볼, 알 수 없는 심볼 fallback)
- [x] 테스트: 워커 단위/통합 36 + Web E2E 5 = **누적 41/41 PASS**

v0.2.1 패치 (data sources 안정화):
- **FinanceDataReader 도입**: pykrx 1.0.x가 KRX API 변경에 호환 안 되어 FDR로 교체. KOSPI 948 + KOSDAQ 1820 동적 조회 + 시가총액 정렬로 자동 top 100 선정
- **yfinance rate limit 해결**: bootstrap이 yfinance 대신 FDR을 사용 → 200종목 28초에 198/200 가격 채워짐 (이전엔 0/200). yfinance는 ad-hoc lookup에만 사용

### Plan #4.5 — Trading UI Polish ✅ 완료

- [x] 차트 인터벌 토글 (1d/1h/15m) — 일봉은 DB 캐시, 인트라데이는 워커 RPC on-demand
- [x] 지표 토글 (MA20/60, RSI(14), Bollinger 밴드 — 클라이언트 계산)
- [x] 종목 뉴스 카드 (yfinance Ticker.news lazy-load)
- [x] 핵심 재무 지표 카드 (EPS, Forward P/E, 베타, ROE, 부채비율 등)
- [x] 포트폴리오 Overview 페이지 (총자산 + 누적 수익률 + 자산 배분 도넛 with recharts)
- [x] 워커 RPC 추가: /rpc/stocks/{bars,news,financials}
- [x] lib/indicators.ts (RSI/MACD/Bollinger 순수 함수, numerical 검증)
- [x] 테스트: 워커 +9 (yahoo 2 + yahoo_news 4 + RPC 3) + Web E2E +1 = **누적 80+ PASS**

### Plan #4 — Trading UI ✅ 완료

- [x] DB: stock_bars (OHLCV 시계열), watchlists 테이블 + RLS
- [x] 워커: fetch_daily_history (FDR) + fetch_daily_bars 잡 (KR 16:00 / US 07:00 KST cron + 부팅 시 backfill)
- [x] Web API: /api/stocks/[symbol]/bars (interval=1d/1h/15m), /api/watchlist (GET/POST/DELETE)
- [x] Web UI: Lightweight Charts v5 일봉 캔들 + MA20/MA60, BuySellSheet (BottomSheet), WatchlistButton, /app/watchlist 페이지
- [x] OrderForm refactored: forceSide prop으로 side 토글 숨김 (BuySellSheet 내부에서 사용)
- [x] 테스트: 워커 단위 49 + Web E2E 9/9 (2 SKIP은 KR 시장가, 정상) = **누적 70+ PASS**

v1.5에서 추가 예정: 인트라데이 봉(15분/1시간), RSI/MACD/볼린저, 뉴스, 재무제표 요약, 포트폴리오 overview.

### Plan #3 — Trading Core ✅ 완료

- [x] DB 4개 테이블: holdings, orders (reserved 잔고 추적), trades, fx_transactions + RLS + 정합성 제약 (filled_quantity bound, terminal state, reserved pair)
- [x] 6개 PG 함수 (atomic + auth + locks): place_market_order, place_limit_order, cancel_order, match_limit_order, exchange_currency, expire_pending_order
- [x] Worker: matching_engine 잡 (1분 주기, 만료 처리 + 매칭)
- [x] Web API 7개: /api/orders (POST/GET, market+limit), /api/orders/[id] (DELETE), /api/fx/{exchange,transactions}, /api/holdings, /api/trades
- [x] Web UI: 종목 상세에 매수/매도 폼, /app/portfolio/{holdings,orders,transactions}, /app/fx
- [x] 시뮬 수수료: KR buy 0.015%, KR sell 0.215%, US 0.05%, FX 0.5%
- [x] 테스트: 워커 단위 39 + 통합 (signup 3 + trading 7) + Web E2E 6/8 (장 마감으로 KR 시장가 2 SKIP) = **누적 55+ PASS**

### Plan #5 — Rooms & Leaderboard ✅ 완료

- [x] DB: rooms, room_members, portfolio_snapshots 테이블 + RLS 멤버 가시성 확장 (security definer 헬퍼 `_user_room_ids()`로 재귀 방지)
- [x] PG 함수 5개: `_gen_invite_code`, `create_room`, `join_room`, `transition_room_lifecycle`, `compute_portfolio_value`
- [x] 워커 잡 2개: `portfolio_snapshot` (5분), `room_lifecycle` (1분)
- [x] 쿠키 기반 PortfolioSwitcher — 8개 페이지 + watchlist API가 선택된 portfolio 사용
- [x] 7개 Web API: `/api/rooms` (POST/GET), `/api/rooms/[id]`, `/api/rooms/join`, `/api/leaderboard/{global,rooms/[id]}`, `/api/portfolio/select`
- [x] 5개 페이지: `/app/rooms` (목록), `/app/rooms/{new,join,[id]}`, `/app/leaderboard`
- [x] 6자 영숫자 초대 코드 (`ABCDEFGHJKLMNPQRSTUVWXYZ23456789`, 0/O/1/I 제외) + 복사 버튼
- [x] 종료된 방의 펜딩 BUY 주문 reserved_amount 자동 환원 (리더보드 정확도)
- [x] 테스트: 워커 단위 +6 (snapshot 3 + lifecycle 3) + 통합 +6 (room flows) + Web E2E +1 (2-account 방 흐름) = **누적 84 unit + 6 integration + 9 E2E 통과**

v0.5.1 패치 (같이 배포된 데이터 소스 안정화):
- **FDR KR 일봉**: `fetch_daily_history`가 `.KS`/`.KQ` suffix를 떼고 FDR에 호출 (FDR은 bare code만 받음) — 그 전엔 KR 종목 일봉이 한 종목도 채워지지 않았음. 로컬 백필 후 KR 24,170개 일봉 채워짐.
- **yfinance 뉴스 shape**: yfinance가 `{title, link, publisher}` top-level에서 `{content: {title, provider, clickThroughUrl, pubDate}}` 중첩 구조로 바꿔서 모든 뉴스 카드가 빈 필드로 나오던 문제. 두 shape 다 지원 + skip-empty 가드 추가.

### Plan #6 — Corporate Actions (Dividends + Splits) ✅ 완료

- [x] DB: `dividend_events`, `dividend_payouts`, `corporate_actions` 테이블 + RLS (events/actions 누구나 읽기, payouts 본인만, INSERT/UPDATE는 service_role만)
- [x] PG 함수 2개:
  - `apply_dividend(event_id)` — KR 15.4% / US 15% 원천징수, holders 모두에게 atomic 적용
  - `apply_corporate_action(action_id)` — split/reverse_split, floor(qty × ratio) + leftover_cash 환원 + 펜딩 주문 자동 조정 (수량/limit_price/reserved 재계산, new_qty=0 시 cancel)
- [x] 워커 데이터 소스: `yahoo_corporate.py` (yfinance Ticker.dividends/.splits, today 필터)
- [x] 워커 잡 2개: `fetch_corporate_data` (매일 06:00 KST), `apply_corporate_events` (매일 09:00 KST)
- [x] Web: `/app/portfolio/transactions`에 배당 섹션 추가 (gross/tax/net + ex_date 표시)
- [x] 테스트: 워커 단위 +12 (data source 6 + fetch 3 + apply 3) + 통합 +7 (US/KR 배당, 중복 방지, 2:1 split, 1:2 merge, full dilution DELETE, BUY 주문 rebalance) = **누적 103 unit/integration + 9 E2E 통과**

### Plan #7 — Web Push Notifications ✅ 완료

- [x] DB: `push_subscriptions`, `notification_queue` 테이블 + RLS, notification_settings UPDATE 정책 idempotent 추가
- [x] PG 헬퍼: `enqueue_notification(user_id, type, title, body, url, dedup_key)` — settings ON 체크 + dedup_key unique INSERT (race-safe)
- [x] 워커 잡 3개: `send_notifications` (1분, 큐 디스패치), `notify_expiring_orders` (1시간, 24h 만료 임박 스캔), `notify_room_lifecycle` (1시간, 방 시작/종료 임박)
- [x] 워커 데이터 소스: `notify.py` (pywebpush wrapper, 410 Gone → NotificationGone)
- [x] matching_engine + apply_dividend + apply_corporate_action: enqueue 통합 (6 trigger types 모두)
- [x] Web: `/sw.js` 서비스 워커 (push + click handler), `lib/push.ts` (subscribe/unsubscribe + raw base64url ArrayBuffer 변환)
- [x] Web API: `/api/push/{subscribe,unsubscribe}`, `/api/notification-settings` (GET + PATCH)
- [x] Web: `/app/settings` 페이지 + 6개 type별 토글 + 대시보드 링크
- [x] VAPID 키 설정 (`NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` env vars)
- [x] 테스트: 워커 단위 +11 (notify 3 + send 4 + expiring 2 + room_lifecycle 2) + 통합 +3 (enqueue/dedup/settings gate) = **누적 117 unit/integration + 9 E2E 통과**

### Web Push 운영 노트

```bash
# 키 1회 생성 (운영자)
npx web-push generate-vapid-keys

# Vercel env vars
vercel env add NEXT_PUBLIC_VAPID_PUBLIC_KEY production
# (raw base64url public 키 입력)

# Railway env vars
railway variables set VAPID_PRIVATE_KEY=... VAPID_SUBJECT=mailto:rms6654@gmail.com
```

iOS Safari는 16.4+ + 홈 화면 추가 후에만 푸시 동작. 데스크톱 Chrome/Firefox/Edge는 즉시 동작.

### Plan #7.5 — NXT Extended Trading Hours ✅ 완료

NXT(Nextrade) 한국 대체거래소 거래시간 모방 — KR 종목 거래 시간을 KRX-only 09:00–15:30 KST에서 **08:00–20:00 KST**로 확장 (휴장 10분 × 2 제외). 평일 저녁에도 KR 종목 시장가 주문 가능.

- [x] 워커 `market_hours.py`: `kr_session_label` (pre 08:00–08:50 / regular 09:00–15:20 / after 15:30–20:00 / closed) + `is_kr_open_extended`. `is_any_market_open`이 NXT 시간 사용 → `fetch_prices`가 평일 08:00–20:00 KST에 갱신
- [x] Web `lib/market-hours.ts`: `isKrOpenAt`을 NXT 시간으로 확장 + `getKrSession` 헬퍼 (1분마다 boundary 재평가)
- [x] `KrSessionBadge` 종목 상세 헤더에 색상 pill (amber/green/blue/muted)
- [x] E2E trading test의 KR 시간 skip 로직 NXT 기준으로 업데이트
- [x] 테스트: 워커 +23 case (parametrized: extended 16 + label 7) = **누적 140 unit/integration + 9 E2E 통과**

NOTE: 실제 NXT 가격 spread는 시뮬 안 함 (yfinance/FDR 한계). KRX 종가를 그대로 사용. 미드포인트 호가/스톱지정가/메이커-테이커 수수료/SOR은 v1.5 이후 Phase B로 deferred.

### Plan #7.6 — Korean News (Naver scrape) + Smarter Boot Backfill ✅ 완료 (hotfix)

- [x] `naver_news.py` 신규: Scrapling Fetcher (pure HTTP)로 Naver Finance 종목 뉴스 페이지 (`finance.naver.com/item/news_news.naver?code=`) 스크랩. CSS 셀렉터 `table.type5 tbody tr` (relation_tit 제외) → 제목/링크/언론사/published_at(ISO 8601 KST)
- [x] `/rpc/stocks/news`가 KR(.KS/.KQ)는 Naver, US는 yfinance로 라우팅. Naver 실패 시 yfinance fallback
- [x] 부팅 시 일봉 backfill 로직 강화: US/KR 별도 체크 — Plan #4.5 FDR `.KS` suffix 버그로 prod에 KR bars 누락되는 사이드이펙트 방지
- [x] 테스트: 워커 +5 (Naver 셀렉터 mocked) = **누적 145+ PASS**

### Plan #8 — Rule-Based Recommendations ✅ 완료

5개 룰 기반 카테고리로 대시보드에 추천 종목 노출:

- **top_gainers / top_losers** — 어제→오늘 종가 변동률 ±상위 10 (KR/US 각각)
- **volume_surge** — 오늘 거래량 / 5일 평균 ≥ 3.0인 종목, ratio 상위 10 (KR/US)
- **near_52w_high** — 52주 최고가 대비 ≥ 95%인 종목, market_cap 상위 10 (KR/US)
- **low_per_value** — KR 시총 top 200 중 PER > 0, PER 최저 10 (KR only)

- [x] DB: `recommendations` 캐시 테이블 + RLS (`SELECT` public, write service_role)
- [x] 워커 잡: `compute_recommendations` (1시간 주기 + 부팅 시 즉시 1회). Python in-memory groupby로 14일 stock_bars 집계
- [x] Atomic 갱신: DELETE all → INSERT (단일 워커 가정)
- [x] Web: `RecommendationsSection` server component (가로 스크롤 카드 5개씩, 카테고리별 reason 색상 코딩)
- [x] 대시보드 5섹션: KR top_gainers / volume_surge / low_per_value + US top_gainers / near_52w_high
- [x] 테스트: 워커 단위 +7 (helper 5 + e2e 2) + 통합 +1 = **누적 153 unit/integration + 9 E2E 통과**

### Plan #9 — PWA & Polish ✅ 완료

설치 가능한 PWA + 다크/라이트 토글 + 모바일 하단 네비게이션.

- [x] `manifest.json` + 192/512/maskable PNG 아이콘 + apple-touch-icon (180) — Pillow 일회 스크립트로 생성 (DejaVuSans-Bold, "YG" glyph on blue-600)
- [x] Next.js metadata API: `manifest`, `appleWebApp.capable`, `icons.apple`. `viewport`에 themeColor 미디어쿼리(light/dark) + `viewportFit=cover` (iOS 노치)
- [x] `next-themes` ThemeProvider (`attribute=class`, `defaultTheme=system`, `enableSystem`) — globals.css의 `:root`/`.dark` CSS vars 둘 다 정의돼 있어 양쪽 모드 안전
- [x] `ThemeToggle` 헤더 버튼 (lucide-react Sun/Moon/Monitor, 3-state 순환) — 하이드레이션 mismatch는 next-themes의 theme/resolvedTheme 직접 사용으로 회피 (별도 mount 추적 X)
- [x] `BottomNav` 모바일 하단 5탭 (홈/거래/자산/방/설정, `md:hidden`, `env(safe-area-inset-bottom)` 대응, 활성 라우트 prefix 매칭)
- [x] iOS Safari 16.4+ "홈 화면 추가" → PWA 모드 실행 시 Plan #7 Web Push 작동 가능

### PWA 설치 가이드

- **데스크톱 Chrome/Edge**: 주소창 우측의 ⊕ 또는 "앱 설치"
- **Android Chrome**: 메뉴 → "홈 화면에 추가"
- **iOS Safari 16.4+**: 공유 → "홈 화면에 추가" → PWA 아이콘 탭으로 실행해야 Web Push 동작 (일반 Safari 탭에선 X)

NOTE: `start_url=/app/dashboard`라 로그아웃 상태에서 첫 실행 시 자동으로 `/auth/login`으로 redirect됨 (정상).

### Plan #10 — Design Polish ✅ 완료

- [x] sonner Toaster (top-center, richColors, closeButton) 앱 루트 마운트
- [x] 브랜드 primary blue-600 토큰 (`oklch(0.546 0.227 264)` 라이트 / `0.65 0.20 264` 다크). accent/ring/sidebar 모두 파랑 톤
- [x] Pretendard Variable 한국어 글꼴 (jsdelivr CDN dynamic subset)
- [x] `Skeleton` 컴포넌트 + 대시보드 추천 5섹션 각각 `<Suspense fallback>` 래핑
- [x] alert() 제거 + sonner toast: `WatchlistButton`(추가/해제/실패), `CancelOrderButton`(취소/실패). OrderForm 인라인 Alert는 E2E 의존이라 유지
- [x] 빈 상태 카피 친절화 — holdings/watchlist/rooms에 이모지 + 안내 + CTA 버튼
- [x] `Logo` SVG (Y 글리프 + brand text) 앱 헤더에 적용
- [x] E2E 갱신: 빈 상태 정규식을 새 카피에 맞춤 (9 pass / 2 SKIP)

### Plan #11 — 오프라인 모드 (Serwist) ✅ 완료

- [x] `@serwist/next` 9.5.11 + `serwist` 9.5.11 — Next.js 16 webpack build에서 SW 컴파일
- [x] 서비스 워커 소스 `app/sw.ts`로 이전 — Plan #7 Web Push 핸들러(push, notificationclick) 100% 보존
- [x] 명시적 `runtimeCaching` 6개 전략 (코드 ↔ README 1:1 매칭):

| 패턴 | Handler | Cache 이름 | TTL / Entries |
|------|---------|------------|---------------|
| `/_next/static/*` | CacheFirst | `next-static` | 30d / 200 |
| `request.destination === "image"` | CacheFirst | `images` | 30d / 100 |
| `request.destination === "font"` | CacheFirst | `fonts` | 1y / 30 |
| `GET /api/recommendations`, `GET /api/stocks/*` | StaleWhileRevalidate | `read-api` | 5m / 60 |
| 변경 API (POST/PATCH/DELETE) | NetworkOnly | — | — |
| HTML 네비게이션 | NetworkFirst (3s timeout) | `pages` | 1d / 50 |

- [x] HTML 네비게이션 실패 시 `/offline` static fallback 페이지로 전환
- [x] 로그아웃 시 `pages` + `read-api` 캐시 자동 삭제 (`lib/sw-cache.ts` → `LogoutButton`) — 다른 사용자에게 개인 데이터 누출 방지
- [x] Dev 모드는 SW 비활성화 (`disable: NODE_ENV === 'development'`) — Turbopack 비호환 회피
- [x] `npm run build`/`dev` → `next ... --webpack` 강제 (Serwist는 아직 Turbopack 미지원)
- [x] `/sw.js` 응답에 `Cache-Control: no-cache, no-store, must-revalidate` — 항상 최신 SW 받음
- [x] E2E: `npm run test:e2e` (dev — `/offline` 직접 접근 PASS) / `npm run test:e2e:prod` (prod — SW 등록 + 오프라인 fallback)

오프라인 동작 수동 검증 (Chrome):
1. https://yginvest.vercel.app 한 번 방문 → 대시보드 로드
2. DevTools → Application → Service Workers → `sw.js` `activated and is running`
3. DevTools → Network → "Offline" 체크 → 새 URL 이동 → `/offline` 페이지 표시
4. DevTools → Application → Cache Storage → `pages`, `read-api`, `next-static`, `images`, `fonts` 확인

### Plan #11.5 — Background Sync (오프라인 중 주문 큐잉) ✅ 완료

- [x] Workbox `BackgroundSyncPlugin` — orders/fx/watchlist 변경 API를 IndexedDB 큐에 저장 후 'sync' 이벤트로 자동 재전송
- [x] 큐 카테고리 분리: `orders-sync` / `fx-sync` / `watchlist-sync` (디버깅 용이성)
- [x] 최대 보존 시간 `maxRetentionTime: 60` — 1시간 넘은 큐는 자동 폐기
- [x] 클라이언트 helper `lib/offline-fetch.ts` — `navigator.onLine === false` 감지 → `{ status: "queued" }` 반환
- [x] 4개 폼 적용: `OrderForm`, `FxExchangeForm`, `WatchlistButton`, `CancelOrderButton`
- [x] 시장가 주문 토스트에 가격 risk 명시: "시장가는 그때 가격으로 체결"
- [x] 환전 토스트에 환율 risk 명시: "그때 환율 적용"
- [x] WatchlistButton optimistic toggle — queued 시에도 UI 즉시 반영, sync 실패 시 재토글 가능
- [x] iOS Safari는 Background Sync API 미지원 — graceful degradation (그냥 fetch 실패 → toast.error)
- [x] BackgroundSyncPlugin은 Request object 전체를 IDB에 직렬화 — cookies(`credentials: "same-origin"` default)가 replay 시 자동 포함

큐 동작 검증 (Chrome):
1. https://yginvest.vercel.app 한 번 방문 → SW 활성화
2. DevTools → Network → "Offline"
3. 관심종목 토글 / 주문 / 환전 → 토스트 "오프라인 — 연결 시 자동..."
4. DevTools → Application → IndexedDB → `serwist-background-sync` 또는 `workbox-background-sync` queue에 entry 확인
5. Network "Offline" 해제 → 자동 재전송 → 큐 비워짐 (DB 새로고침)

### Plan #12 — NXT Phase B (가격 spread + 미드포인트 호가) ✅ 완료

- [x] DB: `_kr_nxt_session(timestamptz)` immutable PG helper — KR/NXT 세션 판정 (pre/regular/after/closed), `lib/market-hours.ts::getKrSession()`과 KST 정규화로 매핑
- [x] DB: `orders.order_type` CHECK 동적 lookup 후 `'midpoint'` 추가 (constraint 이름 무관 안전 교체)
- [x] DB: `place_market_order` 재정의 — NXT pre/after 시 매수=ask, 매도=bid (`round(last_price × 1.001, 4)` / `× 0.999`)
- [x] DB: `place_midpoint_order` 신규 — KRX + NXT pre/after 전용, midpoint(=last_price)로 즉시 체결, US 종목/closed 세션 거부
- [x] Web: `/api/orders` route — `type === "midpoint"` 분기 RPC + `midpoint_us_not_supported`/`midpoint_session_only_nxt` 에러 매핑
- [x] Web: `OrderForm` — 3번째 옵션 "미드포인트" (KRX + NXT pre/after에만 활성, 그 외 disabled + title tooltip)
- [x] Web: `BuySellSheet`에 `market` prop 추가
- [x] Web: `NxtSpreadBadge` — NXT 시간에 Bid/Ask + 10 bps spread 표시 (트레이드 페이지 가격 카드 하단)
- [x] E2E: `midpoint-order.spec.ts` 3개 — NXT 매수 체결, 정규장 비활성, NXT 배지 표시 (시간대 게이팅으로 SKIP 분기)

NXT 시간 매트릭스 (Plan #7.5 + #12):

| 세션 | 시각 (KST) | 시장가 | 지정가 | 미드포인트 | spread |
|------|-----------|--------|--------|------------|--------|
| pre | 08:00–08:50 | ✅ (spread) | ✅ | ✅ | 10 bps |
| regular | 09:00–15:20 | ✅ (no spread) | ✅ | ❌ | — |
| after | 15:30–20:00 | ✅ (spread) | ✅ | ✅ | 10 bps |
| closed | 20:00–08:00 + 주말 | ❌ | ✅ (펜딩) | ❌ | — |

### Plan #11.6 — 큐 상태 UI 시각화 ✅ 완료

- [x] `components/queue-indicator.tsx` — 5초마다 IndexedDB `serwist-background-sync` 폴링하여 `orders-sync`/`fx-sync`/`watchlist-sync` queue length 합산
- [x] 헤더에 마운트 (ThemeToggle 옆) — 큐 비어있고 online이면 hidden
- [x] online/offline 이벤트 리스너 — offline 상태에선 큐 비어도 WifiOff 아이콘 표시
- [x] 클릭 시 sonner toast로 카테고리별 breakdown ("주문 1 · 환전 0 · 관심종목 0")
- [x] navigator.onLine 사용 — lazy useState init으로 SSR safe (React 19 strict)

### Plan #8.5 — 사용자별 개인화 추천 ✅ 완료

- [x] `components/personalized-recommendations.tsx` — server component, 요청 시점에 계산
- [x] 시그널: 사용자 portfolio의 `holdings` ∪ `watchlists` 심볼
- [x] 알고리즘: 사용자 심볼 → sector 빈도 → top 2 sector → 그 sector 안의 안 가진 stocks market_cap top 5
- [x] 빈 시그널 (홀딩 0 + 관심 0)이면 `null` 반환 (새 사용자는 기존 글로벌 추천만)
- [x] 대시보드 최상단에 `Sparkles` 아이콘 + sector chip badges 와 함께 노출
- [x] KR/US 혼합 (글로벌 trending과 차별 — 사용자가 보유한 sector에 따라)

### Plan #11.7 — SW 페이지 캐시 핫픽스 ✅ 완료

- [x] 증상: 사용자가 "주가가 오전 8시 34분 이후 안 갱신됨"이라고 보고. 워커는 정상이었고 Supabase DB는 실시간 갱신 중. 원인은 Plan #11에서 도입한 `NetworkFirst` + `maxAgeSeconds: 24h` 페이지 캐시가 stale HTML 서빙.
- [x] 수정: `app/sw.ts`의 navigation matcher를 `NetworkFirst` → `NetworkOnly`로 변경. 오프라인 fallback은 Serwist `fallbacks.entries`가 `/offline`으로 자동 처리.
- [x] activate handler 추가 — 기존 `pages` 캐시 wipe. 기존 영향 사용자가 SW 활성화 시 자동 복구.

### Plan #13 — 차트 색 팔레트 커스텀 ✅ 완료

- [x] `lib/chart-palettes.ts` — 4가지 프리셋:
  - **Classic** (글로벌): green up / red down
  - **Korean** (한국): red up / blue down — KOSPI/KOSDAQ 관행
  - **Mono** (미니멀): gray scale, 강조 없음
  - **Colorblind** (색약): blue up / orange down — deuteranopia/protanopia safe
- [x] `ChartControls`에 `<select>` 팔레트 picker + 현재 up/down 색 인디케이터 (Palette icon)
- [x] `StockChart` — candlestick, MA20/MA60, Bollinger 모두 팔레트 적용
- [x] localStorage `yginvest:chart-palette` 저장 (테마 토글과 분리)
- [x] SSR-safe: 초기 DEFAULT → mount 후 localStorage 읽음 (hydration mismatch 없음)

### Plan #14 — 페이지 전환 애니메이션 ✅ 완료

- [x] `app/app/template.tsx` + `app/auth/template.tsx` — Next.js App Router `template.tsx`로 매 네비게이션마다 fresh mount
- [x] tw-animate-css 유틸리티: `animate-in fade-in slide-in-from-bottom-1 duration-200`
- [x] `motion-reduce:animate-none` — 접근성 (prefers-reduced-motion 존중)
- [x] 200ms 짧은 transition으로 답답함 회피

### 다음 plans (Plan #14 이후)

- Dynamic NXT spread — 유동성 티어별 differential
- 큐 강제 flush 버튼
- 추천 클릭 추적 (analytics)
- 차트에 거래량 바 + 보조 panel

## 디버깅 팁

- **워커 RPC가 안 잡힘**: 워커가 떠있는지 (`curl http://localhost:8080/health`), 그리고 `apps/web/.env.local`의 `WORKER_RPC_URL`/`WORKER_RPC_SECRET`이 워커 `.env`와 일치하는지 확인
- **stocks 테이블이 비어있음**: 워커 부팅 시 bootstrap_stocks가 한 번 돌아야 함. yfinance rate limit 시 가격은 NULL로 들어가지만 종목은 들어감
- **포트 8080 충돌**: 이전 워커 인스턴스가 살아있을 수 있음. `netstat -ano | grep 8080`으로 확인 후 kill
- **시장가 주문 거부 (`market_closed`)**: KR/NXT 거래시간(평일 08:00–08:50, 09:00–15:20, 15:30–20:00 KST — 휴장 10분 × 2 제외) 또는 미국 장(평일 22:30–05:00 KST 서머타임) 시간대인지 확인. 지정가는 24/7 가능
- **지정가 매칭 안 됨**: 워커 로그에서 `matching_engine` 출력 확인. 가격이 limit 도달 안 했으면 정상. 30분 stale 가격은 매칭 스킵
- **환전 `fx_rate_unavailable`**: 워커가 `fetch_fx`를 한 번 이상 실행해야 fx_rates에 행이 들어감. 워커 부팅 시 즉시 실행됨
- **트리거가 안 도는 것 같으면**: `supabase db reset`. 마이그레이션 순서대로 적용됨
- **Vercel 가입 후 redirect 안 됨**: Site URL/Redirect URLs 재확인
- **`.env.local` 변경 후 반영 안됨**: `npm run dev` 재시작
- **Playwright "browser not found"**: `npx playwright install chromium` 재실행
- **Railway 워커 즉시 종료**: `BlockingScheduler.start()`가 main의 마지막 라인이어야
- **방 가입 시 `room_not_found_or_ended`**: invite_code 잘못됐거나 방이 ended. 호스트가 새 방 만들거나 ends_at 확인
- **리더보드가 비어있음**: 워커 부팅 후 5분 대기 (첫 portfolio_snapshot). `select * from portfolio_snapshots limit 5` 확인
- **PortfolioSwitcher 없음 / 빈 드롭다운**: 사용자가 글로벌 포트폴리오 없는 신규 가입 직후일 수 있음. `supabase db reset` 후 가입부터 다시
- **방 전환 후 잔고 안 바뀜**: 쿠키 set 후 자동 reload이 일어나야 함. 안 되면 DevTools → Application → Cookies → `yginvest_portfolio` 직접 확인
- **`infinite recursion detected in policy for relation room_members`**: 정책이 자기 자신을 서브쿼리 — `_user_room_ids()` security definer 헬퍼로 우회 (마이그레이션 5_009)
- **KR 일봉 안 보임**: `fetch_daily_history`가 FDR에 KR 심볼 넘길 땐 `.KS`/`.KQ` 떼야 함. 로컬은 워커 한 번 돌리면 backfill됨
- **배당이 적용 안 됨**: `dividend_events` 테이블 확인. yfinance가 ex_date를 못 가져오는 KR 종목 다수 (yfinance 한계 — v1.5에서 FDR 보완)
- **푸시가 안 옴**: 1) `/app/settings`에서 푸시 켜기 + 종류 ON 확인 2) DevTools → Application → Service Workers에서 sw.js 등록됐는지 3) Application → Push Messaging에서 endpoint 확인 4) `select * from notification_queue order by created_at desc limit 5` — pending 상태인지/sent로 마킹됐는지
- **VAPID 키 mismatch**: applicationServerKey 잘못된 형식이면 `InvalidStateError`. raw uncompressed point base64url 필요 — `npx web-push generate-vapid-keys` 사용
- **iOS Safari 푸시 안 됨**: 16.4+ + 홈 화면 추가 필수. 일반 Safari 탭에선 동작 안 함
- **알림 큐 `no_subscription`**: 알림은 큐에 들어왔지만 사용자가 푸시 미구독. `/app/settings`에서 켜야
- **NXT 시간인데 시장가 거부**: 1) 휴장 10분(08:50-09:00, 15:20-15:30 KST) 회피 2) `price_stale` — 워커가 fetch_prices를 못 돌리면 가격이 30분 stale. 워커 health 확인. 한국 공휴일 평일은 web에서 허용하지만 워커 캘린더가 막아 → 결국 stale 가격 거부
- **KrSessionBadge가 한국시간과 안 맞음**: 클라 `Date()` 기준 (사용자 디바이스 시간). 디바이스 시간 설정 확인
- **추천 섹션이 비어있음**: 1) `select count(*) from recommendations` 0이면 워커가 아직 안 돌았거나 stock_bars가 부족 (각 종목당 ≥2일치 필요) 2) 부팅 시 자동 1회 실행됨 — 부팅 후 1분 내 채워짐 3) `compute_recommendations.skip / no_stocks` 로그면 stocks 테이블 비어있음
- **추천 갱신 안 됨**: cron 1시간 주기. 강제 즉시 갱신은 워커 재배포 (`railway up`)
- **추천 카테고리 빈 카드 없음**: 영역이 통째로 안 보이면 정상 — `RecommendationsSection` 빈 결과 시 `null` 반환
- **PWA "설치" 버튼 안 보임**: 1) `/manifest.json` 200 응답 (`curl -I`) 2) HTTPS 필수 (Vercel 자동 OK) 3) DevTools → Application → Manifest 에러 확인 4) Chrome은 사용자 engagement(여러 번 방문) 후에야 prompt
- **테마 토글 후 깜빡임 (FOUC)**: layout.tsx에서 `<html className="dark">` 강제 지정 제거됐는지 확인. next-themes가 동적으로 클래스 주입
- **BottomNav가 데스크톱에서도 보임**: `md:hidden` 누락 또는 Tailwind breakpoint(md=768px) 미만 viewport
- **iOS 홈 화면 추가 후 푸시 안 옴**: Safari 16.4+ + PWA 모드(아이콘 탭) 필수. 일반 Safari 탭은 X
- **Theme이 잘못 적용됨**: localStorage `theme` 키 확인 (next-themes 저장 위치). 클리어 후 재시도
- **글꼴이 Pretendard 아님**: CDN 미접속(네트워크) 또는 cache 누락 — system-ui로 폴백. DevTools → Network → CSS 200 확인
- **Toast 안 보임**: `apps/web/app/layout.tsx`에 `<Toaster />` 마운트 여부 확인 (ThemeProvider 안)
- **primary 색이 그대로 회색**: 브라우저 캐시. `Ctrl+Shift+R` 하드리프레시 or dev server 재시작
- **Logo SVG 색이 흰색만**: `<svg className="text-primary">`로 className이 svg 자체에 있는지 확인 (children에 두면 currentColor 상속 X)
- **분할 후 보유 수량 0**: `floor(qty × ratio) = 0`이면 holdings row 삭제됨 (CHECK constraint). leftover_cash로 잔고에 환원됨
- **펜딩 주문이 분할 후 자동 취소**: floor(qty × ratio) = 0인 케이스. BUY 주문이면 reserved_amount가 잔고에 환원됨
- **`already_applied`**: PG 함수가 중복 호출 방지. 이미 처리된 이벤트라 정상

## 라이선스

Private project, all rights reserved.
