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

### 다음 plans (Plan #7.5 이후)

- Plan #8: 룰 기반 종목 추천
- Plan #9: PWA & Polish
- Plan #10 (v1.5): NXT Phase B (가격 spread + 미드포인트) + Design Polish

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
- **분할 후 보유 수량 0**: `floor(qty × ratio) = 0`이면 holdings row 삭제됨 (CHECK constraint). leftover_cash로 잔고에 환원됨
- **펜딩 주문이 분할 후 자동 취소**: floor(qty × ratio) = 0인 케이스. BUY 주문이면 reserved_amount가 잔고에 환원됨
- **`already_applied`**: PG 함수가 중복 호출 방지. 이미 처리된 이벤트라 정상

## 라이선스

Private project, all rights reserved.
