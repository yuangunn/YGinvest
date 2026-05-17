# ARM 잡힌 후 TODO + 2/3번 봇 구축 계획

> 🔔 **이 문서는 ARM 자동 재시도 봇(Plan #46)이 ap-chuncheon-1 ARM 인스턴스를
> 확보했을 때 실행할 작업 목록입니다.** AGENTS.md에서 참조됩니다.

**현재 상태 (2026-05-18 기준):**
- AMD VM `168.110.114.1` (worker 운영 중)
- ARM 자동 재시도 봇: `*/15 * * * *` cron, Telegram 알림 활성 (@ARM_try_bot)
- 잡힐 때까지 평균 1-7일 대기

---

## 📅 잡힌 직후 — 단계별 TODO

### Phase A: 즉시 (Telegram 알림 받은 직후, 1-2일 안)

**목적**: Oracle "7일 idle 회수" 정책 회피.

- [ ] Telegram에서 ARM 잡힘 알림 확인 → 메시지 안의 OCID 메모
- [ ] Oracle Console → Compute → Instances → 새 ARM 인스턴스의 **Public IP** 확인 후 메모
- [ ] SSH 첫 접속 (AMD 때 만든 키 재사용):
  ```bash
  ssh -i ~/.ssh/oracle-yginvest.key ubuntu@<ARM_PUBLIC_IP>
  ```
- [ ] 회수 방지용 더미 컨테이너 (Docker 설치 전이면 OS 활동만이라도):
  ```bash
  # Docker 이미 설치돼 있으면:
  docker run -d --name keepalive --restart unless-stopped alpine sleep infinity
  # 없으면 임시로:
  nohup yes > /dev/null 2>&1 &
  ```
- [ ] AMD 종료 **금지** — worker 계속 돌게 두기 (마이그레이션 전까지)

### Phase B: 본격 셋업 (3-7일 안, 여유 있는 시간에)

`docs/ORACLE_MIGRATION.md` 3-5번 섹션 참조.

- [ ] **3-B**: `sudo apt update && sudo apt upgrade -y` + `sudo timedatectl set-timezone Asia/Seoul`
- [ ] **3-C**: Docker 설치 (`curl -fsSL https://get.docker.com | sudo bash` + `sudo usermod -aG docker ubuntu`)
- [ ] **3-D**: `sudo apt install -y docker-compose-plugin`
- [ ] **4-A**: Oracle Console → VCN → Security List → Ingress 8080/tcp 추가
- [ ] **4-B**: VM 내부 ufw — `sudo ufw allow 22,8080/tcp && sudo ufw --force enable`
- [ ] **5-A**: `git clone https://github.com/yuangunn/YGinvest.git ~/yginvest`
- [ ] **5-B**: `.env.worker` 작성 (AMD에서 복사):
  ```bash
  # AMD에서:
  scp -i ~/.ssh/oracle-yginvest.key ubuntu@168.110.114.1:~/yginvest/.env.worker /tmp/.env.worker
  # ARM으로:
  scp -i ~/.ssh/oracle-yginvest.key /tmp/.env.worker ubuntu@<ARM_IP>:~/yginvest/.env.worker
  ```
- [ ] **5-C**: `docker build -t yginvest-worker:latest -f apps/worker/Dockerfile apps/worker`
- [ ] **5-D**: `~/redeploy.sh` 생성 (AMD에서 복사)
- [ ] 첫 실행: `bash ~/redeploy.sh`
- [ ] 로그 확인: `docker logs -f yginvest-worker` — `worker.scheduler_started` 보이면 OK

### Phase C: 본격 마이그레이션 (1-2일 모니터링 후)

- [ ] 24-48시간 ARM worker 동시 운영하며 안정성 확인
  - 양쪽 모두 동일 cron 돌지만 DB는 idempotent 작업이라 충돌 없음
  - heartbeat 테이블에 양쪽 다 기록되는지 확인
- [ ] **Vercel 환경변수 갱신**:
  ```bash
  cd apps/web
  vercel env rm WORKER_RPC_URL production
  vercel env add WORKER_RPC_URL production
  # 값: http://<ARM_IP>:8080
  vercel --prod --yes
  ```
- [ ] Web → ARM worker 호출 확인 (`/app/health` 페이지에서 worker 활동 시각 확인)
- [ ] **AMD 종료**:
  - Oracle Console → AMD 인스턴스 → Stop → 1주일 모니터링 → Terminate
  - 또는 즉시 Terminate (성격 따라)
- [ ] **AGENTS.md 업데이트**:
  - `168.110.114.1` (AMD) → `<ARM_IP>` (ARM) 으로 변경
  - 모든 docs/scripts의 `168.110.114.1` 검색 + 교체
- [ ] **재배포 스크립트 IP 갱신**: `scripts/deploy.sh`의 `ORACLE_HOST` 기본값

### Phase D: ARM 봇 정리

- [ ] GitHub Actions → Try ARM Capacity workflow **Disable** (`docs/ARM_AUTO_RETRY.md` 5번 옵션 B)
- [ ] (선택) GitHub Secrets에서 `OCI_*` 시크릿 삭제 — ARM 확보 완료해서 불필요
  - 또는 그대로 두기 (다음에 또 ARM 인스턴스 필요할 때 재사용)

---

## 🔔 봇 #2 — 워커 모니터링 (마이그레이션 완료 후 구축)

**문제**: 워커가 죽거나 cron miss해도 사용자는 모름. 다음날 데이터 비어있는 거 보고 알게 됨.

### 데이터 소스

| 테이블 | 무엇 | 모니터링 포인트 |
|-------|------|----------------|
| `worker_heartbeat` | 매분 기록 | 5분 넘게 없으면 worker down |
| `portfolio_snapshots` | 5분마다 (active portfolio) | 10분 넘게 새 row 없으면 cron miss |
| `leaderboard_rankings` (MV) | 매일 04:00 KST refresh | 26시간 넘게 stale이면 cron miss |
| `fx_rates` | 1시간마다 | 3시간 넘게 stale이면 fetch_fx 실패 |
| RPC `/health` | 즉시 응답해야 | timeout 5초 → 응답 없으면 worker hang |

### 아키텍처 선택지

**Option A: GitHub Actions cron (외부 모니터링 — 추천)**
- 매 5분 cron으로 Supabase 직접 쿼리 → 임계치 체크 → Telegram
- 장점: worker가 완전히 죽어도 알림 작동 (self-monitoring 한계 회피)
- 단점: GitHub Actions cron 5-30분 지연 가능 (free tier)

**Option B: Vercel cron (Next.js API route)**
- `/api/cron/monitor` route + `vercel.json`에 cron 등록
- 장점: 즉시성 (정확한 5분 간격)
- 단점: Vercel Hobby 무료는 cron 2개 제한 (이미 사용 중인 게 있으면 곤란)

**Option C: 새 ARM에 별도 모니터링 컨테이너**
- worker와 분리된 컨테이너로 별도 cron
- 장점: 자원 무료 + 즉시성
- 단점: 같은 VM이라 VM 다운 시 같이 죽음

→ **추천: A + B 조합**. A로 backup (5분 cron) + B로 즉시성 (1분 cron). Vercel cron 한도 안에 있으면.

### 구현 체크리스트

- [ ] Supabase view `worker_health` 만들기:
  ```sql
  create view worker_health as
  select 
    (select max(ts) from worker_heartbeat) as last_heartbeat,
    (select max(ts) from portfolio_snapshots) as last_snapshot,
    (select max(ts) from leaderboard_rankings) as last_lb_refresh,
    (select max(ts) from fx_rates) as last_fx,
    now() - (select max(ts) from worker_heartbeat) as hb_age,
    -- ...
  ;
  ```
- [ ] `scripts/monitor/check_worker.py` — Supabase REST API 호출 + 임계치 체크 + Telegram
- [ ] `.github/workflows/monitor-worker.yml` — `*/5 * * * *` cron
- [ ] Secrets 재사용: `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID` (이미 있음)
- [ ] 신규 Secret: `SUPABASE_SERVICE_ROLE_KEY` (read용 anon으로 충분할 수도)
- [ ] 알림 throttle: 같은 종류 알림 30분 내 중복 X (Telegram의 chat_id별 last_alert_at GitHub state로)
- [ ] 메시지 포맷:
  ```
  ⚠️ Worker 이상 감지
  · last heartbeat: 8분 전 (임계: 5분)
  · last snapshot: 12분 전 (임계: 10분)
  · RPC /health: timeout
  
  → SSH로 접속해서 docker logs 확인
  → 자동 재시작 시도하려면 reply "restart"
  ```
- [ ] (선택) Reply-based 자동 재시작: Telegram 메시지에 reply하면 Vercel webhook → SSH 호출 (보안 신중히)

---

## 🤖 봇 #3 — 자동 트레이딩/분석 (마이그레이션 완료 후 구축)

**문제**: 사용자가 매일 앱 안 들어와도 인사이트 받게 하기. 또 AI를 active하게 활용.

### 후보 기능

| 기능 | 대상 | 구현 난이도 |
|------|------|------------|
| **일일 시장 요약** (오전 8시) | 모든 push subscriber | ⭐ — KR+US 시장 코멘트 (Claude로 5-10줄) |
| **개인 포트폴리오 일일 리포트** (오후 6시) | opt-in 사용자 | ⭐⭐ — 보유 종목별 변동 + AI 해석 |
| **관심 종목 알림** | 사용자별 등록 | ⭐ — 가격 알림 기능 이미 있음, 확장 가능 |
| **갑작스러운 변동 감지** | 모든 보유 종목 | ⭐⭐ — 5분 봉 5% 이상 변동 시 push |
| **실적 발표 D-1 알림** | 보유/관심 종목 | ⭐ — earnings_events 테이블 활용 |
| **AI 매도 시그널** | opt-in | ⭐⭐⭐ — RSI/MACD + AI 판단 (위험: 책임 관련) |

### 추천 우선순위

**Phase 3.1** (가장 가치 + 가장 쉬움):
- [ ] 일일 시장 요약 (오전 8시 KR 장 시작 전, Claude API로 KR+US 코멘트 생성)
- [ ] 실적 발표 D-1 알림 (이미 있는 `earnings_events` 테이블 활용)
- [ ] 관심 종목 갑작스러운 변동 감지 (분봉 데이터 활용)

**Phase 3.2** (사용자 가치 ↑, 책임 ↑):
- [ ] 개인 포트폴리오 일일 리포트 (AI 분석 + 종목별 코멘트)
- [ ] 매도 시그널 (보수적으로 — "검토 필요" 정도, 실행 X)

### 데이터 흐름

```
Worker (cron) 
  → 분석 결과 → notification_queue 테이블에 enqueue
  → send_notifications cron이 push subscription / Telegram으로 전송
```

기존 Web Push 인프라 100% 재사용. Telegram은 추가 channel로:

- [ ] `users` 테이블에 `telegram_chat_id` 컬럼 추가 (opt-in)
- [ ] `notification_settings` 테이블에 `daily_summary`, `earnings_alert` 등 토글
- [ ] worker `send_notifications` job에 Telegram delivery 추가
- [ ] `/app/settings` 페이지에 Telegram 연동 UI:
  - "Telegram에서 @YGinvest_bot 찾아서 `/start` 보내기"
  - 봇이 `/connect <code>` 같은 명령으로 chat_id ↔ user_id 연결
  - 토큰 발급 + 1회용 code 시스템

### Phase 3.1 첫 마일스톤 체크리스트

- [ ] `apps/worker/src/ygworker/jobs/daily_summary.py` — KR/US 지수 + top movers 가져와 Claude API 호출
- [ ] cron: 매일 07:30 KST (`hour=7, minute=30, timezone="Asia/Seoul"`)
- [ ] 결과를 `daily_summary` 테이블에 저장 (날짜별)
- [ ] 사용자별 Telegram chat_id로 전송 (`notification_queue` 큐 활용)
- [ ] (선택) Web `/app/dashboard`에도 당일 요약 카드 표시
- [ ] AI 비용: Claude Haiku로 충분 (요약 500토큰 정도 → 사용자당 ~$0.0001)

---

## 📚 참조 문서

- `docs/ORACLE_MIGRATION.md` — Oracle 셋업 전체 가이드 (마이그레이션 5-7번 섹션)
- `docs/ARM_AUTO_RETRY.md` — ARM 봇 셋업/운영 가이드
- `scripts/oci-arm-retry/` — ARM 봇 스크립트 + secrets 등록 helper
- `AGENTS.md` — 인프라 진실의 단일 출처

---

## 🔄 진행 상태

각 항목 완료할 때마다 체크박스 갱신 + 커밋:

```bash
# 예시
git add docs/ARM_MIGRATION_TODO.md
git commit -m "chore(arm-migration): Phase A 완료 (SSH 첫 접속 + keepalive 컨테이너)"
```

마지막 갱신: 2026-05-18 (Plan #46 — ARM 봇 셋업 완료, 잡힘 대기 중)
