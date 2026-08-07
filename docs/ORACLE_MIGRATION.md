# Oracle Cloud Always Free 이주 가이드

Railway → Oracle Cloud로 worker를 옮기는 단계별 가이드. **영구 무료** + 강력한 ARM VM (1-4 vCPU, 6-24GB RAM).

---

## 📦 한눈에 보기

- **시간**: 셋업 30분 ~ 1시간
- **월 비용**: $0 (영구 무료, 한도 안)
- **요구사항**: 신용카드 (verification 용, 과금 X), SSH 클라이언트
- **결과**: Railway worker를 Oracle ARM VM에서 Docker로 운영

---

## 1️⃣ Oracle Cloud 계정 가입

1. https://www.oracle.com/cloud/free/ 접속
2. **Start for Free** 클릭
3. 이메일/주소/전화번호 입력
4. **국가 (Country)**: Korea, Republic of (이 선택이 region 결정)
5. **Region**: `Seoul (ap-seoul-1)` 자동 선택됨 — 한국 데이터센터
6. 신용카드 등록 (verification용 $1 가승인, 환불됨)
7. SMS 인증 → 가입 완료

> ⚠️ **주의**: 가입 후 "Upgrade and Pay As You Go" 클릭 절대 X. Always Free 한도 안에서만 사용.

---

## 2️⃣ Compute Instance (VM) 생성

### 2-A. Console 진입
- https://cloud.oracle.com/ → 로그인
- 좌측 햄버거 메뉴 → **Compute** → **Instances**

### 2-B. Create Instance
- **Name**: `yginvest-worker`
- **Compartment**: 기본 (root) 유지
- **Image**: **Canonical Ubuntu 22.04** (가장 호환성 좋음)
- **Shape**: **Change shape** 클릭 → **Ampere (ARM)**
  - **Specialty and previous generation** 카테고리에서 `VM.Standard.A1.Flex` 선택
  - **OCPUs**: `2` (1-4 가능, 2개면 충분)
  - **Memory**: `12 GB` (6-24GB 가능)
- **Networking**:
  - VCN: 새 VCN 생성 (자동)
  - Subnet: Public subnet 자동
  - **Public IPv4 address**: ✅ Assign
- **SSH keys**: 
  - Generate a key pair → **Save Private Key** (`.key` 파일 다운로드 — 절대 잃어버리지 X)
  - Public Key는 자동 등록
- **Boot Volume**: 50 GB (기본)
- **Create** 클릭

→ 1-2분 후 인스턴스 생성 완료. **Public IP** 메모.

> 💡 ARM Ampere 인스턴스가 "Out of capacity" 오류 — 한국 리전 인기 시간대 (한국 저녁) 피해서 시도. 한국 새벽이나 다른 시간대에 다시 시도하면 잡힘.

---

## 3️⃣ SSH 접속 + 기본 셋업

### 3-A. SSH 접속
```bash
chmod 600 ~/Downloads/ssh-key.key
ssh -i ~/Downloads/ssh-key.key ubuntu@<PUBLIC_IP>
```

### 3-B. 시스템 업데이트
```bash
sudo apt update && sudo apt upgrade -y
sudo timedatectl set-timezone Asia/Seoul
```

### 3-C. Docker 설치
```bash
# 공식 스크립트
curl -fsSL https://get.docker.com | sudo bash
sudo usermod -aG docker ubuntu
# 재로그인 (Ctrl+D 후 다시 ssh) — 또는 newgrp docker

# 검증
docker --version
```

### 3-D. Docker Compose 설치
```bash
sudo apt install -y docker-compose-plugin
docker compose version
```

---

## 4️⃣ 방화벽 / 네트워크

### 4-A. Oracle 보안 그룹 (Security List)

Cloud Console → Networking → Virtual Cloud Networks → 생성된 VCN → **Default Security List**:

**Ingress (인바운드) 규칙 추가**:
| Source CIDR | Protocol | Port | 용도 |
|-------------|----------|------|------|
| `0.0.0.0/0` | TCP | 22 | SSH (이미 있음) |
| `0.0.0.0/0` | TCP | 8080 | Worker RPC (Vercel에서 호출) |

> ⚠️ Vercel 서버 IP를 정확히 알면 그것만 화이트리스트 추천. 단 Vercel은 동적이라 `0.0.0.0/0` + X-Worker-Secret으로 보호하는 게 일반적.

### 4-B. VM 내부 방화벽 (Ubuntu)
```bash
sudo ufw allow 22/tcp
sudo ufw allow 8080/tcp
sudo ufw --force enable
sudo ufw status
```

> Oracle Ubuntu 이미지는 기본적으로 `iptables` 룰이 잠겨있음. 위 ufw 명령으로 풀어줘야 함.

---

## 5️⃣ 워커 코드 + Docker 이미지 빌드

### 5-A. Git 클론
```bash
sudo apt install -y git
git clone https://github.com/yuangunn/YGinvest.git ~/yginvest
cd ~/yginvest/apps/worker
```

### 5-B. 환경 변수 파일 작성
```bash
cat > .env <<'EOF'
SUPABASE_URL=https://hhkcttwzqiklvxcuzazd.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<Cloud DB service_role 키>
SUPABASE_ANON_KEY=<Cloud DB anon 키>
LOG_LEVEL=INFO
WORKER_RPC_PORT=8080
WORKER_RPC_SECRET=<현재 Railway에 설정된 동일한 secret>
VAPID_PRIVATE_KEY=<현재 Railway에 설정된 값>
VAPID_SUBJECT=mailto:rms6654@gmail.com
EOF

chmod 600 .env  # 보안
```

> Supabase keys는 https://supabase.com/dashboard/project/hhkcttwzqiklvxcuzazd/settings/api 에서 복사.

### 5-C. Docker 이미지 빌드
```bash
docker build -t yginvest-worker:latest .
```

ARM에서 ARM 이미지로 빌드 (네이티브) — 약 3-5분 소요.

### 5-D. 컨테이너 실행
```bash
docker run -d \
  --name yginvest-worker \
  --restart unless-stopped \
  -p 8080:8080 \
  --env-file .env \
  yginvest-worker:latest

# 로그 확인
docker logs -f yginvest-worker
```

`worker.starting` + `worker.scheduler_started` 로그 보이면 정상.

---

## 6️⃣ Vercel 환경변수 업데이트

웹앱이 worker RPC를 호출하므로 새 IP로 변경 필요.

### 6-A. Vercel Dashboard
- https://vercel.com/yuangunns-projects/yginvest/settings/environment-variables
- `WORKER_RPC_URL` 값 변경: `https://<RAILWAY_OLD>` → `http://<ORACLE_PUBLIC_IP>:8080`
- `WORKER_RPC_SECRET`은 동일 유지 (이미 worker .env에 입력)
- **Save** → 다음 deploy부터 적용

### 6-B. 즉시 적용
```bash
# 로컬에서
cd apps/web
vercel deploy --prod --yes
```

또는 Vercel Dashboard에서 **Redeploy** 클릭.

---

## 7️⃣ HTTPS (선택사항)

HTTP 직접 노출이 불안하면:

### Option A: Cloudflare Tunnel (가장 쉬움, 무료)
```bash
# cloudflared 설치
curl -L https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-arm64 \
  -o /tmp/cloudflared
sudo mv /tmp/cloudflared /usr/local/bin/cloudflared
sudo chmod +x /usr/local/bin/cloudflared

# Cloudflare 계정 + 도메인 필요. tunnel 생성 → 토큰 받기.
sudo cloudflared service install <TOKEN>
```

→ Cloudflare Dashboard에서 `worker.yginvest.com` → `http://localhost:8080` 매핑. Vercel은 `https://worker.yginvest.com` 사용.

### Option B: Caddy + Let's Encrypt
```bash
sudo apt install -y caddy
sudo tee /etc/caddy/Caddyfile <<EOF
worker.yginvest.com {
    reverse_proxy localhost:8080
}
EOF
sudo systemctl reload caddy
```

(도메인 + DNS A record 필요)

---

## 8️⃣ 모니터링 / 자동 재시작

### 8-A. Docker `--restart unless-stopped`
이미 적용됨 (5-D). 컨테이너 crash 또는 VM 재부팅 시 자동 시작.

### 8-B. Heartbeat 모니터링
Worker는 `heartbeat` cron이 매 60초 supabase `worker_heartbeat` 테이블에 ts 기록
(Plan #48). Health 페이지에서 확인:
- https://yginvest.vercel.app/app/health

마지막 fetch 시각이 10분+ 오래되면 worker 다운 신호.

### 8-C. 외부 Dead-man Monitor (필수) — Plan #48

> ⚠️ **중요**: 워커 안의 `health_monitor`(매 15분)는 워커가 죽으면 알림도 같이
> 죽는다. 실제로 2026-06-05 워커 다운 후 **9일간 무음 장애**가 발생했다.
> 그래서 워커 *밖*에서 도는 독립 감시자가 반드시 필요하다.

GitHub Actions(`.github/workflows/worker-deadman.yml`)가 매 15분
`scripts/deadman_monitor.py`를 실행해 `worker_heartbeat.ts` 신선도를 검사한다.
ts가 `STALE_THRESHOLD_MIN`(기본 15분)보다 오래되면 → 워커 다운으로 보고 Telegram 알림
(+복구 시 복구 알림). 워커/VM이 통째로 꺼져도 GitHub에서 돌기 때문에 알림이 나간다.

**활성화 — repo secrets 등록** (GitHub → Settings → Secrets and variables → Actions):
| Secret | 값 |
|--------|----|
| `SUPABASE_URL` | `https://hhkcttwzqiklvxcuzazd.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service_role 키 |
| `TELEGRAM_BOT_TOKEN` | 워커와 동일 토큰 |
| `TELEGRAM_CHAT_ID` | 워커와 동일 chat id |

(선택) repo variables 로 임계치 조정: `DEADMAN_STALE_THRESHOLD_MIN`, `DEADMAN_DEDUP_MIN`.
secrets 미등록 시 워크플로는 자동 skip(안전). 수동 테스트는 Actions 탭 → Run workflow.

### 8-D. (선택) Uptime Robot
- https://uptimerobot.com/ 무료 가입
- Monitor 추가: HTTP, URL = `http://<ORACLE_IP>:8080/healthz` (또는 worker가 응답할 수 있는 path)
- 다운 시 이메일 알림

### 8-E. Supabase Keep-alive (필수) — Plan #48

Supabase 무료 티어는 **7일간 DB 활동이 없으면 자동 pause** 된다. 지금까지 Supabase를
깨워둔 건 워커 cron뿐이라, 워커가 죽으면(2026-06-05 9일 다운) Supabase까지 pause 됐다.

`.github/workflows/supabase-keepalive.yml` 가 워커와 무관하게 **하루 4회(6시간마다)**
Supabase REST를 익명 SELECT로 ping → DB 활동 발생 → pause 타이머 리셋.

**활성화 — repo secrets**: `SUPABASE_URL`, `SUPABASE_ANON_KEY` (미설정 시 자동 skip).
빈도 조정은 워크플로의 `cron` 수정. (7일 규칙엔 1일 1회로도 충분하나 4회로 실패 여유 확보.)

---

## 9️⃣ 갱신 (코드 업데이트)

```bash
cd ~/yginvest
git pull
cd apps/worker
docker build -t yginvest-worker:latest .
docker stop yginvest-worker
docker rm yginvest-worker
docker run -d \
  --name yginvest-worker \
  --restart unless-stopped \
  -p 8080:8080 \
  --env-file .env \
  yginvest-worker:latest
```

또는 스크립트화:
```bash
cat > ~/redeploy.sh <<'EOF'
#!/bin/bash
set -e
cd ~/yginvest && git pull
cd apps/worker
docker build -t yginvest-worker:latest .
docker stop yginvest-worker 2>/dev/null || true
docker rm yginvest-worker 2>/dev/null || true
docker run -d --name yginvest-worker --restart unless-stopped \
  -p 8080:8080 --env-file .env yginvest-worker:latest
echo "[$(date)] redeployed"
EOF
chmod +x ~/redeploy.sh
```

이후 `~/redeploy.sh` 한 번에 갱신.

---

## 🔟 Railway 종료

OK 확인 후:
1. Vercel `/app/health` 또는 worker 로그에서 cron 잡 정상 작동 확인 (1-2일)
2. Railway dashboard → Settings → **Delete Project**
3. 청구 정지

---

## 🚨 트러블슈팅

### "Out of capacity" — ARM 인스턴스 안 만들어짐
- 한국 시간 새벽 / 평일 오전에 다시 시도
- 또는 region을 `Ashburn (us-ashburn-1)` 등 미국 지역으로 변경 (latency 약간 증가 but always free 동일)

### Docker 빌드 중 `pip install` 실패
- `--network=host` 추가: `docker build --network=host ...`
- 또는 ARM 호환성 문제 — 일부 패키지가 x86 only. `yfinance` / `supabase-py`는 ARM 호환 ✓

### Vercel → Oracle worker 호출 timeout
- Oracle Security List에 8080 인바운드 추가됐는지 확인
- VM 내부 `sudo ufw status`로 ufw 8080 허용 확인
- `curl http://<ORACLE_IP>:8080/rpc/...` 로컬에서 테스트

### 가격 fetch 안 됨
- yfinance가 ARM에서 timeout 종종 발생 — retry 로직 이미 있음
- Worker 로그 확인: `docker logs yginvest-worker --tail 100`

### Cron이 시간대 잘못 작동
- VM 시간대 확인: `timedatectl`
- Asia/Seoul로 설정: `sudo timedatectl set-timezone Asia/Seoul`
- Worker scheduler는 `timezone="Asia/Seoul"` 명시되어 있으므로 VM 시간대와 무관하긴 하지만, 일관성 위해 KST 권장

---

## 💰 비용 모니터링

- Oracle Cloud Console → **Billing** → 항상 $0 확인
- Always Free 한도:
  - Ampere ARM: 4 vCPU + 24GB RAM 총합
  - Block Storage: 200GB
  - 네트워크: 10TB/월 outbound
- 한도 초과 시 자동 정지 (과금 X — Pay As You Go 업그레이드 한 적 없으면)

---

## 🎯 정리

| 비용 | Railway | Oracle Always Free |
|------|---------|---------------------|
| 월 | $5-10 | $0 |
| 설치 시간 | 0 (이미 done) | 30-60분 |
| 유지보수 | 0 | 1-2개월에 한 번 OS 패치 |
| 성능 | 작은 컨테이너 | ARM 24GB RAM (overkill) |
| 안정성 | High | High (Oracle 자체 SLA) |

영구 무료 + 강력한 성능. 시간 1시간 투자할 의향 있으면 매우 좋은 선택.

질문/문제 발생 시 `~/yginvest/docs/ORACLE_MIGRATION.md` 다시 참고.
