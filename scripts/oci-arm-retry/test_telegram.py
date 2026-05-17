"""ARM 봇용 Telegram 알림 연결 테스트.
사용법: py -3 scripts/oci-arm-retry/test_telegram.py <BOT_TOKEN> <CHAT_ID>
"""

from __future__ import annotations

import io
import json
import sys
import urllib.request


def main() -> int:
    if len(sys.argv) != 3:
        print("Usage: test_telegram.py <BOT_TOKEN> <CHAT_ID>")
        return 2
    token, chat_id = sys.argv[1], sys.argv[2]

    # Windows console UTF-8 강제
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")

    text = (
        "\U0001F916 YGinvest ARM 자동 재시도 봇 연결 테스트\n\n"
        "✅ Telegram 알림 정상 작동\n"
        "\U0001F4CD Region: ap-chuncheon-1\n"
        "⚙️ Shape: VM.Standard.A1.Flex (2 OCPU / 12GB)\n"
        "⏰ 매 15분마다 ARM 인스턴스 생성 시도\n\n"
        "ARM 잡히면 이 채팅으로 즉시 알림 옵니다."
    )

    body = json.dumps({"chat_id": chat_id, "text": text}).encode("utf-8")
    req = urllib.request.Request(
        f"https://api.telegram.org/bot{token}/sendMessage",
        data=body,
        headers={"Content-Type": "application/json; charset=utf-8"},
    )
    try:
        resp = urllib.request.urlopen(req, timeout=10).read().decode("utf-8")
    except urllib.error.HTTPError as e:
        err_body = e.read().decode("utf-8", errors="replace")
        print(f"HTTPError {e.code}: {err_body}")
        return 1
    parsed = json.loads(resp)
    print(json.dumps(parsed, ensure_ascii=False, indent=2))
    return 0 if parsed.get("ok") else 1


if __name__ == "__main__":
    sys.exit(main())
