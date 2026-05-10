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
- [x] 워커 데이터 소스: yahoo (yfinance) · krx (pykrx, fallback) · fx (exchangerate.host) — 모두 TDD with mocks
- [x] 워커 잡: bootstrap_stocks (KR top 100 + US top 100 하드코딩), fetch_prices (1분 / 장중), fetch_fx (30분)
- [x] AsyncIOScheduler + FastAPI 통합 (1 process, port 8080)
- [x] /rpc/stocks/lookup ad-hoc ticker 조회 (X-Worker-Secret 인증)
- [x] Web: /api/stocks/{search,lookup}
- [x] Web: /app/trade/{search,[symbol]} 페이지 (한국어 이름·심볼·가격 표시)
- [x] E2E: 검색 → 상세 페이지 (KR 한국어, US 심볼, 알 수 없는 심볼 fallback)
- [x] 테스트: 워커 단위/통합 36 + Web E2E 5 = **누적 41/41 PASS**

알려진 한계:
- **pykrx 호환성**: 현재 KRX API 변경으로 pykrx 1.0.x 동작 안 함. KR 종목 마스터는 `kr_top.py`에 하드코딩 (KOSPI 50 + KOSDAQ 50, 한국어명 포함)
- **yfinance rate limiting**: Yahoo Finance가 빠른 200건 호출에 SSL 에러로 응답 → 부팅 시 가격 비어있을 수 있음. fetch_prices 잡이 1분마다 점진적 갱신

### 다음 plans

- Plan #3: Trading Core (시장가/지정가/환전, 매칭 엔진)
- Plan #4: Trading UI (종목 상세 + 차트 + 매수/매도)
- Plan #5: Rooms & Leaderboard (친구방, 글로벌·방 랭킹)
- Plan #6: 배당 시뮬, 분할/병합, Web Push, 룰 기반 추천
- Plan #7: PWA & Polish (manifest, 서비스 워커, 다크/라이트)

## 디버깅 팁

- **워커 RPC가 안 잡힘**: 워커가 떠있는지 (`curl http://localhost:8080/health`), 그리고 `apps/web/.env.local`의 `WORKER_RPC_URL`/`WORKER_RPC_SECRET`이 워커 `.env`와 일치하는지 확인
- **stocks 테이블이 비어있음**: 워커 부팅 시 bootstrap_stocks가 한 번 돌아야 함. yfinance rate limit 시 가격은 NULL로 들어가지만 종목은 들어감
- **포트 8080 충돌**: 이전 워커 인스턴스가 살아있을 수 있음. `netstat -ano | grep 8080`으로 확인 후 kill
- **트리거가 안 도는 것 같으면**: `supabase db reset`. 마이그레이션 순서대로 적용됨
- **Vercel 가입 후 redirect 안 됨**: Site URL/Redirect URLs 재확인
- **`.env.local` 변경 후 반영 안됨**: `npm run dev` 재시작
- **Playwright "browser not found"**: `npx playwright install chromium` 재실행
- **Railway 워커 즉시 종료**: `BlockingScheduler.start()`가 main의 마지막 라인이어야

## 라이선스

Private project, all rights reserved.
