# ARM Always Free 자동 시도 셋업 (GitHub Actions)

Oracle ARM 인스턴스가 "Out of capacity"로 안 잡힐 때 — GitHub Actions가 매 15분마다 시도. 성공 시 Telegram/Discord 알림 + workflow 자동 비활성화 추천.

---

## 📦 한눈에 보기

- **무료**: GitHub Actions public repo는 무제한 (private은 2000분/월)
- **15분 간격**: 매 15분 시도 → 하루 ~96회 시도
- **보통 1-7일 안에 잡힘** (시간/지역 무관)
- **성공 시**: Telegram/Discord 알림 + 인스턴스 자동 생성

---

## 1️⃣ OCI API Key 생성

GitHub Actions가 Oracle Cloud에 접근하려면 API 키 필요. (이건 SSH 키랑 다른 것)

### 1-A. Console에서 API Key 추가

1. Oracle Cloud Console 로그인
2. 우상단 **사용자 메뉴 (사용자 이름 아이콘)** → **My Profile**
3. 좌측 **API Keys**
4. **Add API Key** 클릭
5. **Generate API Key Pair** 선택 → **Download Private Key** 다운로드
   - 파일명: `oraclecloud_***_private.pem`
   - **이거 잃어버리면 자동 시도 못함**
6. **Add** 클릭
7. **Configuration File Preview** 표시되는 정보 메모:

```
[DEFAULT]
user=ocid1.user.oc1..aaaaaa...        ← OCI_USER_OCID
fingerprint=aa:bb:cc:dd:...            ← OCI_FINGERPRINT
tenancy=ocid1.tenancy.oc1..aaaaa...    ← OCI_TENANCY_OCID
region=ap-seoul-1                      ← OCI_REGION
key_file=<path to your private keyfile>
```

이 5개 값 메모 (key_file 빼고 4개).

### 1-B. Private Key 내용 복사

다운로드한 `.pem` 파일을 텍스트 에디터로 열어서 **전체 내용**을 복사:

```
-----BEGIN PRIVATE KEY-----
MIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQC...
... (여러 줄) ...
-----END PRIVATE KEY-----
```

→ OCI_PRIVATE_KEY 시크릿으로 사용.

---

## 2️⃣ 필요한 OCID 값 수집

### 2-A. Compartment OCID
- Console → **Identity & Security** → **Compartments**
- root compartment 옆 "OCID" 복사 (Copy 버튼)
- → `OCI_COMPARTMENT_ID`

### 2-B. Subnet OCID
- Console → **Networking** → **Virtual Cloud Networks**
- AMD 만들 때 생성된 VCN 클릭
- 좌측 **Subnets** → public subnet 클릭
- "OCID" 복사
- → `OCI_SUBNET_ID`

### 2-C. ARM용 Ubuntu Image OCID
- Console → **Compute** → **Custom Images** 옆 **Platform Images**
- 또는 직접 URL: https://docs.oracle.com/en-us/iaas/images/
- **Canonical Ubuntu 22.04 (aarch64)** 검색
- 서울 리전 ap-seoul-1 OCID 복사
- → `OCI_IMAGE_OCID`

> 💡 가장 쉬운 방법: Console에서 인스턴스 생성 페이지 들어가서 Ubuntu 22.04 + ARM Shape 선택 후 "Save and edit later" → Edit → image OCID 확인

### 2-D. SSH Public Key

AMD 만들 때 받은 키 페어 중 **public** 부분. 또는 새로 생성:

```bash
# 로컬에서 (이미 있다면 skip)
ssh-keygen -t rsa -b 4096 -f ~/.ssh/oci-yginvest -N ""
cat ~/.ssh/oci-yginvest.pub
# ssh-rsa AAAAB3Nz... 출력 — 이걸 복사
```

→ `OCI_SSH_PUBLIC_KEY`

---

## 3️⃣ GitHub Secrets / Variables 등록

### Repo 설정 페이지
- https://github.com/yuangunn/YGinvest/settings/secrets/actions

### Secrets 추가 (민감 정보 — 암호화됨)

| Name | Value |
|------|-------|
| `OCI_USER_OCID` | 1-A에서 메모한 user OCID |
| `OCI_TENANCY_OCID` | 1-A에서 메모한 tenancy OCID |
| `OCI_REGION` | `ap-seoul-1` (또는 본인 region) |
| `OCI_FINGERPRINT` | 1-A에서 메모한 fingerprint |
| `OCI_PRIVATE_KEY` | 1-B에서 복사한 PEM 전체 (BEGIN/END 포함) |
| `OCI_COMPARTMENT_ID` | 2-A에서 복사 |
| `OCI_SUBNET_ID` | 2-B에서 복사 |
| `OCI_IMAGE_OCID` | 2-C에서 복사 |
| `OCI_SSH_PUBLIC_KEY` | 2-D에서 복사 (`ssh-rsa AAAA...`) |
| `OCI_INSTANCE_NAME` | `yginvest-arm` (원하는 이름) |

### Variables 추가 (Settings → Secrets and variables → Variables 탭)

| Name | Value |
|------|-------|
| `OCI_ARM_OCPUS` | `2` (1-4 사이) |
| `OCI_ARM_MEMORY_GB` | `12` (6-24 사이) |
| `OCI_ARM_BOOT_GB` | `50` |

### (선택) 알림 Secrets

#### Telegram 알림
1. https://t.me/BotFather 에서 봇 생성 → 토큰 받음
2. https://t.me/userinfobot 으로 본인 chat ID 확인
3. Secrets 추가:
   - `TELEGRAM_BOT_TOKEN`: 봇 토큰
   - `TELEGRAM_CHAT_ID`: 본인 chat ID

#### Discord 알림
1. Discord 서버 → 채널 설정 → Integrations → Webhooks → New Webhook
2. URL 복사
3. Secret 추가: `DISCORD_WEBHOOK_URL`

알림 설정 안하면 GitHub Actions 로그에서 확인.

---

## 4️⃣ 워크플로 활성화

이 repo의 `.github/workflows/try-arm-capacity.yml`이 이미 commit돼 있음.

### 첫 실행

1. https://github.com/yuangunn/YGinvest/actions
2. 좌측 **Try ARM Capacity** workflow 선택
3. 우측 **Run workflow** 버튼 → **Run workflow** 클릭
4. 로그 확인:
   - `[try] AD=...  out of capacity (silent retry)` → 정상 (다음 cron 대기)
   - `[SUCCESS] Instance launched!` → 🎉

### 자동 스케줄

`cron: "*/15 * * * *"` — 매 15분마다 자동 시도 시작.

> ⚠️ **GitHub Actions cron 지연**: free tier에서 5-30분 지연 가능. 정확한 15분 간격 보장 X. 평균 20-25분 간격으로 봐도 무방.

---

## 5️⃣ 성공 후 — Workflow 비활성화

ARM 인스턴스 잡혔다는 알림 받으면:

### 옵션 A: 자동 비활성화 (스크립트가 already_has_arm 체크)
- 다음 cron 실행 때 "ARM instance already exists" → silent skip
- 그냥 두면 매 15분 'skip' 로그만 남음 (무해)

### 옵션 B: 완전 비활성화 (Actions 비용 절약)
1. https://github.com/yuangunn/YGinvest/actions/workflows/try-arm-capacity.yml
2. 우상단 **... (점 3개)** → **Disable workflow**

언제든 ARM 인스턴스 삭제 후 다시 활성화 가능.

---

## 6️⃣ ARM 잡힌 후 마이그레이션

1. Console에서 새 ARM 인스턴스의 **Public IP** 확인
2. SSH 접속 (AMD 때 만든 SSH 키 동일하게 사용)
   ```bash
   ssh -i ~/oracle-yginvest.key ubuntu@<ARM_IP>
   ```
3. Docker + Git + Worker 셋업 (AMD 때랑 동일 절차)
4. AMD에서 .env 복사해 옮기기
5. Vercel WORKER_RPC_URL 새 IP로 변경
6. 1-2일 모니터링 후 AMD 종료

상세 절차는 `docs/ORACLE_MIGRATION.md` 6번 섹션 참고.

---

## 🚨 트러블슈팅

### "Invalid OCI config" 에러
- `OCI_PRIVATE_KEY`에 `-----BEGIN PRIVATE KEY-----`부터 `-----END PRIVATE KEY-----`까지 전부 포함됐는지 확인 (줄바꿈 포함)
- `OCI_FINGERPRINT` 형식: `aa:bb:cc:dd:...` (콜론 구분)

### "LimitExceeded" 즉시 에러
- 이미 ARM 인스턴스가 있는 상태 → workflow의 `already_has_arm` 체크 통과 못한 경우
- 또는 다른 region에서 이미 ARM 사용 중 (Free Tier 한도는 globally 4 OCPU + 24GB)
- Console에서 모든 인스턴스 확인 → 불필요한 것 제거

### "NotAuthenticated"
- API Key fingerprint 불일치
- Private key가 잘려서 secret에 들어갔는지 확인 (전체 PEM 복사)

### GitHub Actions cron이 안 돌아감
- Private repo는 30일간 활동 없으면 cron 자동 중지 됨 (GitHub 정책)
- 해결: 가끔 Actions 페이지 들어가서 수동 실행 또는 dummy commit
- Public repo는 무제한

---

## 💡 권장 운영

1. **AMD VM으로 일단 시작** (worker 운영 중)
2. **GitHub Actions auto-retry 켜놓기**
3. **본인 Telegram에 알림 받기** (즉시 인지)
4. **1-7일 안에 ARM 잡힘** → 마이그레이션 → AMD 종료

전체 비용 $0, downtime 거의 0.

---

## 📊 참고 — 인기 OSS 비교

| 도구 | 언어 | 알림 | 비고 |
|------|------|------|------|
| **이 스크립트** (간단) | Python | Telegram + Discord | OCI SDK 직접, ~150줄 |
| `hitrov/oci-arm-host-capacity` | Node.js | Telegram | 가장 인기, 풍부한 옵션 |
| `mohaibtech/oci-arm-host-capacity` | Python | Telegram | 작음, 본인 PC cron용 |

이 스크립트로 충분합니다. 문제 발생 시 GitHub Actions 로그 보면서 디버그.

---

## ✅ 체크리스트

OCI API Key 생성:
- [ ] Private Key 다운로드 (.pem)
- [ ] User OCID 메모
- [ ] Tenancy OCID 메모
- [ ] Fingerprint 메모
- [ ] Region 확인 (ap-seoul-1)

GitHub Secrets 등록:
- [ ] OCI_USER_OCID
- [ ] OCI_TENANCY_OCID
- [ ] OCI_REGION
- [ ] OCI_FINGERPRINT
- [ ] OCI_PRIVATE_KEY
- [ ] OCI_COMPARTMENT_ID
- [ ] OCI_SUBNET_ID
- [ ] OCI_IMAGE_OCID
- [ ] OCI_SSH_PUBLIC_KEY
- [ ] OCI_INSTANCE_NAME

GitHub Variables 등록:
- [ ] OCI_ARM_OCPUS (2 권장)
- [ ] OCI_ARM_MEMORY_GB (12 권장)
- [ ] OCI_ARM_BOOT_GB (50 권장)

(선택) 알림:
- [ ] TELEGRAM_BOT_TOKEN + CHAT_ID
- [ ] 또는 DISCORD_WEBHOOK_URL

활성화:
- [ ] Actions 페이지 → Try ARM Capacity → Run workflow (첫 시도)
- [ ] 로그 확인
- [ ] cron 자동 실행 대기
