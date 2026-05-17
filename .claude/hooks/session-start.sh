#!/usr/bin/env bash
# Plan #46.1: SessionStart hook — 컴팩션이 일어나도 살아남는 인프라 한 줄 요약을
# 매 세션마다 system context에 주입. AGENTS.md와 이중 안전망 역할.
#
# 호출: Claude Code의 SessionStart 이벤트 (settings.json hooks 등록 필요).
# 입력: stdin으로 JSON (사용 안 함)
# 출력: JSON { hookSpecificOutput: { hookEventName: "SessionStart", additionalContext: "..." } }

set -e

# heredoc으로 멀티라인 텍스트 작성 후 jq로 안전하게 JSON 인코딩.
read -r -d '' CONTEXT <<'EOF' || true
🚀 YGinvest 인프라 즉시 참고 (컴팩션 무관, 매 세션 자동 로드)

배포 진실의 단일 출처:
- 웹: Vercel (apps/web) — `cd apps/web && vercel --prod --yes`
- 워커: Oracle Cloud AMD VM (168.110.114.1) — Railway 아님 (#34 이주 완료)
  - 재배포: `ssh -i ~/.ssh/oracle-yginvest.key ubuntu@168.110.114.1 'bash ~/redeploy.sh'`
- DB: Supabase Cloud — `supabase db push --linked`
- 통합 배포: `bash scripts/deploy.sh`

진행 중 백그라운드 작업:
- ARM 자동 재시도 봇 (Plan #46): ap-chuncheon-1에서 ARM 잡으려 매 15분 시도 중.
  Telegram @ARM_try_bot으로 알림. 잡히면 docs/ARM_MIGRATION_TODO.md 따라 진행.
  봇 #2 (워커 모니터링), 봇 #3 (AI 분석) 계획도 그 문서에 있음.

⚠️ 배포/인프라 작업 시 AGENTS.md 먼저 읽기. README의 일부 표현은 outdated일 수 있음.
상세: docs/ORACLE_MIGRATION.md / docs/ARM_AUTO_RETRY.md / docs/ARM_MIGRATION_TODO.md
EOF

# jq 있으면 사용, 없으면 수동 escape (Windows Git Bash에선 jq 없을 수 있음).
if command -v jq >/dev/null 2>&1; then
  printf '%s' "$CONTEXT" | jq -Rs '{
    hookSpecificOutput: {
      hookEventName: "SessionStart",
      additionalContext: .
    }
  }'
else
  # 수동 escape: backslash, double quote, newline.
  ESCAPED=$(printf '%s' "$CONTEXT" | sed 's/\\/\\\\/g; s/"/\\"/g' | awk 'BEGIN{ORS="\\n"} {print}')
  # 마지막 trailing \n 제거.
  ESCAPED="${ESCAPED%\\n}"
  printf '{"hookSpecificOutput":{"hookEventName":"SessionStart","additionalContext":"%s"}}\n' "$ESCAPED"
fi
