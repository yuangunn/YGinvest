#!/usr/bin/env bash
# Plan #47: Oracle VM의 ~/yginvest/.env.worker 에 ANTHROPIC_API_KEY 추가 후 worker 재배포.
#
# 사용법:
#   bash scripts/oci-arm-retry/install_anthropic_key.sh <KEY>
# 또는 환경변수로:
#   ANTHROPIC_API_KEY=sk-ant-... bash scripts/oci-arm-retry/install_anthropic_key.sh
#
# 키 값은 절대 로그에 노출되지 않음 — 마스킹 처리.

set -e

ORACLE_HOST="${ORACLE_HOST:-168.110.114.1}"
ORACLE_USER="${ORACLE_USER:-ubuntu}"
ORACLE_KEY="${ORACLE_KEY:-$HOME/.ssh/oracle-yginvest.key}"

KEY="${1:-${ANTHROPIC_API_KEY:-}}"
if [ -z "$KEY" ]; then
  echo "[FATAL] ANTHROPIC_API_KEY 가 비어있음. 인자로 전달하거나 환경변수로 설정해주세요."
  exit 2
fi

# 형식 sanity check (sk-ant-... 로 시작해야 함)
if [[ ! "$KEY" =~ ^sk-ant- ]]; then
  echo "[FATAL] 잘못된 키 형식. Anthropic API 키는 'sk-ant-' 로 시작합니다."
  exit 2
fi

echo "[install] Oracle VM에 ANTHROPIC_API_KEY 추가 중..."
echo "[install] Host: $ORACLE_HOST"
echo "[install] Key prefix: ${KEY:0:15}... (마스킹됨)"

# SSH로 실행:
#  1) 기존 ANTHROPIC_API_KEY 라인 있으면 제거
#  2) 새 키 추가
#  3) chmod 600
#  4) worker 재시작
ssh -i "$ORACLE_KEY" -o StrictHostKeyChecking=no "$ORACLE_USER@$ORACLE_HOST" \
  bash -s -- "$KEY" <<'REMOTE_EOF'
set -e
KEY="$1"
ENV_FILE="$HOME/yginvest/.env.worker"
if [ ! -f "$ENV_FILE" ]; then
  echo "[remote] $ENV_FILE 없음 — fatal"
  exit 3
fi
# 기존 라인 제거
grep -v '^ANTHROPIC_API_KEY=' "$ENV_FILE" > "$ENV_FILE.tmp" || true
echo "ANTHROPIC_API_KEY=$KEY" >> "$ENV_FILE.tmp"
mv "$ENV_FILE.tmp" "$ENV_FILE"
chmod 600 "$ENV_FILE"
echo "[remote] .env.worker 갱신 완료 (현재 라인 수: $(wc -l < "$ENV_FILE"))"
echo "[remote] worker 재배포 시작..."
bash "$HOME/redeploy.sh"
REMOTE_EOF

echo "[install] 완료. 워커가 새 env로 재시작됨."
echo ""
echo "다음 단계:"
echo "  1) docker logs --tail 20 yginvest-worker (Oracle VM에서)"
echo "  2) 수동 실행: SSH로 접속 후 inside container python -c 'from ygworker.jobs.daily_market_briefing import run_daily_market_briefing; ...'"
echo "  3) 또는 06:30 KST cron 대기"
