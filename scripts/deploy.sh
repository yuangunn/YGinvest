#!/usr/bin/env bash
# Plan #34: 통합 배포 스크립트.
#
# 실행 순서 (각 단계 실패 시 중단):
#  1. git push (현재 branch는 master 가정)
#  2. Supabase migration push
#  3. Vercel production deploy
#  4. Oracle Cloud worker 재배포 (SSH)
#
# 사용법: bash scripts/deploy.sh
# (Windows에서는 deploy.bat 사용 — 이 스크립트를 Git Bash로 호출)

set -e  # 에러 시 즉시 중단

# ───── 설정 ─────────────────────────────────────────────
ORACLE_HOST="${ORACLE_HOST:-168.110.114.1}"
ORACLE_USER="${ORACLE_USER:-ubuntu}"
ORACLE_KEY="${ORACLE_KEY:-$HOME/.ssh/oracle-yginvest.key}"
WEB_DIR="apps/web"

# 색상
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

log() { echo -e "${GREEN}[deploy]${NC} $1"; }
warn() { echo -e "${YELLOW}[deploy]${NC} $1"; }
err() { echo -e "${RED}[deploy]${NC} $1" >&2; }

# ───── 0. 현재 상태 확인 ─────────────────────────────────
log "0/4 사전 점검..."

BRANCH=$(git branch --show-current)
if [ "$BRANCH" != "master" ]; then
  err "현재 branch가 '$BRANCH' — master에서 실행해주세요"
  exit 1
fi

UNCOMMITTED=$(git status --porcelain | wc -l)
if [ "$UNCOMMITTED" -gt 0 ]; then
  warn "uncommitted 변경사항 있음:"
  git status --short
  read -p "그래도 진행? [y/N] " -n 1 -r
  echo
  [[ ! $REPLY =~ ^[Yy]$ ]] && exit 1
fi

# ───── 1. git push ──────────────────────────────────────
log "1/4 git push origin master..."
git push origin master

# ───── 2. Supabase migration push ─────────────────────
log "2/4 Supabase db push..."
if command -v supabase >/dev/null; then
  supabase db push --include-all
else
  warn "supabase CLI 없음 — 마이그레이션 건너뜀 (수동 적용 필요)"
fi

# ───── 3. Vercel production deploy ────────────────────
log "3/4 Vercel production deploy..."
(cd "$WEB_DIR" && vercel --prod --yes)

# ───── 4. Oracle worker 재배포 ─────────────────────────
log "4/4 Oracle worker 재배포..."
if [ ! -f "$ORACLE_KEY" ]; then
  err "Oracle SSH key 없음: $ORACLE_KEY"
  err "환경변수 ORACLE_KEY로 경로 지정 가능"
  exit 1
fi

ssh -i "$ORACLE_KEY" -o StrictHostKeyChecking=no "$ORACLE_USER@$ORACLE_HOST" bash <<'REMOTE_EOF'
set -e
cd ~/yginvest
git pull origin master
docker build -t yginvest-worker:latest . -f apps/worker/Dockerfile
docker stop yginvest-worker 2>/dev/null || true
docker rm yginvest-worker 2>/dev/null || true
docker run -d \
  --name yginvest-worker \
  --restart unless-stopped \
  --env-file ~/yginvest/.env.worker \
  -p 8787:8787 \
  yginvest-worker:latest
sleep 3
docker ps --filter name=yginvest-worker --format "{{.Status}}"
echo "[redeploy] worker 시작됨"
REMOTE_EOF

log "✅ 모두 완료"
echo
log "확인:"
echo "  - Web: https://yginvest.vercel.app"
echo "  - Worker logs: ssh -i $ORACLE_KEY $ORACLE_USER@$ORACLE_HOST 'docker logs --tail 50 yginvest-worker'"
