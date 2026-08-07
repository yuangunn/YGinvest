"""공유 yfinance 세션 — FD(파일 디스크립터) 누수 방지. Plan #48.

yfinance는 Ticker/download 호출마다 새 curl_cffi 세션을 만들고 절대 닫지 않는다:
    # yfinance/base.py, multi.py, scrapers/history.py
    self.session = session or requests.Session(impersonate="chrome")

fetch_prices(5분 cron) 등이 세션 없이 호출하면 매번 세션 = 열린 소켓/FD가 쌓여
2개월쯤 뒤 `OSError: [Errno 24] Too many open files`로 워커가 먹통이 된다
(2026-06-05 9일 장애의 실제 원인). 세션 1개를 재사용해 누수를 제거한다.

thread-safety: yfinance 자신이 `yf.download(threads=True)`에서 세션 1개를 여러
스레드에 공유하므로(multi.py), 이 공유 방식은 yfinance 기본 동작과 동일 안전성.
"""

from __future__ import annotations

from typing import Any

from curl_cffi import requests as _cffi_requests

_session: Any = None


def get_yf_session() -> Any:
    """프로세스당 하나의 curl_cffi 세션 (yfinance impersonate 기본과 동일)."""
    global _session
    if _session is None:
        _session = _cffi_requests.Session(impersonate="chrome")
    return _session
