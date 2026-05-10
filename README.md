# YGinvest

모의 주식 트레이딩 PWA — 한국·미국 거래소, KRW/USD 분리 계좌, 글로벌 + 친구방 리더보드.

## 디렉토리

- `apps/web` — Next.js 프론트엔드 (Vercel)
- `apps/worker` — Python 시세/매칭 워커 (Railway)
- `supabase/` — DB 마이그레이션 + 로컬 개발 설정
- `docs/superpowers/` — spec & plan 문서

## 개발

각 앱별 README는 해당 디렉토리에 위치.

요약:
```bash
# DB 로컬
supabase start

# 웹
cd apps/web && npm install && npm run dev

# 워커
cd apps/worker && uv sync && uv run python -m ygworker.main
```

## 배포

- 웹: Vercel (root: `apps/web`)
- 워커: Railway (root: `apps/worker`, Dockerfile)
- DB: Supabase Cloud
