# NXT Extended Trading Hours Implementation Plan (Phase A)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (chosen by user — inline) to implement this plan task-by-task.

**Goal:** KR 종목의 시장가 주문 가능 시간을 KRX 09:00–15:30에서 NXT 거래시간 08:00–20:00으로 확장 (사이 휴장 10분 두 구간 제외). 평일 저녁에도 KR 종목 거래 가능하게.

**Architecture:** `market_hours.py` (worker) + `lib/market-hours.ts` (web)에 NXT 세션을 추가한다. KRX 단독 함수는 유지하되 (`is_kr_market_open` legacy), 새 `is_kr_open_extended` / `getKrSession`이 NXT까지 포함한 12시간 거래시간을 표현. 주문 API의 `market_closed` 가드를 NXT 확장 hours로 갱신하고, 워커의 `fetch_prices` 게이팅을 NXT 시간으로 늘려 평일 저녁에도 가격 갱신. 가격 정확도는 v1.5 이후 — 현재는 KRX 종가를 NXT 시간에도 그대로 사용 (yfinance/FDR 한계).

**Tech Stack:** Python `zoneinfo`/`datetime`/`pandas_market_calendars` (worker), TypeScript `Intl.DateTimeFormat` (web).

---

## Scope (explicit limits)

In scope (Phase A):
- KR 시장가 주문 허용 시간 확장: 08:00–08:50, 09:00–15:20, 15:30–20:00 KST (휴장 10분 × 2 제외)
- 워커 `fetch_prices` 게이팅 확장 → 평일 08:00-20:00 KST에 KR 가격 갱신 (실제 가격은 KRX 종가 fallback)
- UI: 종목 상세 페이지에 현재 KR 세션 배지 ("프리마켓"/"정규장"/"애프터마켓"/"장 마감")
- 주말 + 공휴일은 그대로 휴장 (XKRX 캘린더 사용)

Out of scope (defer to v1.5+):
- 실제 NXT 가격 (KRX와 다른 spread) — yfinance/FDR API 한계
- 미드포인트(중간가) 주문 타입
- 스톱지정가 호가
- 메이커-테이커 수수료 모델 (현재 단일 수수료 유지)
- 800종목 화이트리스트 (우리 KR top 100은 모두 NXT 거래 가능)
- SOR (Smart Order Routing) 시뮬

---

## File Structure

### Worker
- `apps/worker/src/ygworker/market_hours.py` — `is_kr_open_extended`, `kr_session_label` 추가; `is_any_market_open`이 확장 hours 사용
- `apps/worker/tests/test_market_hours.py` — 신규 함수 테스트

### Web
- `apps/web/lib/market-hours.ts` — `isKrOpenAt`을 확장 hours로, `getKrSession` 헬퍼 추가
- `apps/web/components/kr-session-badge.tsx` — KR 종목 상세 페이지에 노출하는 작은 배지
- `apps/web/app/app/trade/[symbol]/page.tsx` — KR 종목일 때 배지 표시

### Docs
- `README.md` — Plan #7.5 완료 + NXT 운영 노트

---

## Task 1: 환경 점검 + branch

- [ ] **Step 1**

```bash
git branch --show-current  # plan-7-5-nxt-hours
supabase status            # 로컬 PG 확인용 (선택)
```

이 plan은 DB 변경 없음. supabase migration 필요 없음.

---

## Task 2: Worker market_hours.py — NXT 세션 정의 (TDD)

**Files:**
- Modify: `apps/worker/src/ygworker/market_hours.py`
- Modify: `apps/worker/tests/test_market_hours.py`

- [ ] **Step 1: 실패 테스트 (new functions만)**

`tests/test_market_hours.py`에 추가:

```python
from ygworker.market_hours import is_kr_open_extended, kr_session_label


@pytest.mark.parametrize(
    "ts_iso, expected",
    [
        # 프리마켓 08:00-08:50
        ("2026-05-11T08:00:00+09:00", True),
        ("2026-05-11T08:30:00+09:00", True),
        ("2026-05-11T08:49:00+09:00", True),
        ("2026-05-11T08:50:00+09:00", False),  # 휴장 시작 (08:50-09:00)
        ("2026-05-11T08:55:00+09:00", False),  # 휴장 중
        # 정규장 09:00-15:20
        ("2026-05-11T09:00:00+09:00", True),
        ("2026-05-11T12:00:00+09:00", True),
        ("2026-05-11T15:19:00+09:00", True),
        ("2026-05-11T15:20:00+09:00", False),  # 휴장 시작 (15:20-15:30)
        ("2026-05-11T15:25:00+09:00", False),
        # 애프터마켓 15:30-20:00
        ("2026-05-11T15:30:00+09:00", True),
        ("2026-05-11T18:00:00+09:00", True),
        ("2026-05-11T19:59:00+09:00", True),
        ("2026-05-11T20:00:00+09:00", False),  # 마감
        # 주말 + 공휴일은 모두 False
        ("2026-05-09T10:00:00+09:00", False),  # 토요일
        ("2026-05-10T18:00:00+09:00", False),  # 일요일
        # 07:59 — 프리마켓 전
        ("2026-05-11T07:59:00+09:00", False),
    ],
)
def test_is_kr_open_extended(ts_iso, expected):
    ts = datetime.fromisoformat(ts_iso)
    assert is_kr_open_extended(ts) is expected


@pytest.mark.parametrize(
    "ts_iso, expected",
    [
        ("2026-05-11T08:30:00+09:00", "pre"),
        ("2026-05-11T08:55:00+09:00", "closed"),    # 휴장
        ("2026-05-11T10:00:00+09:00", "regular"),
        ("2026-05-11T15:25:00+09:00", "closed"),    # 휴장
        ("2026-05-11T17:00:00+09:00", "after"),
        ("2026-05-11T21:00:00+09:00", "closed"),
        ("2026-05-09T10:00:00+09:00", "closed"),    # 토요일
    ],
)
def test_kr_session_label(ts_iso, expected):
    ts = datetime.fromisoformat(ts_iso)
    assert kr_session_label(ts) == expected
```

- [ ] **Step 2: RED 확인**

```bash
cd apps/worker && uv run pytest tests/test_market_hours.py -v
# Expected: ImportError on is_kr_open_extended / kr_session_label
```

- [ ] **Step 3: 구현**

`apps/worker/src/ygworker/market_hours.py` 수정:

```python
from datetime import datetime, time
from typing import Literal
from zoneinfo import ZoneInfo

import pandas_market_calendars as mcal

KST = ZoneInfo("Asia/Seoul")
ET = ZoneInfo("America/New_York")

_kr_cal = mcal.get_calendar("XKRX")
_us_cal = mcal.get_calendar("NYSE")

KrSession = Literal["pre", "regular", "after", "closed"]


def _is_session_day(cal, dt: datetime) -> bool:
    schedule = cal.schedule(start_date=dt.date(), end_date=dt.date())
    return not schedule.empty


def is_kr_market_open(ts: datetime) -> bool:
    """KRX 정규 운영 시간만: 평일 09:00-15:30 KST. (legacy — 사용 자제)"""
    local = ts.astimezone(KST)
    if not _is_session_day(_kr_cal, local):
        return False
    return time(9, 0) <= local.time() <= time(15, 30)


def kr_session_label(ts: datetime) -> KrSession:
    """현재 KR 세션. 'pre'(08:00-08:50) | 'regular'(09:00-15:20) |
    'after'(15:30-20:00) | 'closed' (휴장 또는 그 외 시간).

    NXT 거래시간 기준. KRX 정규장 09:00-15:30 vs NXT 메인마켓 09:00-15:20임에
    유의 (NXT는 KRX보다 10분 일찍 마감).
    """
    local = ts.astimezone(KST)
    if not _is_session_day(_kr_cal, local):
        return "closed"
    t = local.time()
    if time(8, 0) <= t < time(8, 50):
        return "pre"
    if time(9, 0) <= t < time(15, 20):
        return "regular"
    if time(15, 30) <= t < time(20, 0):
        return "after"
    return "closed"


def is_kr_open_extended(ts: datetime) -> bool:
    """KR 종목 거래 가능 여부 (NXT 포함 08:00-20:00 KST, 휴장 10분 × 2 제외)."""
    return kr_session_label(ts) != "closed"


def is_us_market_open(ts: datetime) -> bool:
    """NYSE/NASDAQ 09:30-16:00 ET."""
    local = ts.astimezone(ET)
    if not _is_session_day(_us_cal, local):
        return False
    return time(9, 30) <= local.time() <= time(16, 0)


def is_any_market_open(ts: datetime | None = None) -> bool:
    """KR (NXT 포함) 또는 US 장이 열려 있으면 True."""
    if ts is None:
        ts = datetime.now(tz=KST)
    return is_kr_open_extended(ts) or is_us_market_open(ts)
```

- [ ] **Step 4: GREEN 확인**

```bash
cd apps/worker && uv run pytest tests/test_market_hours.py -v
# Expected: 모든 새 테스트 PASS, 기존 6개 KR 테스트도 그대로 PASS
```

- [ ] **Step 5: 커밋**

```bash
git add apps/worker/src/ygworker/market_hours.py apps/worker/tests/test_market_hours.py
git commit -m "feat(worker): NXT extended hours (08:00-20:00 KR session detection)"
```

---

## Task 3: Web market-hours.ts — NXT 세션 + 주문 게이트 갱신

**Files:**
- Modify: `apps/web/lib/market-hours.ts`

- [ ] **Step 1: 함수 갱신 + 추가**

`apps/web/lib/market-hours.ts`를 다음으로 교체:

```typescript
// KR/US 장 운영 시간 판정. spec §6.3 + Plan #7.5 NXT.
// 휴장일 정확도는 워커의 pandas-market-calendars가 더 정확하지만
// 클라이언트/서버 즉시 판정이 필요해 간단한 요일 기반 체크.

export type MarketEnum = "KRX_KS" | "KRX_KQ" | "NASDAQ" | "NYSE";
export type KrSession = "pre" | "regular" | "after" | "closed";

function _kstParts(date: Date): { day: number; minutes: number } {
  // KST = UTC+9
  const kst = new Date(date.getTime() + 9 * 60 * 60 * 1000);
  return {
    day: kst.getUTCDay(), // 0=Sun, 6=Sat
    minutes: kst.getUTCHours() * 60 + kst.getUTCMinutes(),
  };
}

export function getKrSession(date: Date = new Date()): KrSession {
  const { day, minutes } = _kstParts(date);
  if (day === 0 || day === 6) return "closed";
  // 휴장 구간: 08:50-09:00 (530-540), 15:20-15:30 (920-930)
  if (minutes >= 8 * 60 && minutes < 8 * 60 + 50) return "pre";
  if (minutes >= 9 * 60 && minutes < 15 * 60 + 20) return "regular";
  if (minutes >= 15 * 60 + 30 && minutes < 20 * 60) return "after";
  return "closed";
}

export function isKrOpenAt(date: Date): boolean {
  return getKrSession(date) !== "closed";
}

export function isUsOpenAt(date: Date): boolean {
  const tz = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    hour: "numeric",
    minute: "numeric",
    hour12: false,
    weekday: "short",
  });
  const parts = tz.formatToParts(date);
  const weekday = parts.find((p) => p.type === "weekday")?.value;
  const hour = parseInt(parts.find((p) => p.type === "hour")?.value ?? "0", 10);
  const minute = parseInt(parts.find((p) => p.type === "minute")?.value ?? "0", 10);
  if (weekday === "Sat" || weekday === "Sun") return false;
  const total = hour * 60 + minute;
  return total >= 9 * 60 + 30 && total < 16 * 60;
}

export function isMarketOpenForSymbol(market: MarketEnum, when: Date = new Date()): boolean {
  if (market === "KRX_KS" || market === "KRX_KQ") return isKrOpenAt(when);
  if (market === "NASDAQ" || market === "NYSE") return isUsOpenAt(when);
  return false;
}
```

- [ ] **Step 2: 타입 + 빌드 + 커밋**

```bash
cd apps/web && npx tsc --noEmit && npm run lint
git add apps/web/lib/market-hours.ts
git commit -m "feat(web): NXT extended hours in isKrOpenAt + getKrSession helper"
```

---

## Task 4: UI — KR 세션 배지

**Files:**
- Create: `apps/web/components/kr-session-badge.tsx`
- Modify: `apps/web/app/app/trade/[symbol]/page.tsx`

- [ ] **Step 1: 배지 컴포넌트**

```tsx
// apps/web/components/kr-session-badge.tsx
"use client";

import { useEffect, useState } from "react";
import { getKrSession, type KrSession } from "@/lib/market-hours";

const LABELS: Record<KrSession, { text: string; tone: string }> = {
  pre: { text: "프리마켓", tone: "bg-amber-500/15 text-amber-700 dark:text-amber-300" },
  regular: { text: "정규장", tone: "bg-green-500/15 text-green-700 dark:text-green-300" },
  after: { text: "애프터마켓", tone: "bg-blue-500/15 text-blue-700 dark:text-blue-300" },
  closed: { text: "장 마감", tone: "bg-muted text-muted-foreground" },
};

export function KrSessionBadge() {
  // 클라이언트에서 1분마다 갱신
  const [session, setSession] = useState<KrSession>(() => getKrSession());

  useEffect(() => {
    const interval = setInterval(() => setSession(getKrSession()), 60_000);
    return () => clearInterval(interval);
  }, []);

  const { text, tone } = LABELS[session];
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${tone}`}
      title="NXT 거래시간 08:00–20:00 KST (휴장 10분 × 2 제외)"
    >
      {text}
    </span>
  );
}
```

- [ ] **Step 2: trade/[symbol]/page.tsx에 통합 (KR 종목만)**

`stock.currency === "KRW"`인 경우 종목 헤더에 배지 노출:

```tsx
import { KrSessionBadge } from "@/components/kr-session-badge";

// ... 헤더 부분:
<div className="flex items-start justify-between gap-3">
  <div>
    <div className="text-xs text-muted-foreground flex items-center gap-2">
      <span>{stock.symbol} · {stock.market}</span>
      {stock.currency === "KRW" && <KrSessionBadge />}
    </div>
    <h1 className="text-2xl font-bold">{symbolName}</h1>
  </div>
  <WatchlistButton symbol={stock.symbol} initialWatched={!!watch} />
</div>
```

- [ ] **Step 3: 빌드 + 커밋**

```bash
cd apps/web && npm run build && npx tsc --noEmit && npm run lint
git add apps/web/components/kr-session-badge.tsx apps/web/app/app/trade/[symbol]/page.tsx
git commit -m "feat(web): KrSessionBadge on KR stock detail (pre/regular/after/closed)"
```

---

## Task 5: README + 마무리

**Files:**
- Modify: `README.md`

- [ ] **Step 1: 진행 상태 추가**

Plan #7 다음에:

```markdown
### Plan #7.5 — NXT Extended Trading Hours ✅ 완료

- [x] `market_hours.py`: `is_kr_open_extended` + `kr_session_label` (pre 08:00–08:50, regular 09:00–15:20, after 15:30–20:00 KST)
- [x] `is_any_market_open`이 NXT 시간 사용 → 워커 `fetch_prices`가 평일 08:00–20:00 KST에 KR 가격 갱신
- [x] `apps/web/lib/market-hours.ts` `isKrOpenAt`을 NXT 시간으로 확장 + `getKrSession` 헬퍼
- [x] `/api/orders` POST의 `market_closed` 가드가 NXT 시간 따름 → 평일 저녁 KR 시장가 주문 가능
- [x] `KrSessionBadge` 종목 상세 헤더에 노출 (KR 종목만, 1분마다 갱신)
- [x] 테스트: 워커 +23 case (parametrized: extended 16 + label 7) + 기존 6 그대로 통과 = **누적 140+ PASS**

NOTE: 실제 NXT 가격은 시뮬 안 함 (yfinance/FDR이 NXT 별도 시세 미제공). 시간만 확장, 가격은 KRX 최종 종가 사용. 정확한 NXT 가격 시뮬은 v1.5에서 spread 노이즈로.
```

- [ ] **Step 2: 디버깅 팁**

```markdown
- **NXT 시간인데 시장가 거부**: 1) 휴장 10분 (08:50-09:00, 15:20-15:30) 회피 2) `price_stale` — 워커가 fetch_prices를 못 돌리면 가격이 30분 stale. 워커 health 확인
- **KrSessionBadge가 한국시간과 안 맞음**: 클라 timezone과 서버 timezone 차이. 배지는 클라 `Date()` 기준이라 사용자 디바이스의 시간 설정 따름
```

- [ ] **Step 3: 커밋**

```bash
git add README.md
git commit -m "docs: Plan #7.5 (NXT extended hours) completion"
```

---

## 마무리 검증

- [ ] 워커 단위 테스트: 새 23개 case PASS (parametrized: extended_open 16 + session_label 7)
- [ ] 빌드/lint/tsc: clean
- [ ] 수동 검증:
  - 평일 08:30 KST → 시장가 매수 KR 종목 OK
  - 평일 19:00 KST → 시장가 매수 KR 종목 OK
  - 평일 08:55 KST → 422 `market_closed` (휴장 10분)
  - 토요일 12:00 KST → 422 `market_closed`
  - 종목 상세 페이지에 현재 세션 배지 보임

---

## Plan #7.5 포함되지 않은 것 (defer)

| 항목 | 처리 |
|------|------|
| NXT 가격 spread 시뮬 | v1.5 (KRX 종가 ± 0.1% 노이즈) |
| 미드포인트 호가 | v2 (호가창이 없으니 시뮬 부정확) |
| 스톱지정가 | v2 |
| 메이커-테이커 수수료 | v2 |
| 800종목 화이트리스트 | 무시 — 우리 top 100은 모두 포함 |
| SOR 시뮬 | v2 |
