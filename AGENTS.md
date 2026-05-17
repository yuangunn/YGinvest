# YGinvest — 에이전트 즉시 참고

> ⚠️ **이 파일은 매 세션마다 자동 로드됩니다.** 컴팩션이 일어나도 살아남는 진실의
> 단일 출처. 배포/인프라/DB 관련 어떤 작업이든 시작 전에 먼저 읽으세요.

## 🚀 인프라 한눈에

| 컴포넌트 | 호스팅 | 배포 명령 |
|---------|--------|----------|
| **웹** | Vercel | `cd apps/web && vercel --prod --yes` |
| **워커** | **Oracle Cloud VM** (`168.110.114.1`) — Railway 아님 (#34에서 이주) | `ssh -i ~/.ssh/oracle-yginvest.key ubuntu@168.110.114.1 'bash ~/redeploy.sh'` |
| **DB** | Supabase Cloud (`hhkcttwzqiklvxcuzazd`) | `supabase db push --linked` |

### 통합 배포 (가장 안전)
```bash
bash scripts/deploy.sh
```
→ git push + supabase db push + vercel deploy + Oracle worker 재배포를 순서대로 실행.

### 워커만 재배포
```bash
ssh -i ~/.ssh/oracle-yginvest.key ubuntu@168.110.114.1 'bash ~/redeploy.sh'
```
VM의 `~/redeploy.sh`가 `git pull → docker build → 컨테이너 재시작`까지 자동 수행.

### 상세 가이드
- `docs/ORACLE_MIGRATION.md` — Oracle 이주 단계별 가이드 + 트러블슈팅
- `docs/ARM_AUTO_RETRY.md` — ARM 인스턴스 capacity 자동 재시도

## ⚠️ 빠지기 쉬운 함정

1. **README.md의 "배포: Railway" 문구는 outdated** — 워커는 Oracle Cloud VM 이주 완료.
   이 AGENTS.md가 진실의 단일 출처.
2. **Railway CLI 시도 금지** — 더 이상 사용하지 않음. Oracle SSH로 가야 함.
3. **워커 코드 변경 후 `vercel --prod`만으로 끝났다고 착각 금지** — 워커는 별도
   재배포 필요 (Oracle VM의 Docker 이미지 재빌드).
4. **이주 등 큰 변경 후엔 이 AGENTS.md를 업데이트** — README보다 여기가 먼저.

## 📦 코드 구조

- `apps/web` — Next.js 16 App Router + Tailwind v4 + shadcn/ui (Pretendard, YG 디자인 시스템)
- `apps/worker` — Python 3.12 + APScheduler (가격/매칭/스냅샷/리더보드 refresh cron)
- `supabase/migrations` — 모든 DB 변경은 마이그레이션으로
- `docs/superpowers/specs` + `docs/superpowers/plans` — 설계/실행 계획

## 🛠️ 작업 시 기본 체크리스트

1. 인프라/배포 관련 작업이면 → **이 AGENTS.md 먼저 정독**
2. `docs/` 디렉토리에 `MIGRATION/INFRA/DEPLOY` 파일명 있으면 → 무조건 열어보기
3. README는 outdated 가능성 의심 — AGENTS.md와 충돌하면 AGENTS.md가 truth
4. 변경 후 build → typecheck → 배포 → 확인 순서
5. `git push origin master` 후 `cd apps/web && vercel --prod --yes` 자동 실행 (apps/web/AGENTS.md 룰)

## 🔑 시크릿 위치

- Oracle SSH 키: `~/.ssh/oracle-yginvest.key`
- Vercel env: `vercel env ls production` (값은 encrypted)
- VM `.env.worker`: `/home/ubuntu/yginvest/.env.worker` (Supabase keys, VAPID)

## 🇰🇷 한국 시장 컨벤션 (코드/디자인 규칙)

- **상승 = 빨강 `#E84B5A`, 하락 = 파랑 `#2563EB`** (Western convention 반대)
- 화폐: KRW는 `₩` 또는 `원` 접미사, USD는 `$` 접두사
- 날짜: `YYYY-MM-DD` 또는 `M월 D일`
- 폰트: Pretendard Variable
