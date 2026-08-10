#!/usr/bin/env python3
"""Supabase 쿼리 지연 측정 — Vercel 리전 이전 효과를 수치로 확인.

배경 (Plan #49): Vercel 함수는 iad1(미국 버지니아), Supabase는 ap-northeast-2(서울).
웹앱의 모든 쿼리가 태평양을 왕복한다. 페이지들은 쿼리를 *순차* 실행하므로
왕복 지연 × 쿼리 수 만큼 느려진다.

이 스크립트는 portfolio/overview 페이지의 쿼리 시퀀스를 그대로 재현해
1회 왕복 비용과 순차 총합을 잰다. **미국에서 한 번, 서울에서 한 번** 돌려
비교하면 리전 이전의 기대 효과가 그대로 나온다.

사용법:
    SUPABASE_URL=https://xxx.supabase.co SUPABASE_ANON_KEY=<publishable> \
        python3 scripts/measure_db_latency.py

    # 서울(Oracle VM)에서:
    ssh ubuntu@<VM> 'SUPABASE_URL=... SUPABASE_ANON_KEY=... python3 -' < scripts/measure_db_latency.py

anon(publishable) 키는 클라이언트 번들에 포함되는 공개 키다 — 비밀이 아니다.
"""

from __future__ import annotations

import os
import statistics
import sys
import time
import urllib.request

ROUNDS = int(os.environ.get("ROUNDS", "7"))
TIMEOUT = 20

# portfolio/overview 페이지가 실제로 실행하는 순차 쿼리들.
# (holdings/portfolios 는 RLS로 익명에겐 빈 결과지만 왕복 비용은 동일하게 발생)
QUERIES = [
    ("auth_getuser", "/auth/v1/user"),
    ("portfolios", "/rest/v1/portfolios?select=id&limit=1"),
    ("portfolio_row", "/rest/v1/portfolios?select=id,krw_balance&limit=1"),
    ("fx_rates", "/rest/v1/fx_rates?select=rate&base=eq.USD&quote=eq.KRW"
                 "&order=ts.desc&limit=1"),
    ("holdings", "/rest/v1/holdings?select=symbol,quantity&limit=1"),
]


def _get(url: str, headers: dict[str, str]) -> float:
    """요청 1건의 왕복 시간(ms). 실패해도 왕복은 발생하므로 시간은 유효."""
    req = urllib.request.Request(url, headers=headers, method="GET")
    t0 = time.perf_counter()
    try:
        urllib.request.urlopen(req, timeout=TIMEOUT).read()
    except Exception:
        pass  # 401/404 여도 왕복 지연 자체는 측정됨
    return (time.perf_counter() - t0) * 1000


def main() -> int:
    base = os.environ.get("SUPABASE_URL", "").rstrip("/")
    key = os.environ.get("SUPABASE_ANON_KEY", "").strip()
    if not base or not key:
        print("FATAL: SUPABASE_URL / SUPABASE_ANON_KEY 필요", file=sys.stderr)
        return 2

    headers = {"apikey": key, "Authorization": f"Bearer {key}"}

    print(f"측정 대상: {base}")
    print(f"라운드: {ROUNDS} (첫 라운드는 연결 워밍업이라 제외)\n")

    per_query: dict[str, list[float]] = {name: [] for name, _ in QUERIES}
    totals: list[float] = []

    for r in range(ROUNDS):
        chain = 0.0
        for name, path in QUERIES:
            ms = _get(base + path, headers)
            chain += ms
            if r > 0:  # 워밍업 제외
                per_query[name].append(ms)
        if r > 0:
            totals.append(chain)

    print(f"{'쿼리':<16} {'p50(ms)':>9} {'최소':>8} {'최대':>8}")
    print("-" * 45)
    for name, _ in QUERIES:
        s = per_query[name]
        if not s:
            continue
        print(f"{name:<16} {statistics.median(s):>9.0f} {min(s):>8.0f} {max(s):>8.0f}")

    print("-" * 45)
    if totals:
        print(f"{'순차 총합':<16} {statistics.median(totals):>9.0f} "
              f"{min(totals):>8.0f} {max(totals):>8.0f}")
        print(f"\n→ 이 페이지 1회 로드에 DB 대기만 약 "
              f"{statistics.median(totals):.0f}ms")
    return 0


if __name__ == "__main__":
    sys.exit(main())
