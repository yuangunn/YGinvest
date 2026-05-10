# YGinvest Plan #4 — Trading UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 종목 상세 페이지에 일봉 캔들 차트 + MA 지표를 띄우고, 매수/매도를 모바일 친화적 BottomSheet으로 받으며, 사용자가 관심종목을 등록·관리할 수 있다.

**Architecture:** Lightweight Charts(TradingView 무료)로 캔들 차트 + MA20/MA60 라인을 그린다. 일봉 OHLCV는 워커가 매일 1회 FDR로 fetch해 `stock_bars` 테이블에 저장. 차트는 DB에서 직접 SELECT(공개 RLS). BottomSheet는 shadcn `Sheet` 컴포넌트 위에 OrderForm을 얹은 wrapper. 관심종목은 `watchlists` 테이블 + 토글 버튼.

**Tech Stack 추가:** lightweight-charts (npm) · shadcn Sheet 컴포넌트 · 기존 FDR로 일봉 fetch

---

## 사전 요구사항

- Plan #1-3 완료 (master 머지됨, 클라우드 배포됨)
- 로컬 Supabase + Docker 가동
- 워커 가동 가능

---

## v1 스코프 결정

스펙 §10 차트는 "C 풀스펙(15m/1h/1d + RSI/MACD/볼린저 + 뉴스 + 재무)"이지만 Plan #4 v1은 **일봉 + MA만** 다룬다. 나머지는 v1.5(Plan #4.5).

**Plan #4 v1 (이 문서)**:
- 일봉 OHLCV 차트 (Lightweight Charts)
- MA20 + MA60 지표 (클라이언트 계산)
- 매수/매도 BottomSheet (shadcn Sheet)
- 관심종목 (watchlists 테이블 + 토글 + 목록 페이지)

**v1.5 (별도 plan)**:
- 15분/1시간 봉
- RSI / MACD / 볼린저 밴드
- 뉴스 (yfinance Ticker.news)
- 재무제표 요약 (yfinance Ticker.financials)
- 포트폴리오 overview (자산 배분 파이차트, 누적 수익률)

이렇게 분리하는 이유: 일봉은 FDR로 한 번에 fetch 가능(빠름), 인트라데이는 별도 fetch 패턴 필요. 뉴스/재무는 외부 API(yfinance) rate limit 영향. 분리해야 v1 deliverable이 명확.

---

## 파일 구조 (이 plan에서 추가/수정)

```
supabase/migrations/
  20260510030001_stock_bars.sql                     (NEW)
  20260510030002_watchlists.sql                     (NEW)

apps/worker/
  src/ygworker/
    data_sources/fdr.py                              (MODIFY: fetch_daily_history 추가)
    jobs/fetch_daily_bars.py                         (NEW)
    main.py                                          (MODIFY: fetch_daily_bars 스케줄)
  tests/
    test_data_sources_fdr.py                         (MODIFY: fetch_daily_history 테스트)
    test_jobs_fetch_daily_bars.py                    (NEW)

apps/web/
  app/api/
    stocks/[symbol]/bars/route.ts                    (NEW: GET 일봉 데이터)
    watchlist/route.ts                               (NEW: GET 목록)
    watchlist/[symbol]/route.ts                      (NEW: POST add, DELETE remove)
  app/app/
    trade/[symbol]/page.tsx                          (MODIFY: Chart + Watchlist + Sheet)
    watchlist/page.tsx                               (NEW)
    dashboard/page.tsx                               (MODIFY: 관심종목 링크 추가)
  components/
    ui/sheet.tsx                                     (NEW: shadcn add)
    stock-chart.tsx                                  (NEW: Lightweight Charts wrapper)
    buy-sell-sheet.tsx                               (NEW: Sheet + OrderForm)
    watchlist-button.tsx                             (NEW: 토글 add/remove)
  package.json                                        (MODIFY: lightweight-charts 추가)
  tests/e2e/
    watchlist.spec.ts                                (NEW)

README.md                                            (MODIFY: Plan #4 진행상태)
```

각 파일의 책임:
- `stock_bars` 테이블 — 일봉 OHLCV 시계열, `(symbol, ts)` PK, RLS public read
- `watchlists` — 사용자별 관심종목, 토글로 추가/삭제
- `fetch_daily_bars` 잡 — 매일 KR 마감(16:00 KST) + US 마감(07:00 KST) 후 active 종목들 일봉 수집 (~1년치)
- `stock-chart.tsx` — props로 OHLCV 받아 Lightweight Charts 캔들 + MA20/MA60 오버레이 렌더
- `buy-sell-sheet.tsx` — Sheet 트리거 버튼 + 안에 OrderForm 재사용
- `watchlist-button.tsx` — 종목 상세에서 ★ 토글, 현재 상태에 따라 add/remove

---

## Task 1: 환경 점검

- [ ] **Step 1: 브랜치 + 워커 + DB 확인**

```bash
git branch --show-current   # plan-4-trading-ui
supabase status            # running
curl -s http://localhost:8080/health   # {"ok":true} (워커 가동 시)
```

워커 안 떠있으면 `cd apps/worker && PYTHONPATH=src PYTHONUTF8=1 uv run python -m ygworker.main`

---

## Task 2: Migration — stock_bars 테이블

**Files:**
- Create: `supabase/migrations/20260510030001_stock_bars.sql`

- [ ] **Step 1: 마이그레이션 작성**

```sql
create table public.stock_bars (
  symbol text not null references public.stocks(symbol) on delete cascade,
  interval text not null check (interval in ('15m', '1h', '1d')),
  ts timestamptz not null,
  open numeric(20,4) not null,
  high numeric(20,4) not null,
  low numeric(20,4) not null,
  close numeric(20,4) not null,
  volume bigint not null default 0,
  primary key (symbol, interval, ts)
);

create index stock_bars_symbol_interval_ts_idx
  on public.stock_bars (symbol, interval, ts desc);

-- RLS: 누구나 읽기 (가격 데이터 공개), 쓰기는 service_role만
alter table public.stock_bars enable row level security;

create policy "stock_bars: 누구나 읽기"
  on public.stock_bars for select
  to anon, authenticated
  using (true);

comment on table public.stock_bars is '시계열 OHLCV. v1은 일봉(1d)만, 인트라데이는 v1.5에서 추가';
```

- [ ] **Step 2: 적용**

```bash
supabase db reset
```

- [ ] **Step 3: 커밋**

```bash
git add supabase/migrations/20260510030001_stock_bars.sql
git commit -m "feat(db): add stock_bars table (OHLCV time-series)"
```

---

## Task 3: Migration — watchlists 테이블

**Files:**
- Create: `supabase/migrations/20260510030002_watchlists.sql`

- [ ] **Step 1: 마이그레이션 작성**

```sql
create table public.watchlists (
  portfolio_id uuid not null references public.portfolios(id) on delete cascade,
  symbol text not null references public.stocks(symbol) on delete cascade,
  added_at timestamptz not null default now(),
  primary key (portfolio_id, symbol)
);

create index watchlists_portfolio_idx on public.watchlists (portfolio_id, added_at desc);

alter table public.watchlists enable row level security;

create policy "watchlists: 본인 읽기"
  on public.watchlists for select
  to authenticated
  using (
    portfolio_id in (select id from public.portfolios where user_id = auth.uid())
  );

create policy "watchlists: 본인 추가"
  on public.watchlists for insert
  to authenticated
  with check (
    portfolio_id in (select id from public.portfolios where user_id = auth.uid())
  );

create policy "watchlists: 본인 삭제"
  on public.watchlists for delete
  to authenticated
  using (
    portfolio_id in (select id from public.portfolios where user_id = auth.uid())
  );

comment on table public.watchlists is '사용자별 관심종목. 포트폴리오 단위(글로벌+방).';
```

- [ ] **Step 2: 적용 + 커밋**

```bash
supabase db reset
git add supabase/migrations/20260510030002_watchlists.sql
git commit -m "feat(db): add watchlists table with RLS (own portfolio CRUD)"
```

---

## Task 4: Worker — FDR fetch_daily_history 함수 (TDD)

**Files:**
- Modify: `apps/worker/src/ygworker/data_sources/fdr.py`
- Modify: `apps/worker/tests/test_data_sources_fdr.py`

기존 fdr.py에 `fetch_daily_history(symbol, days)` 함수 추가. FDR.DataReader는 시작날짜만 받으므로 days를 빼서 시작일 계산.

- [ ] **Step 1: 실패 테스트 추가**

`apps/worker/tests/test_data_sources_fdr.py` 끝에 추가:

```python
@patch("ygworker.data_sources.fdr.fdr.DataReader")
def test_fetch_daily_history_returns_ohlcv_list(mock_reader):
    # FDR.DataReader는 DataFrame 반환
    df = pd.DataFrame(
        {
            "Open": [100.0, 102.0, 105.0],
            "High": [103.0, 106.0, 108.0],
            "Low": [99.0, 101.0, 104.0],
            "Close": [102.0, 105.0, 107.0],
            "Volume": [1_000_000, 1_200_000, 1_500_000],
        },
        index=pd.to_datetime(["2026-05-08", "2026-05-09", "2026-05-12"]),
    )
    mock_reader.return_value = df

    bars = fetch_daily_history("AAPL", days=10)

    assert len(bars) == 3
    assert bars[0]["ts"].isoformat().startswith("2026-05-08")
    assert bars[0]["open"] == 100.0
    assert bars[0]["high"] == 103.0
    assert bars[0]["low"] == 99.0
    assert bars[0]["close"] == 102.0
    assert bars[0]["volume"] == 1_000_000


@patch("ygworker.data_sources.fdr.fdr.DataReader")
def test_fetch_daily_history_returns_empty_on_no_data(mock_reader):
    mock_reader.return_value = pd.DataFrame()
    assert fetch_daily_history("INVALID", days=10) == []


@patch("ygworker.data_sources.fdr.fdr.DataReader")
def test_fetch_daily_history_skips_nan_rows(mock_reader):
    df = pd.DataFrame(
        {
            "Open": [100.0, float("nan"), 105.0],
            "High": [103.0, 106.0, 108.0],
            "Low": [99.0, 101.0, 104.0],
            "Close": [102.0, 105.0, 107.0],
            "Volume": [1_000_000, 1_200_000, 1_500_000],
        },
        index=pd.to_datetime(["2026-05-08", "2026-05-09", "2026-05-12"]),
    )
    mock_reader.return_value = df

    bars = fetch_daily_history("AAPL", days=10)
    # 가운데 NaN 행은 누락
    assert len(bars) == 2
    assert bars[0]["close"] == 102.0
    assert bars[1]["close"] == 107.0
```

상단 import에 `from ygworker.data_sources.fdr import KrListingItem, fetch_daily_history, fetch_us_close, list_kr_top` 등 ensure.

- [ ] **Step 2: 테스트 실패 확인 후 구현**

`apps/worker/src/ygworker/data_sources/fdr.py`에 함수 추가:

```python
from datetime import date, timedelta


@retry(stop=stop_after_attempt(2), wait=wait_exponential(multiplier=0.5, min=0.5, max=2))
def fetch_daily_history(symbol: str, days: int = 365) -> list[dict]:
    """심볼의 일봉 OHLCV를 days일 만큼 가져온다.

    Returns: list of dicts with keys (ts, open, high, low, close, volume).
    NaN이 있는 행은 제외.
    """
    start = (date.today() - timedelta(days=days)).strftime("%Y-%m-%d")
    df = fdr.DataReader(symbol, start)
    if df is None or df.empty:
        return []

    out: list[dict] = []
    for idx, row in df.iterrows():
        # NaN 행은 스킵
        values = [row.get(k) for k in ("Open", "High", "Low", "Close", "Volume")]
        if any(_is_nan(v) for v in values):
            continue
        try:
            out.append(
                {
                    "ts": idx.to_pydatetime() if hasattr(idx, "to_pydatetime") else idx,
                    "open": float(row["Open"]),
                    "high": float(row["High"]),
                    "low": float(row["Low"]),
                    "close": float(row["Close"]),
                    "volume": int(row["Volume"]),
                }
            )
        except (ValueError, TypeError):
            continue
    return out
```

- [ ] **Step 3: 테스트 통과 확인**

```bash
cd apps/worker
uv run pytest tests/test_data_sources_fdr.py -v
```
Expected: 7 PASS (기존 4 + 새 3)

- [ ] **Step 4: 커밋**

```bash
git add apps/worker/src/ygworker/data_sources/fdr.py apps/worker/tests/test_data_sources_fdr.py
git commit -m "feat(worker): add fetch_daily_history to FDR adapter (TDD, 3 tests)"
```

---

## Task 5: Worker — fetch_daily_bars 잡 (TDD)

**Files:**
- Create: `apps/worker/src/ygworker/jobs/fetch_daily_bars.py`
- Create: `apps/worker/tests/test_jobs_fetch_daily_bars.py`

is_active=true인 stocks 전체에 대해 fetch_daily_history를 호출, stock_bars에 upsert.

- [ ] **Step 1: 실패 테스트 작성**

```python
from datetime import datetime, UTC
from unittest.mock import MagicMock, patch

from ygworker.jobs.fetch_daily_bars import run_fetch_daily_bars


@patch("ygworker.jobs.fetch_daily_bars.fetch_daily_history")
def test_fetch_daily_bars_inserts_bars_per_stock(mock_history):
    fake = MagicMock()
    fake.table.return_value.select.return_value.eq.return_value.execute.return_value.data = [
        {"symbol": "AAPL"},
        {"symbol": "005930.KS"},
    ]
    mock_history.side_effect = [
        [
            {"ts": datetime(2026, 5, 8, tzinfo=UTC), "open": 100, "high": 105, "low": 99, "close": 102, "volume": 1000},
            {"ts": datetime(2026, 5, 9, tzinfo=UTC), "open": 102, "high": 108, "low": 101, "close": 107, "volume": 1500},
        ],
        [
            {"ts": datetime(2026, 5, 8, tzinfo=UTC), "open": 70000, "high": 72000, "low": 69000, "close": 71000, "volume": 500},
        ],
    ]
    logger = MagicMock()

    run_fetch_daily_bars(fake, logger)

    upsert_calls = fake.table.return_value.upsert.call_args_list
    inserted = []
    for call in upsert_calls:
        records = call.args[0] if call.args else []
        inserted.extend(records)
    assert len(inserted) == 3
    # 모두 interval='1d' 포함
    assert all(r["interval"] == "1d" for r in inserted)


@patch("ygworker.jobs.fetch_daily_bars.fetch_daily_history")
def test_fetch_daily_bars_handles_no_active_symbols(mock_history):
    fake = MagicMock()
    fake.table.return_value.select.return_value.eq.return_value.execute.return_value.data = []
    logger = MagicMock()

    run_fetch_daily_bars(fake, logger)

    mock_history.assert_not_called()
    logger.info.assert_called_with("fetch_daily_bars.skip", reason="no_active_symbols")


@patch("ygworker.jobs.fetch_daily_bars.fetch_daily_history")
def test_fetch_daily_bars_continues_on_per_symbol_failure(mock_history):
    fake = MagicMock()
    fake.table.return_value.select.return_value.eq.return_value.execute.return_value.data = [
        {"symbol": "AAPL"},
        {"symbol": "BAD"},
    ]
    mock_history.side_effect = [
        [{"ts": datetime(2026, 5, 9, tzinfo=UTC), "open": 100, "high": 105, "low": 99, "close": 102, "volume": 1000}],
        RuntimeError("network error"),
    ]
    logger = MagicMock()

    run_fetch_daily_bars(fake, logger)

    # AAPL 1행만 upsert. BAD는 skip
    upsert_calls = fake.table.return_value.upsert.call_args_list
    inserted = []
    for call in upsert_calls:
        records = call.args[0] if call.args else []
        inserted.extend(records)
    assert len(inserted) == 1
    assert inserted[0]["symbol"] == "AAPL"
    logger.warning.assert_called()  # BAD 실패 로그
```

- [ ] **Step 2: 구현**

```python
from typing import Any

from ygworker.data_sources.fdr import fetch_daily_history


def run_fetch_daily_bars(supabase: Any, logger: Any, days: int = 365) -> None:
    """is_active 종목 전체의 일봉 OHLCV를 fetch + upsert.

    매일 KR 장 마감 후(16:00 KST) + US 장 마감 후(07:00 KST) 1회씩 호출 권장.
    """
    rows = (
        supabase.table("stocks")
        .select("symbol")
        .eq("is_active", True)
        .execute()
        .data
    )
    symbols = [r["symbol"] for r in rows]
    if not symbols:
        logger.info("fetch_daily_bars.skip", reason="no_active_symbols")
        return

    logger.info("fetch_daily_bars.start", count=len(symbols), days=days)
    total_inserted = 0
    failed = 0

    for sym in symbols:
        try:
            bars = fetch_daily_history(sym, days=days)
        except Exception as exc:
            logger.warning("fetch_daily_bars.failed", symbol=sym, error=str(exc))
            failed += 1
            continue
        if not bars:
            continue

        records = [
            {
                "symbol": sym,
                "interval": "1d",
                "ts": b["ts"].isoformat() if hasattr(b["ts"], "isoformat") else b["ts"],
                "open": b["open"],
                "high": b["high"],
                "low": b["low"],
                "close": b["close"],
                "volume": b["volume"],
            }
            for b in bars
        ]
        try:
            supabase.table("stock_bars").upsert(records, on_conflict="symbol,interval,ts").execute()
            total_inserted += len(records)
        except Exception as exc:
            logger.warning("fetch_daily_bars.upsert_failed", symbol=sym, error=str(exc))
            failed += 1

    logger.info(
        "fetch_daily_bars.done", inserted=total_inserted, failed=failed
    )
```

- [ ] **Step 3: 테스트 통과 확인**

```bash
cd apps/worker
uv run pytest tests/test_jobs_fetch_daily_bars.py -v
```
Expected: 3 PASS

- [ ] **Step 4: 커밋**

```bash
git add apps/worker/src/ygworker/jobs/fetch_daily_bars.py apps/worker/tests/test_jobs_fetch_daily_bars.py
git commit -m "feat(worker): add fetch_daily_bars job (TDD, 3 tests)"
```

---

## Task 6: Worker — main.py 스케줄 통합

**Files:**
- Modify: `apps/worker/src/ygworker/main.py`

- [ ] **Step 1: import + 스케줄 추가**

`from ygworker.jobs.fetch_daily_bars import run_fetch_daily_bars` import.

기존 `scheduler.add_job(...)` 묶음 끝에 추가:

```python
    # KR 장 마감 후 (16:00 KST = 07:00 UTC)
    scheduler.add_job(
        _wrap_in_thread(run_fetch_daily_bars, supabase, logger),
        trigger="cron",
        hour=16,
        minute=0,
        id="fetch_daily_bars_kr",
        replace_existing=True,
    )
    # US 장 마감 후 (07:00 KST 다음날 = 22:00 UTC 전날, 단순화로 KST 07:00에 1회 더)
    scheduler.add_job(
        _wrap_in_thread(run_fetch_daily_bars, supabase, logger),
        trigger="cron",
        hour=7,
        minute=0,
        id="fetch_daily_bars_us",
        replace_existing=True,
    )
```

`AsyncIOScheduler(timezone="Asia/Seoul")` 이미 KST 기반이므로 hour=16/7은 KST.

- [ ] **Step 2: 부팅 시 1회 즉시 실행 (stocks 채워졌고 stock_bars 비어있을 때)**

`main_async` 안에서 `await asyncio.to_thread(run_fetch_fx, ...)` 다음에 추가:

```python
    # stock_bars가 비어있으면 부팅 시 1회 일봉 backfill
    bars_count = supabase.table("stock_bars").select("symbol", count="exact").limit(1).execute()
    if not bars_count.data:
        logger.info("worker.bootstrap_daily_bars")
        await asyncio.to_thread(run_fetch_daily_bars, supabase, logger)
```

- [ ] **Step 3: 워커 부팅 검증**

```bash
cd apps/worker
PYTHONPATH=src PYTHONUTF8=1 uv run python -m ygworker.main
```

기대 로그:
- `worker.starting`
- `bootstrap_stocks.skip` (이미 있으니 스킵)
- `worker.bootstrap_daily_bars` (stock_bars 비어있어서 1회 실행)
- `fetch_daily_bars.start count=200`
- `fetch_daily_bars.done inserted=70000+ failed=N`
- `worker.scheduler_started`

5분 정도 걸림. Ctrl+C로 종료.

- [ ] **Step 4: 커밋**

```bash
git add apps/worker/src/ygworker/main.py
git commit -m "feat(worker): schedule fetch_daily_bars (KR/US market close) + bootstrap backfill"
```

---

## Task 7: Web — Lightweight Charts 설치

**Files:**
- Modify: `apps/web/package.json` (npm 자동)

- [ ] **Step 1: 설치**

```bash
cd apps/web
npm install lightweight-charts
```

`lightweight-charts` 5.x가 설치됨 (현재 latest).

- [ ] **Step 2: 설치 확인**

```bash
node -e "console.log(require('lightweight-charts').version)"
```

- [ ] **Step 3: 커밋**

```bash
git add apps/web/package.json apps/web/package-lock.json
git commit -m "chore(web): install lightweight-charts"
```

---

## Task 8: Web — shadcn Sheet 컴포넌트

**Files:**
- Create: `apps/web/components/ui/sheet.tsx` (shadcn 자동)

- [ ] **Step 1: shadcn add**

```bash
cd apps/web
npx shadcn@latest add sheet
```

Sheet/SheetTrigger/SheetContent/SheetHeader/SheetTitle/SheetDescription 등 export됨.

- [ ] **Step 2: 커밋**

```bash
git add apps/web/components/ui/sheet.tsx apps/web/package.json apps/web/package-lock.json
git commit -m "chore(web): add shadcn Sheet component"
```

---

## Task 9: Web — /api/stocks/[symbol]/bars 라우트

**Files:**
- Create: `apps/web/app/api/stocks/[symbol]/bars/route.ts`

- [ ] **Step 1: 라우트 작성**

```typescript
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ symbol: string }> }
) {
  const { symbol } = await params;
  const { searchParams } = new URL(request.url);
  const interval = searchParams.get("interval") ?? "1d";
  const limit = Number(searchParams.get("limit") ?? "365");

  if (!["15m", "1h", "1d"].includes(interval)) {
    return NextResponse.json({ error: "invalid_interval" }, { status: 400 });
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("stock_bars")
    .select("ts, open, high, low, close, volume")
    .eq("symbol", decodeURIComponent(symbol))
    .eq("interval", interval)
    .order("ts", { ascending: true })
    .limit(limit);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ symbol, interval, bars: data ?? [] });
}
```

- [ ] **Step 2: 빌드 + 커밋**

```bash
cd apps/web
npm run build   # /api/stocks/[symbol]/bars 라우트 표시
```

```bash
git add apps/web/app/api/stocks/[symbol]/bars/route.ts
git commit -m "feat(web): GET /api/stocks/[symbol]/bars (OHLCV by interval)"
```

---

## Task 10: Web — /api/watchlist 라우트들

**Files:**
- Create: `apps/web/app/api/watchlist/route.ts`
- Create: `apps/web/app/api/watchlist/[symbol]/route.ts`

- [ ] **Step 1: 목록 조회**

`apps/web/app/api/watchlist/route.ts`:

```typescript
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const portfolio_id = searchParams.get("portfolio_id");

  let q = supabase
    .from("watchlists")
    .select("symbol, added_at, stocks(name, name_ko, currency, market, last_price)")
    .order("added_at", { ascending: false });
  if (portfolio_id) q = q.eq("portfolio_id", portfolio_id);

  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ items: data });
}
```

- [ ] **Step 2: 추가/삭제**

`apps/web/app/api/watchlist/[symbol]/route.ts`:

```typescript
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

async function getGlobalPortfolioId(supabase: Awaited<ReturnType<typeof createClient>>, userId: string) {
  const { data } = await supabase
    .from("portfolios")
    .select("id")
    .eq("user_id", userId)
    .is("room_id", null)
    .single();
  return data?.id ?? null;
}

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ symbol: string }> }
) {
  const { symbol } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  const portfolioId = await getGlobalPortfolioId(supabase, user.id);
  if (!portfolioId) return NextResponse.json({ error: "no_portfolio" }, { status: 404 });

  const { error } = await supabase
    .from("watchlists")
    .insert({ portfolio_id: portfolioId, symbol: decodeURIComponent(symbol) });

  if (error) {
    // 이미 존재하면 unique 위반 — 그것도 OK
    if (error.code === "23505") {
      return NextResponse.json({ ok: true, already: true });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ symbol: string }> }
) {
  const { symbol } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  const portfolioId = await getGlobalPortfolioId(supabase, user.id);
  if (!portfolioId) return NextResponse.json({ error: "no_portfolio" }, { status: 404 });

  const { error } = await supabase
    .from("watchlists")
    .delete()
    .eq("portfolio_id", portfolioId)
    .eq("symbol", decodeURIComponent(symbol));

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 3: 빌드 + 커밋**

```bash
cd apps/web
npm run build
```

```bash
git add apps/web/app/api/watchlist/
git commit -m "feat(web): /api/watchlist GET + /api/watchlist/[symbol] POST/DELETE"
```

---

## Task 11: Web — StockChart 컴포넌트 (Lightweight Charts)

**Files:**
- Create: `apps/web/components/stock-chart.tsx`

라이브러리 docs: https://tradingview.github.io/lightweight-charts/

- [ ] **Step 1: 작성**

```tsx
"use client";

import { useEffect, useRef } from "react";
import {
  createChart,
  CandlestickSeries,
  LineSeries,
  type IChartApi,
  type ISeriesApi,
  type Time,
} from "lightweight-charts";

type Bar = {
  ts: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

type Props = {
  bars: Bar[];
  height?: number;
};

function calcMA(closes: number[], period: number): (number | undefined)[] {
  const out: (number | undefined)[] = [];
  let sum = 0;
  for (let i = 0; i < closes.length; i++) {
    sum += closes[i];
    if (i >= period) sum -= closes[i - period];
    if (i >= period - 1) out.push(sum / period);
    else out.push(undefined);
  }
  return out;
}

export function StockChart({ bars, height = 320 }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    if (bars.length === 0) return;

    const chart = createChart(containerRef.current, {
      height,
      layout: {
        background: { color: "transparent" },
        textColor: "#888",
      },
      grid: {
        vertLines: { color: "rgba(255,255,255,0.05)" },
        horzLines: { color: "rgba(255,255,255,0.05)" },
      },
      timeScale: { timeVisible: false },
    });
    chartRef.current = chart;

    const candleSeries: ISeriesApi<"Candlestick"> = chart.addSeries(CandlestickSeries, {
      upColor: "#26a69a",
      downColor: "#ef5350",
      borderVisible: false,
      wickUpColor: "#26a69a",
      wickDownColor: "#ef5350",
    });

    const candleData = bars.map((b) => ({
      time: (b.ts.split("T")[0]) as Time, // "2026-05-08"
      open: b.open,
      high: b.high,
      low: b.low,
      close: b.close,
    }));
    candleSeries.setData(candleData);

    // MA20 + MA60
    const closes = bars.map((b) => b.close);
    const ma20 = calcMA(closes, 20);
    const ma60 = calcMA(closes, 60);

    const ma20Series = chart.addSeries(LineSeries, { color: "#f59e0b", lineWidth: 1 });
    ma20Series.setData(
      bars
        .map((b, i) => ({
          time: (b.ts.split("T")[0]) as Time,
          value: ma20[i],
        }))
        .filter((d): d is { time: Time; value: number } => d.value !== undefined)
    );

    const ma60Series = chart.addSeries(LineSeries, { color: "#a78bfa", lineWidth: 1 });
    ma60Series.setData(
      bars
        .map((b, i) => ({
          time: (b.ts.split("T")[0]) as Time,
          value: ma60[i],
        }))
        .filter((d): d is { time: Time; value: number } => d.value !== undefined)
    );

    chart.timeScale().fitContent();

    const onResize = () => {
      if (containerRef.current) {
        chart.applyOptions({ width: containerRef.current.clientWidth });
      }
    };
    onResize();
    window.addEventListener("resize", onResize);

    return () => {
      window.removeEventListener("resize", onResize);
      chart.remove();
      chartRef.current = null;
    };
  }, [bars, height]);

  if (bars.length === 0) {
    return (
      <div className="text-sm text-muted-foreground py-8 text-center">
        차트 데이터 없음 (워커가 일봉 fetch 후 표시)
      </div>
    );
  }

  return (
    <div>
      <div ref={containerRef} className="w-full" style={{ height }} />
      <div className="text-xs text-muted-foreground mt-2 flex gap-3 justify-center">
        <span>
          <span className="inline-block w-3 h-1 align-middle mr-1" style={{ backgroundColor: "#f59e0b" }} />
          MA20
        </span>
        <span>
          <span className="inline-block w-3 h-1 align-middle mr-1" style={{ backgroundColor: "#a78bfa" }} />
          MA60
        </span>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: 빌드 확인**

```bash
cd apps/web
npm run build
```

만약 lightweight-charts 5.x API 차이로 에러 나면 (e.g., addCandlestickSeries 대신 addSeries(CandlestickSeries)), API 매뉴얼 참조: https://tradingview.github.io/lightweight-charts/docs/api

(`AreaSeries`, `LineSeries`, `CandlestickSeries`는 v5에서 series 타입 객체로 import해서 `chart.addSeries(SeriesType, options)` 형태로 사용.)

- [ ] **Step 3: 커밋**

```bash
git add apps/web/components/stock-chart.tsx
git commit -m "feat(web): add StockChart with Lightweight Charts (candle + MA20/MA60)"
```

---

## Task 12: Web — BuySellSheet 컴포넌트

**Files:**
- Create: `apps/web/components/buy-sell-sheet.tsx`

기존 OrderForm을 BottomSheet 안에 띄우는 wrapper. 트리거는 큰 매수/매도 버튼 2개.

- [ ] **Step 1: 작성**

```tsx
"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { OrderForm } from "@/components/order-form";

type Props = {
  portfolioId: string;
  symbol: string;
  symbolName: string;
  currency: string;
  lastPrice: number | null;
};

export function BuySellSheet({
  portfolioId,
  symbol,
  symbolName,
  currency,
  lastPrice,
}: Props) {
  const [openSide, setOpenSide] = useState<"buy" | "sell" | null>(null);

  return (
    <div className="grid grid-cols-2 gap-2">
      <Sheet open={openSide === "buy"} onOpenChange={(o) => setOpenSide(o ? "buy" : null)}>
        <SheetTrigger asChild>
          <Button className="w-full" size="lg">
            매수
          </Button>
        </SheetTrigger>
        <SheetContent side="bottom">
          <SheetHeader>
            <SheetTitle>{symbolName} 매수</SheetTitle>
            <SheetDescription>
              {symbol} · 현재가 {lastPrice ? `${lastPrice} ${currency}` : "—"}
            </SheetDescription>
          </SheetHeader>
          <div className="p-4">
            <OrderForm
              portfolioId={portfolioId}
              symbol={symbol}
              currency={currency}
              lastPrice={lastPrice}
              forceSide="buy"
            />
          </div>
        </SheetContent>
      </Sheet>

      <Sheet open={openSide === "sell"} onOpenChange={(o) => setOpenSide(o ? "sell" : null)}>
        <SheetTrigger asChild>
          <Button className="w-full" size="lg" variant="outline">
            매도
          </Button>
        </SheetTrigger>
        <SheetContent side="bottom">
          <SheetHeader>
            <SheetTitle>{symbolName} 매도</SheetTitle>
            <SheetDescription>
              {symbol} · 현재가 {lastPrice ? `${lastPrice} ${currency}` : "—"}
            </SheetDescription>
          </SheetHeader>
          <div className="p-4">
            <OrderForm
              portfolioId={portfolioId}
              symbol={symbol}
              currency={currency}
              lastPrice={lastPrice}
              forceSide="sell"
            />
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
```

NOTE: shadcn Button asChild는 미지원이라고 했으나 Sheet의 SheetTrigger + asChild는 Sheet primitive(Radix)의 기능이라 OK일 가능성. 만약 안 되면 Sheet primitive에서 Trigger 직접 사용 (asChild 없이 button 자체로).

만약 SheetTrigger asChild가 동작 안 하면:
```tsx
<SheetTrigger className="w-full">
  <span className="inline-flex items-center justify-center h-10 px-4 rounded-lg bg-primary text-primary-foreground">매수</span>
</SheetTrigger>
```

- [ ] **Step 2: OrderForm 수정 — forceSide prop 추가**

`apps/web/components/order-form.tsx` 상단의 Props 타입에 추가:

```tsx
type Props = {
  portfolioId: string;
  symbol: string;
  currency: string;
  lastPrice: number | null;
  forceSide?: "buy" | "sell";  // BuySellSheet에서 사용 — side 토글 숨김
};

export function OrderForm({
  portfolioId,
  symbol,
  currency,
  lastPrice,
  forceSide,
}: Props) {
  const [side, setSide] = useState<"buy" | "sell">(forceSide ?? "buy");
  // ...
```

그리고 buy/sell 토글 버튼 div를 다음으로 감싸:

```tsx
{!forceSide && (
  <div className="flex gap-2">
    <Button type="button" variant={side === "buy" ? "default" : "outline"} onClick={() => setSide("buy")}>매수</Button>
    <Button type="button" variant={side === "sell" ? "default" : "outline"} onClick={() => setSide("sell")}>매도</Button>
  </div>
)}
```

- [ ] **Step 3: 빌드 + 커밋**

```bash
cd apps/web
npm run build
```

```bash
git add apps/web/components/buy-sell-sheet.tsx apps/web/components/order-form.tsx
git commit -m "feat(web): BuySellSheet wrapping OrderForm in Bottom Sheet"
```

---

## Task 13: Web — WatchlistButton 컴포넌트

**Files:**
- Create: `apps/web/components/watchlist-button.tsx`

- [ ] **Step 1: 작성**

```tsx
"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";

type Props = {
  symbol: string;
  initialWatched: boolean;
};

export function WatchlistButton({ symbol, initialWatched }: Props) {
  const [watched, setWatched] = useState(initialWatched);
  const [isPending, startTransition] = useTransition();

  function toggle() {
    startTransition(async () => {
      const method = watched ? "DELETE" : "POST";
      const res = await fetch(`/api/watchlist/${encodeURIComponent(symbol)}`, { method });
      if (res.ok) {
        setWatched(!watched);
      } else {
        const err = await res.json().catch(() => ({}));
        alert(err.error ?? "오류");
      }
    });
  }

  return (
    <Button variant="outline" size="sm" onClick={toggle} disabled={isPending}>
      {watched ? "★ 관심종목 해제" : "☆ 관심종목 추가"}
    </Button>
  );
}
```

- [ ] **Step 2: 커밋**

```bash
git add apps/web/components/watchlist-button.tsx
git commit -m "feat(web): WatchlistButton toggle (POST/DELETE /api/watchlist/[symbol])"
```

---

## Task 14: Web — 종목 상세 페이지 통합

**Files:**
- Modify: `apps/web/app/app/trade/[symbol]/page.tsx`

- [ ] **Step 1: 통합**

기존 page.tsx를 다음 구조로 갱신 (현재가 + 차트 + 기본정보 + Watchlist + 거래(BottomSheet)):

```tsx
import { redirect, notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StockChart } from "@/components/stock-chart";
import { BuySellSheet } from "@/components/buy-sell-sheet";
import { WatchlistButton } from "@/components/watchlist-button";

const KRW = new Intl.NumberFormat("ko-KR", { style: "currency", currency: "KRW", maximumFractionDigits: 0 });
const USD = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });

export default async function StockDetail({ params }: { params: Promise<{ symbol: string }> }) {
  const { symbol } = await params;
  const decodedSymbol = decodeURIComponent(symbol);
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const { data: stock } = await supabase
    .from("stocks")
    .select("*")
    .eq("symbol", decodedSymbol)
    .single();
  if (!stock) notFound();

  const [{ data: portfolio }, { data: bars }, { data: watch }] = await Promise.all([
    supabase
      .from("portfolios")
      .select("id, krw_balance, usd_balance")
      .eq("user_id", user.id)
      .is("room_id", null)
      .single(),
    supabase
      .from("stock_bars")
      .select("ts, open, high, low, close, volume")
      .eq("symbol", decodedSymbol)
      .eq("interval", "1d")
      .order("ts", { ascending: true })
      .limit(365),
    supabase
      .from("watchlists")
      .select("symbol")
      .eq("symbol", decodedSymbol)
      .maybeSingle(),
  ]);

  const fmt = stock.currency === "KRW" ? KRW : USD;
  const symbolName = stock.name_ko ?? stock.name;

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-xs text-muted-foreground">{stock.symbol} · {stock.market}</div>
          <h1 className="text-2xl font-bold">{symbolName}</h1>
        </div>
        <WatchlistButton symbol={stock.symbol} initialWatched={!!watch} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">현재가</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold font-mono">
            {stock.last_price ? fmt.format(Number(stock.last_price)) : "—"}
          </div>
          <div className="text-xs text-muted-foreground mt-1">
            업데이트: {stock.last_price_at ? new Date(stock.last_price_at).toLocaleString("ko-KR") : "—"}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">일봉 차트 (최근 1년)</CardTitle>
        </CardHeader>
        <CardContent>
          <StockChart bars={bars ?? []} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">거래</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {portfolio ? (
            <BuySellSheet
              portfolioId={portfolio.id}
              symbol={stock.symbol}
              symbolName={symbolName}
              currency={stock.currency}
              lastPrice={stock.last_price ? Number(stock.last_price) : null}
            />
          ) : (
            <div className="text-sm text-muted-foreground">포트폴리오 로딩 실패</div>
          )}
          <div className="text-xs text-muted-foreground">
            잔고: {portfolio?.krw_balance ? KRW.format(Number(portfolio.krw_balance)) : "—"}
            {" · "}
            {portfolio?.usd_balance ? USD.format(Number(portfolio.usd_balance)) : "$0"}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">기본 정보</CardTitle>
        </CardHeader>
        <CardContent className="text-sm space-y-1">
          <div>섹터: {stock.sector ?? "—"}</div>
          <div>시가총액: {stock.market_cap ? fmt.format(Number(stock.market_cap)) : "—"}</div>
          <div>PER: {stock.per ?? "—"}</div>
          <div>52주 최고: {stock.fifty_two_week_high ? fmt.format(Number(stock.fifty_two_week_high)) : "—"}</div>
          <div>52주 최저: {stock.fifty_two_week_low ? fmt.format(Number(stock.fifty_two_week_low)) : "—"}</div>
        </CardContent>
      </Card>
    </div>
  );
}
```

- [ ] **Step 2: 빌드 + 수동 검증**

```bash
cd apps/web
npm run build
```

`npm run dev` 후 가입 → 종목 검색 → AAPL 클릭 → 차트가 보이면 OK (워커가 fetch_daily_bars 돌렸다는 가정).

- [ ] **Step 3: 커밋**

```bash
git add apps/web/app/app/trade/[symbol]/page.tsx
git commit -m "feat(web): integrate StockChart + BuySellSheet + WatchlistButton on stock detail"
```

---

## Task 15: Web — /app/watchlist 페이지

**Files:**
- Create: `apps/web/app/app/watchlist/page.tsx`

- [ ] **Step 1: 작성**

```tsx
import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent } from "@/components/ui/card";

const KRW = new Intl.NumberFormat("ko-KR", { style: "currency", currency: "KRW", maximumFractionDigits: 0 });
const USD = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });

export default async function WatchlistPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const { data: items } = await supabase
    .from("watchlists")
    .select("symbol, added_at, stocks(name, name_ko, currency, market, last_price)")
    .order("added_at", { ascending: false });

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-4">
      <h1 className="text-2xl font-bold">관심 종목</h1>
      <Card>
        <CardContent className="pt-6">
          {!items || items.length === 0 ? (
            <div className="text-sm text-muted-foreground">
              관심 종목 없음. 종목 상세 페이지에서 ☆ 버튼으로 추가하세요.
            </div>
          ) : (
            <ul className="space-y-2">
              {items.map((it) => {
                const stock = Array.isArray(it.stocks) ? it.stocks[0] : it.stocks;
                const fmt = stock?.currency === "KRW" ? KRW : USD;
                return (
                  <li key={it.symbol} className="border-b pb-2">
                    <Link
                      href={`/app/trade/${encodeURIComponent(it.symbol)}`}
                      className="block hover:bg-muted/30 p-2 rounded flex items-center justify-between"
                    >
                      <div>
                        <div className="font-medium">{stock?.name_ko ?? stock?.name ?? it.symbol}</div>
                        <div className="text-xs text-muted-foreground">{it.symbol} · {stock?.market}</div>
                      </div>
                      <div className="font-mono text-sm">
                        {stock?.last_price ? fmt.format(Number(stock.last_price)) : "—"}
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
```

- [ ] **Step 2: 빌드 + 커밋**

```bash
cd apps/web
npm run build
git add apps/web/app/app/watchlist/page.tsx
git commit -m "feat(web): /app/watchlist page (list + link to detail)"
```

---

## Task 16: Web — Dashboard 링크 추가

**Files:**
- Modify: `apps/web/app/app/dashboard/page.tsx`

- [ ] **Step 1: 곧 추가될 기능 카드의 링크 묶음에 watchlist 추가**

`<Link href="/app/portfolio/transactions">` 바로 아래에 추가:

```tsx
          <div>
            <Link href="/app/watchlist" className="text-foreground underline">
              → 관심 종목
            </Link>
          </div>
```

그리고 "Plan #4 (차트)" 줄을 제거 (이제 끝났으니).

- [ ] **Step 2: 커밋**

```bash
git add apps/web/app/app/dashboard/page.tsx
git commit -m "feat(web): dashboard link to /app/watchlist"
```

---

## Task 17: E2E — Watchlist 플로우

**Files:**
- Create: `apps/web/tests/e2e/watchlist.spec.ts`

- [ ] **Step 1: 작성**

```typescript
import { test, expect, type Page } from "@playwright/test";

async function signupAndGoToTrade(page: Page, symbol: string) {
  const email = `wl-${Date.now()}@test.com`;
  await page.goto("/auth/login");
  await page.getByRole("button", { name: /가입하기/i }).click();
  await page.getByLabel("이메일").fill(email);
  await page.getByLabel("비밀번호").fill("TestPass123!");
  await page.getByRole("button", { name: /^가입$/i }).click();
  await expect(page).toHaveURL(/\/app\/dashboard/, { timeout: 15_000 });
  await page.goto(`/app/trade/${encodeURIComponent(symbol)}`);
}

test.describe("Watchlist", () => {
  test("AAPL 추가 → /app/watchlist에 보임 → 해제 → 비어있음", async ({ page }) => {
    await signupAndGoToTrade(page, "AAPL");

    // ☆ 관심종목 추가
    await page.getByRole("button", { name: /관심종목 추가/ }).click();
    await expect(page.getByRole("button", { name: /관심종목 해제/ })).toBeVisible();

    // /app/watchlist에서 보이는지
    await page.goto("/app/watchlist");
    await expect(page.getByText("Apple")).toBeVisible();

    // 다시 상세로 가서 해제
    await page.goto("/app/trade/AAPL");
    await page.getByRole("button", { name: /관심종목 해제/ }).click();
    await expect(page.getByRole("button", { name: /관심종목 추가/ })).toBeVisible();

    // /app/watchlist에서 사라짐
    await page.goto("/app/watchlist");
    await expect(page.getByText(/관심 종목 없음/)).toBeVisible();
  });
});
```

- [ ] **Step 2: 실행**

```bash
cd apps/web
npx playwright test tests/e2e/watchlist.spec.ts -v
```
Expected: 1 PASS

- [ ] **Step 3: 커밋**

```bash
git add apps/web/tests/e2e/watchlist.spec.ts
git commit -m "test(web): E2E for watchlist add/remove flow"
```

---

## Task 18: 전체 검증 + README

**Files:**
- Modify: `README.md`

- [ ] **Step 1: 전체 검증**

```bash
cd apps/worker && uv run pytest tests/ 
# Expected: 53 + new (fdr 3 + fetch_daily_bars 3) = 59 PASS

cd apps/web
npm run lint
npx tsc --noEmit
npx playwright test
# Expected: prior 6 PASS + 2 SKIP + new watchlist 1 = 7 PASS, 2 SKIP
```

- [ ] **Step 2: README 갱신**

`### Plan #3` 다음에 추가:

```markdown
### Plan #4 — Trading UI ✅ 완료

- [x] DB: stock_bars (OHLCV 시계열), watchlists 테이블 + RLS
- [x] 워커: fetch_daily_history (FDR) + fetch_daily_bars 잡 (KR 16:00 / US 07:00 KST cron + 부팅 시 backfill)
- [x] Web API: /api/stocks/[symbol]/bars (interval=1d/1h/15m), /api/watchlist (GET/POST/DELETE)
- [x] Web UI: Lightweight Charts 일봉 캔들 + MA20/MA60, BuySellSheet (BottomSheet), WatchlistButton, /app/watchlist 페이지
- [x] 테스트: 워커 단위 6 추가 (fdr 3 + fetch_daily_bars 3) + Web E2E 1 추가 = **누적 60+ PASS**

v1.5에서 추가 예정: 인트라데이 봉(15분/1시간), RSI/MACD/볼린저, 뉴스, 재무제표 요약, 포트폴리오 overview.
```

`다음 plans` 섹션에서 Plan #4 줄 제거.

- [ ] **Step 3: 커밋**

```bash
git add README.md
git commit -m "docs: Plan #4 (Trading UI) completion"
```

---

## 마무리 검증 체크리스트

- [ ] **DB**: `supabase db reset` 통과, 13 + 3 = 16 마이그레이션
- [ ] **워커**: 일봉 backfill 1회 (2-5분), `fetch_daily_bars.done inserted=N` 출력
- [ ] **Lint/typecheck**: clean
- [ ] **단위 테스트**: 59 PASS
- [ ] **E2E**: prior 6 + watchlist 1 = 7 PASS, 2 SKIP (KR market hours)
- [ ] **수동**: 가입 → AAPL 검색 → 클릭 → 차트 보임 → 매수 클릭 → BottomSheet → 매수 → 체결 → ★ 추가 → /app/watchlist 보임

---

## Plan #4에 포함되지 않은 것 (Plan #4.5)

| 항목 | Plan |
|------|------|
| 인트라데이 봉 (15m, 1h) | #4.5 |
| RSI / MACD / 볼린저 밴드 | #4.5 |
| 종목 뉴스 | #4.5 |
| 재무제표 요약 | #4.5 |
| 포트폴리오 overview (자산 배분, 누적 수익률) | #4.5 |
| 차트 인터벌 토글 (1d/1h/15m) | #4.5 |
| 거래량 패널 | #4.5 |

---

## 디버깅 팁

- **차트 안 보임**: 워커 로그에서 `fetch_daily_bars.done` 확인. `select count(*) from stock_bars where symbol = 'AAPL'` 결과가 0이면 backfill 안 된 것
- **Lightweight Charts API 호환성**: v4 → v5에서 `chart.addCandlestickSeries()` → `chart.addSeries(CandlestickSeries, opts)`로 변경. v4 코드는 동작 안 함
- **Sheet asChild 안 됨**: shadcn Button이 Radix Slot 기반이 아닌 base-ui이라 asChild 호환성 다름. SheetTrigger를 직접 button으로 쓰거나, child로 평범한 div 감싸기
- **watchlist unique 위반**: 이미 추가된 심볼 다시 POST하면 23505. API에서 already=true로 처리해 사용자에게 OK처럼 응답
