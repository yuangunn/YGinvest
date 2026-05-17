#!/usr/bin/env bash
# Plan #34: Oracle VM 초기 셋업 + ~/redeploy.sh 재생성.
#
# 이 스크립트는 Oracle VM 안에서 실행. SSH 접속 후:
#   curl -fsSL https://raw.githubusercontent.com/yuangunn/YGinvest/master/scripts/bootstrap-oracle-vm.sh | bash
# 또는 로컬에서 복사 후 실행:
#   scp -i ~/.ssh/oracle-yginvest.key scripts/bootstrap-oracle-vm.sh ubuntu@168.110.114.1:~/
#   ssh -i ~/.ssh/oracle-yginvest.key ubuntu@168.110.114.1 'bash ~/bootstrap-oracle-vm.sh'

set -e

cd ~

# yginvest 디렉토리 없으면 clone
if [ ! -d ~/yginvest ]; then
  echo "[bootstrap] yginvest repo clone..."
  git clone https://github.com/yuangunn/YGinvest.git yginvest
else
  echo "[bootstrap] yginvest 디렉토리 존재 — pull"
  cd ~/yginvest && git pull origin master && cd ~
fi

# ~/redeploy.sh 재생성
cat > ~/redeploy.sh <<'REDEPLOY_EOF'
#!/usr/bin/env bash
# Oracle VM worker 재배포 — 수동 실행용 (deploy.sh가 자동 호출하기도 함).
set -e
cd ~/yginvest
git pull origin master

echo "[redeploy] docker build..."
docker build -t yginvest-worker:latest . -f apps/worker/Dockerfile

echo "[redeploy] container 재시작..."
docker stop yginvest-worker 2>/dev/null || true
docker rm yginvest-worker 2>/dev/null || true

# .env.worker 파일이 ~/yginvest/.env.worker에 있어야 함 (Supabase URL/KEY 등)
if [ ! -f ~/yginvest/.env.worker ]; then
  echo "[redeploy] WARNING: ~/yginvest/.env.worker 없음 — 환경변수 직접 전달 필요"
fi

docker run -d \
  --name yginvest-worker \
  --restart unless-stopped \
  --env-file ~/yginvest/.env.worker \
  -p 8787:8787 \
  yginvest-worker:latest

sleep 3
echo "[redeploy] container status:"
docker ps --filter name=yginvest-worker --format "{{.Status}}"
echo "[redeploy] 완료 — docker logs -f yginvest-worker 로 로그 확인"
REDEPLOY_EOF

chmod +x ~/redeploy.sh
echo "[bootstrap] ~/redeploy.sh 재생성 완료"

# 첫 실행
if [ -f ~/yginvest/.env.worker ]; then
  echo "[bootstrap] 첫 redeploy 실행..."
  ~/redeploy.sh
else
  echo ""
  echo "[bootstrap] ⚠️ .env.worker가 없습니다. 다음을 만든 후 ~/redeploy.sh를 실행하세요:"
  echo "    nano ~/yginvest/.env.worker"
  echo "    (SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, RPC_SECRET 등)"
fi
