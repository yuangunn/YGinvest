# YGinvest Plan #2 — Stock Universe & Price Feed Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 사용자가 한국·미국 종목을 검색하면 결과 리스트와 현재가가 보이고, 워커가 백그라운드에서 활성 종목들의 시세와 환율을 주기적으로 갱신한다. 종목이 캐시에 없는 경우 워커의 RPC를 통해 즉시 조회·저장.

**Architecture:** 워커에 `pykrx`(KR) + `yfinance`(US/KR) 어댑터 추가. 부팅 시 시가총액 상위 KR 100 + US 100을 prefetch. APScheduler가 `fetch_prices`(1분/장중)·`fetch_fx_rate`(30분)·`refresh_stock_master`(1일) 잡 실행. FastAPI를 워커 프로세스에 추가하여 Next.js가 ad-hoc ticker lookup을 동기 호출. RLS는 stocks·fx_rates를 누구나 읽기, 워커만 쓰기.

**Tech Stack 추가:** pykrx · yfinance · FastAPI · uvicorn · httpx · tenacity · pandas-market-calendars

---

## 사전 요구사항

- Plan #1 완료 상태 (master에 머지됨)
- Supabase 로컬 가동 중 (`supabase start`)
- 워커 가상환경 사용 가능 (`apps/worker/.venv`)

---

## 파일 구조 (이 plan에서 추가/수정)

```
supabase/migrations/
  20260510010001_stocks.sql                         (NEW)
  20260510010002_fx_rates.sql                       (NEW)
  20260510010003_stocks_fx_rls.sql                  (NEW)

apps/worker/
  pyproject.toml                                     (MODIFY: add deps)
  .env.example                                       (MODIFY: WORKER_RPC_PORT)
  .env                                               (MODIFY: same)
  Dockerfile                                         (MODIFY: EXPOSE 8080)
  src/ygworker/
    config.py                                        (MODIFY: add rpc_port, rpc_secret)
    main.py                                          (MODIFY: AsyncIOScheduler + FastAPI)
    market_hours.py                                  (NEW: KR/US 장 운영 시간 판정)
    data_sources/
      __init__.py                                    (NEW)
      yahoo.py                                       (NEW: yfinance 어댑터)
      krx.py                                         (NEW: pykrx 어댑터)
      fx.py                                          (NEW: exchangerate.host 어댑터)
    jobs/
      bootstrap_stocks.py                            (NEW: 부팅 시 prefetch)
      fetch_prices.py                                (NEW: 활성 종목 가격 갱신)
      fetch_fx.py                                    (NEW: 환율 갱신)
      refresh_master.py                              (NEW: 일별 종목 마스터 갱신)
    rpc/
      __init__.py                                    (NEW)
      app.py                                         (NEW: FastAPI 인스턴스)
      stocks.py                                      (NEW: /rpc/stocks/lookup)
  tests/
    test_market_hours.py                             (NEW)
    test_data_sources_yahoo.py                       (NEW: yfinance 모킹)
    test_data_sources_krx.py                         (NEW: pykrx 모킹)
    test_data_sources_fx.py                          (NEW: httpx 모킹)
    test_jobs_bootstrap_stocks.py                    (NEW)
    test_jobs_fetch_prices.py                        (NEW)
    test_jobs_fetch_fx.py                            (NEW)
    test_rpc_stocks_lookup.py                        (NEW: FastAPI TestClient)

apps/web/
  app/app/trade/                                     (NEW: literal /app/* segment, Plan #1과 동일 패턴)
    page.tsx                                         (NEW: redirect → search)
    search/page.tsx                                  (NEW: 검색 UI)
    [symbol]/page.tsx                                (NEW: 최소 상세 placeholder)
  app/api/
    stocks/search/route.ts                           (NEW: search API)
    stocks/lookup/route.ts                           (NEW: ad-hoc lookup proxy)
  components/
    stock-search.tsx                                 (NEW: client 검색 컴포넌트)
  lib/
    workerRpc.ts                                     (NEW: 워커 호출 헬퍼)
  app/app/dashboard/page.tsx                         (MODIFY: 거래 페이지 링크 추가)
  .env.local.example                                 (MODIFY: WORKER_RPC_URL, WORKER_RPC_SECRET)
  .env.local                                         (MODIFY: same)
  tests/e2e/
    stock-search.spec.ts                             (NEW: 검색 → 결과 → 상세 placeholder)

README.md                                            (MODIFY: 진행상태 갱신)
```

각 파일의 책임:
- `market_hours.py` — KR/US 시장 운영 시간 + 휴장일 판정. 스케줄러가 "장중인지" 묻는 단일 진입점.
- `data_sources/yahoo.py` — yfinance를 호출하는 얇은 wrapper. 호출 단위는 "심볼 1개 → dict". 외부 라이브러리 변경에 격리.
- `data_sources/krx.py` — pykrx wrapper. 한국 종목 마스터 (종목명_ko 포함) + 가격.
- `data_sources/fx.py` — exchangerate.host 호출. 실패 시 yfinance `KRW=X` 폴백.
- `jobs/*` — 각 잡은 "Supabase + data_sources 받아서 일을 한다" 형태. 의존성 주입으로 테스트 용이.
- `rpc/app.py`, `rpc/stocks.py` — FastAPI 인스턴스와 라우터. 인증은 `X-Worker-Secret` 헤더.
- `lib/workerRpc.ts` — Next.js → 워커 RPC 호출 헬퍼. `WORKER_RPC_URL` + 시크릿 자동 첨부.

---

## Task 1: 브랜치 + 환경 점검

**Files:** (none)

- [ ] **Step 1: 브랜치 확인**

Run: `git branch --show-current`
Expected: `plan-2-stocks`

- [ ] **Step 2: Supabase 로컬 가동 확인**

Run: `supabase status`
Expected: API URL, DB URL 출력. 만약 멈춰있으면 `supabase start`.

- [ ] **Step 3: 워커 venv 확인**

Run: `cd apps/worker && uv run python -c "import sys; print(sys.version)"`
Expected: Python 3.12.x

---

## Task 2: Migration — stocks 테이블

**Files:**
- Create: `supabase/migrations/20260510010001_stocks.sql`

- [ ] **Step 1: 마이그레이션 작성**

Create `supabase/migrations/20260510010001_stocks.sql`:

```sql
create table public.stocks (
  symbol text primary key,
  market text not null check (market in ('KRX_KS', 'KRX_KQ', 'NASDAQ', 'NYSE')),
  currency text not null check (currency in ('KRW', 'USD')),
  name text not null,                  -- 영문/원문명 (Apple Inc., 삼성전자)
  name_ko text,                        -- 한국어 표기 (Apple은 NULL 허용)
  sector text,
  market_cap numeric(24,2),
  per numeric(10,4),
  last_price numeric(20,4),
  last_price_at timestamptz,
  fifty_two_week_high numeric(20,4),
  fifty_two_week_low numeric(20,4),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index stocks_market_idx on public.stocks (market);
create index stocks_active_idx on public.stocks (is_active) where is_active;
create index stocks_market_cap_idx on public.stocks (market_cap desc nulls last);

-- 검색용 trigram 인덱스 (이름 부분일치)
create extension if not exists pg_trgm;
create index stocks_name_trgm_idx on public.stocks using gin (name gin_trgm_ops);
create index stocks_name_ko_trgm_idx on public.stocks using gin (name_ko gin_trgm_ops) where name_ko is not null;

comment on table public.stocks is '종목 마스터 캐시 (Plan #2)';
```

- [ ] **Step 2: 적용 + 검증**

Run: `supabase db reset`
Expected: 모든 마이그레이션 통과 (Plan #1 5개 + 새 1개)

Studio (http://127.0.0.1:54323) → Table Editor → `public.stocks` 보임 확인.

- [ ] **Step 3: 커밋**

```bash
git add supabase/migrations/20260510010001_stocks.sql
git commit -m "feat(db): add stocks master table with trigram search indexes"
```

---

## Task 3: Migration — fx_rates 테이블

**Files:**
- Create: `supabase/migrations/20260510010002_fx_rates.sql`

- [ ] **Step 1: 마이그레이션 작성**

Create `supabase/migrations/20260510010002_fx_rates.sql`:

```sql
create table public.fx_rates (
  base text not null,
  quote text not null,
  ts timestamptz not null,
  rate numeric(20,8) not null,
  primary key (base, quote, ts)
);

create index fx_rates_latest_idx on public.fx_rates (base, quote, ts desc);

comment on table public.fx_rates is '환율 시계열. (USD,KRW)는 워커가 30분마다 INSERT';
```

- [ ] **Step 2: 적용 + 커밋**

Run: `supabase db reset`

```bash
git add supabase/migrations/20260510010002_fx_rates.sql
git commit -m "feat(db): add fx_rates time-series table"
```

---

## Task 4: Migration — RLS for stocks/fx_rates

**Files:**
- Create: `supabase/migrations/20260510010003_stocks_fx_rls.sql`

- [ ] **Step 1: 마이그레이션 작성**

Create `supabase/migrations/20260510010003_stocks_fx_rls.sql`:

```sql
-- stocks: 누구나 읽기 (검색 + 상세 페이지가 anon에서도 SSR 가능하도록)
alter table public.stocks enable row level security;

create policy "stocks: 누구나 읽기"
  on public.stocks for select
  to anon, authenticated
  using (true);

-- INSERT/UPDATE/DELETE는 워커 (service_role)만

-- fx_rates: 누구나 읽기
alter table public.fx_rates enable row level security;

create policy "fx_rates: 누구나 읽기"
  on public.fx_rates for select
  to anon, authenticated
  using (true);
```

- [ ] **Step 2: 적용 + 커밋**

Run: `supabase db reset`

```bash
git add supabase/migrations/20260510010003_stocks_fx_rls.sql
git commit -m "feat(db): add RLS for stocks/fx_rates (read public, write worker-only)"
```

---

## Task 5: 워커 의존성 추가

**Files:**
- Modify: `apps/worker/pyproject.toml`

- [ ] **Step 1: pyproject.toml 수정**

Edit `apps/worker/pyproject.toml`. `dependencies` 배열을 다음으로 교체:

```toml
dependencies = [
  "supabase>=2.9.0",
  "apscheduler>=3.10.4",
  "python-dotenv>=1.0.1",
  "structlog>=24.4.0",
  "yfinance>=0.2.50",
  "pykrx>=1.0.50",
  "fastapi>=0.115.0",
  "uvicorn[standard]>=0.32.0",
  "httpx>=0.27.0",
  "tenacity>=9.0.0",
  "pandas-market-calendars>=4.4.0",
]
```

`[dependency-groups].dev`에 추가:

```toml
dev = [
  "pytest>=8.3.3",
  "pytest-asyncio>=0.24.0",
  "ruff>=0.7.4",
  "mypy>=1.13.0",
  "pytest-httpx>=0.35.0",
]
```

- [ ] **Step 2: 의존성 설치**

Run: `cd apps/worker && uv sync`
Expected: `+yfinance`, `+pykrx`, `+fastapi`, `+uvicorn`, `+httpx`, `+tenacity`, `+pandas-market-calendars` 등이 추가됨

- [ ] **Step 3: 커밋**

```bash
git add apps/worker/pyproject.toml apps/worker/uv.lock
git commit -m "chore(worker): add yfinance/pykrx/fastapi/httpx/tenacity for Plan #2"
```

---

## Task 6: market_hours 유틸 (TDD)

**Files:**
- Create: `apps/worker/src/ygworker/market_hours.py`
- Create: `apps/worker/tests/test_market_hours.py`

- [ ] **Step 1: 실패 테스트 작성**

Create `apps/worker/tests/test_market_hours.py`:

```python
from datetime import datetime
from zoneinfo import ZoneInfo

import pytest

from ygworker.market_hours import (
    is_kr_market_open,
    is_us_market_open,
    is_any_market_open,
)

KST = ZoneInfo("Asia/Seoul")


@pytest.mark.parametrize(
    "ts_iso, expected",
    [
        ("2026-05-11T09:30:00+09:00", True),   # 월요일 09:30 KST 장중
        ("2026-05-11T15:29:00+09:00", True),   # 월요일 15:29 장중
        ("2026-05-11T15:31:00+09:00", False),  # 월요일 15:31 마감
        ("2026-05-11T08:59:00+09:00", False),  # 월요일 08:59 개장 전
        ("2026-05-09T10:00:00+09:00", False),  # 토요일 → 휴장
        ("2026-05-10T10:00:00+09:00", False),  # 일요일 → 휴장
    ],
)
def test_is_kr_market_open(ts_iso, expected):
    ts = datetime.fromisoformat(ts_iso)
    assert is_kr_market_open(ts) is expected


@pytest.mark.parametrize(
    "ts_iso, expected",
    [
        # 미국 장은 ET 09:30-16:00. KST는 +13(서머타임) 또는 +14(표준시) 차이
        # 2026-05 → 서머타임. ET 09:30 = KST 22:30
        ("2026-05-11T22:30:00+09:00", True),   # 월요일(미국 시각) 09:30 ET
        ("2026-05-11T23:00:00+09:00", True),
        ("2026-05-12T05:00:00+09:00", True),
        ("2026-05-12T06:00:00+09:00", False),  # 16:00 ET 마감
        # 토/일 KST가 아니라 미국 토/일 기준이어야 함. KST 일요일 02:00 = ET 토요일 13:00 → 휴장
        ("2026-05-10T02:00:00+09:00", False),
    ],
)
def test_is_us_market_open(ts_iso, expected):
    ts = datetime.fromisoformat(ts_iso)
    assert is_us_market_open(ts) is expected


def test_is_any_market_open_kr_only():
    ts = datetime(2026, 5, 11, 10, 0, tzinfo=KST)
    assert is_any_market_open(ts) is True


def test_is_any_market_open_neither():
    ts = datetime(2026, 5, 9, 12, 0, tzinfo=KST)  # 토요일 정오 KST
    assert is_any_market_open(ts) is False
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `cd apps/worker && uv run pytest tests/test_market_hours.py -v`
Expected: ImportError — `ygworker.market_hours` 모듈 없음

- [ ] **Step 3: 구현**

Create `apps/worker/src/ygworker/market_hours.py`:

```python
from datetime import datetime, time
from zoneinfo import ZoneInfo

import pandas_market_calendars as mcal

KST = ZoneInfo("Asia/Seoul")
ET = ZoneInfo("America/New_York")

# 캐시: 매년 한 번만 캘린더 빌드
_kr_cal = mcal.get_calendar("XKRX")  # KRX
_us_cal = mcal.get_calendar("NYSE")


def _is_session_day(cal, dt: datetime) -> bool:
    """해당 날짜가 영업일(휴장 X)인지."""
    schedule = cal.schedule(start_date=dt.date(), end_date=dt.date())
    return not schedule.empty


def is_kr_market_open(ts: datetime) -> bool:
    """KRX 운영 시간: 평일 09:00-15:30 KST, 한국 공휴일 제외."""
    local = ts.astimezone(KST)
    if not _is_session_day(_kr_cal, local):
        return False
    open_t = time(9, 0)
    close_t = time(15, 30)
    return open_t <= local.time() <= close_t


def is_us_market_open(ts: datetime) -> bool:
    """NYSE/NASDAQ 운영 시간: 평일 09:30-16:00 ET, 미국 공휴일 제외."""
    local = ts.astimezone(ET)
    if not _is_session_day(_us_cal, local):
        return False
    open_t = time(9, 30)
    close_t = time(16, 0)
    return open_t <= local.time() <= close_t


def is_any_market_open(ts: datetime | None = None) -> bool:
    """KR 또는 US 장이 열려 있으면 True. 인자 없으면 현재 시각."""
    if ts is None:
        ts = datetime.now(tz=KST)
    return is_kr_market_open(ts) or is_us_market_open(ts)
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `cd apps/worker && uv run pytest tests/test_market_hours.py -v`
Expected: 8개 모두 PASS

⚠️ pandas-market-calendars가 설치 안 됐거나 timezone 정보가 안 맞으면 일부 테스트가 실패할 수 있음. Studio Studio 시간을 확인하고 holiday 데이터가 정확한지 점검.

- [ ] **Step 5: 커밋**

```bash
git add apps/worker/src/ygworker/market_hours.py apps/worker/tests/test_market_hours.py
git commit -m "feat(worker): add market_hours utility with TDD (KRX + NYSE)"
```

---

## Task 7: data_sources/yahoo 어댑터

**Files:**
- Create: `apps/worker/src/ygworker/data_sources/__init__.py`
- Create: `apps/worker/src/ygworker/data_sources/yahoo.py`
- Create: `apps/worker/tests/test_data_sources_yahoo.py`

- [ ] **Step 1: __init__.py 생성**

Create `apps/worker/src/ygworker/data_sources/__init__.py` (empty).

- [ ] **Step 2: 실패 테스트 작성**

Create `apps/worker/tests/test_data_sources_yahoo.py`:

```python
from unittest.mock import MagicMock, patch

import pytest

from ygworker.data_sources.yahoo import (
    YahooQuote,
    fetch_quote,
    fetch_quotes,
)


@patch("ygworker.data_sources.yahoo.yf.Ticker")
def test_fetch_quote_us_apple(mock_ticker):
    mock_ticker.return_value.info = {
        "longName": "Apple Inc.",
        "currency": "USD",
        "marketCap": 2_500_000_000_000,
        "trailingPE": 28.5,
        "regularMarketPrice": 158.5,
        "fiftyTwoWeekHigh": 200.0,
        "fiftyTwoWeekLow": 120.0,
        "sector": "Technology",
        "exchange": "NMS",
    }

    quote = fetch_quote("AAPL")

    assert quote == YahooQuote(
        symbol="AAPL",
        name="Apple Inc.",
        currency="USD",
        market="NASDAQ",
        price=158.5,
        market_cap=2_500_000_000_000,
        per=28.5,
        sector="Technology",
        fifty_two_week_high=200.0,
        fifty_two_week_low=120.0,
    )


@patch("ygworker.data_sources.yahoo.yf.Ticker")
def test_fetch_quote_kr_samsung(mock_ticker):
    mock_ticker.return_value.info = {
        "longName": "Samsung Electronics Co., Ltd.",
        "currency": "KRW",
        "marketCap": 400_000_000_000_000,
        "trailingPE": 12.3,
        "regularMarketPrice": 70000,
        "exchange": "KSC",  # KOSPI
    }

    quote = fetch_quote("005930.KS")

    assert quote.market == "KRX_KS"
    assert quote.currency == "KRW"
    assert quote.price == 70000


@patch("ygworker.data_sources.yahoo.yf.Ticker")
def test_fetch_quote_invalid_symbol_returns_none(mock_ticker):
    mock_ticker.return_value.info = {}  # yfinance 빈 dict 반환 시
    assert fetch_quote("INVALID_XXX") is None


@patch("ygworker.data_sources.yahoo.yf.Ticker")
def test_fetch_quote_raises_after_retries(mock_ticker):
    mock_ticker.side_effect = RuntimeError("Yahoo down")
    with pytest.raises(RuntimeError):
        fetch_quote("AAPL")


@patch("ygworker.data_sources.yahoo.fetch_quote")
def test_fetch_quotes_batches(mock_fq):
    mock_fq.side_effect = [
        YahooQuote("AAPL", "Apple Inc.", "USD", "NASDAQ", 158.5, None, None, None, None, None),
        None,
        YahooQuote("MSFT", "Microsoft", "USD", "NASDAQ", 380.0, None, None, None, None, None),
    ]
    quotes = fetch_quotes(["AAPL", "BAD", "MSFT"])
    assert [q.symbol for q in quotes] == ["AAPL", "MSFT"]
```

- [ ] **Step 3: 테스트 실패 확인**

Run: `cd apps/worker && uv run pytest tests/test_data_sources_yahoo.py -v`
Expected: ImportError

- [ ] **Step 4: 구현**

Create `apps/worker/src/ygworker/data_sources/yahoo.py`:

```python
from dataclasses import dataclass
from typing import Optional

import yfinance as yf
from tenacity import retry, stop_after_attempt, wait_exponential

# Yahoo의 exchange 코드 → 우리 market enum 매핑
_EXCHANGE_TO_MARKET: dict[str, str] = {
    "NMS": "NASDAQ",     # NASDAQ Global Select
    "NGM": "NASDAQ",     # NASDAQ Global Market
    "NCM": "NASDAQ",     # NASDAQ Capital Market
    "NYQ": "NYSE",       # NYSE
    "KSC": "KRX_KS",     # KOSPI
    "KOE": "KRX_KQ",     # KOSDAQ (yfinance 일부 표기)
    "KQE": "KRX_KQ",     # KOSDAQ
}


@dataclass(frozen=True)
class YahooQuote:
    symbol: str
    name: str
    currency: str
    market: str
    price: float
    market_cap: Optional[float]
    per: Optional[float]
    sector: Optional[str]
    fifty_two_week_high: Optional[float]
    fifty_two_week_low: Optional[float]


def _market_from_info(info: dict, symbol: str) -> str:
    exchange = info.get("exchange", "")
    if exchange in _EXCHANGE_TO_MARKET:
        return _EXCHANGE_TO_MARKET[exchange]
    # 폴백: 심볼 suffix
    if symbol.endswith(".KS"):
        return "KRX_KS"
    if symbol.endswith(".KQ"):
        return "KRX_KQ"
    return "NASDAQ"  # default for US tickers without exchange


@retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=1, min=1, max=8))
def fetch_quote(symbol: str) -> Optional[YahooQuote]:
    """yfinance에서 1개 종목 시세를 가져옴. 빈/유효하지 않은 응답은 None 반환."""
    info = yf.Ticker(symbol).info
    if not info or not info.get("regularMarketPrice"):
        return None

    name = info.get("longName") or info.get("shortName") or symbol
    return YahooQuote(
        symbol=symbol,
        name=name,
        currency=info.get("currency", "USD"),
        market=_market_from_info(info, symbol),
        price=float(info["regularMarketPrice"]),
        market_cap=info.get("marketCap"),
        per=info.get("trailingPE"),
        sector=info.get("sector"),
        fifty_two_week_high=info.get("fiftyTwoWeekHigh"),
        fifty_two_week_low=info.get("fiftyTwoWeekLow"),
    )


def fetch_quotes(symbols: list[str]) -> list[YahooQuote]:
    """여러 심볼을 순차 호출. None은 제외하여 반환."""
    out: list[YahooQuote] = []
    for s in symbols:
        try:
            q = fetch_quote(s)
            if q is not None:
                out.append(q)
        except Exception:
            # 호출 실패는 로그만 하고 계속 (호출자가 logger 주입)
            continue
    return out
```

- [ ] **Step 5: 테스트 통과 확인**

Run: `cd apps/worker && uv run pytest tests/test_data_sources_yahoo.py -v`
Expected: 5 PASS

- [ ] **Step 6: 커밋**

```bash
git add apps/worker/src/ygworker/data_sources/__init__.py apps/worker/src/ygworker/data_sources/yahoo.py apps/worker/tests/test_data_sources_yahoo.py
git commit -m "feat(worker): add yahoo data source with quote fetching (TDD, mocked)"
```

---

## Task 8: data_sources/krx 어댑터

**Files:**
- Create: `apps/worker/src/ygworker/data_sources/krx.py`
- Create: `apps/worker/tests/test_data_sources_krx.py`

- [ ] **Step 1: 실패 테스트 작성**

Create `apps/worker/tests/test_data_sources_krx.py`:

```python
from unittest.mock import patch

import pandas as pd

from ygworker.data_sources.krx import KrxStockMaster, list_top_stocks


@patch("ygworker.data_sources.krx.stock.get_market_cap_by_ticker")
@patch("ygworker.data_sources.krx.stock.get_market_ticker_name")
def test_list_top_stocks_kospi_top_3(mock_name, mock_cap):
    cap_df = pd.DataFrame(
        {
            "시가총액": [400_000_000_000_000, 200_000_000_000_000, 100_000_000_000_000],
        },
        index=["005930", "000660", "035420"],
    )
    mock_cap.return_value = cap_df
    mock_name.side_effect = lambda code: {
        "005930": "삼성전자",
        "000660": "SK하이닉스",
        "035420": "NAVER",
    }[code]

    result = list_top_stocks(market="KOSPI", limit=3)

    assert result == [
        KrxStockMaster(symbol="005930.KS", market="KRX_KS", name_ko="삼성전자",
                       market_cap=400_000_000_000_000),
        KrxStockMaster(symbol="000660.KS", market="KRX_KS", name_ko="SK하이닉스",
                       market_cap=200_000_000_000_000),
        KrxStockMaster(symbol="035420.KS", market="KRX_KS", name_ko="NAVER",
                       market_cap=100_000_000_000_000),
    ]


@patch("ygworker.data_sources.krx.stock.get_market_cap_by_ticker")
@patch("ygworker.data_sources.krx.stock.get_market_ticker_name")
def test_list_top_stocks_kosdaq_uses_kq_suffix(mock_name, mock_cap):
    cap_df = pd.DataFrame(
        {"시가총액": [50_000_000_000_000]},
        index=["247540"],
    )
    mock_cap.return_value = cap_df
    mock_name.return_value = "에코프로비엠"

    result = list_top_stocks(market="KOSDAQ", limit=1)

    assert result[0].symbol == "247540.KQ"
    assert result[0].market == "KRX_KQ"
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `cd apps/worker && uv run pytest tests/test_data_sources_krx.py -v`
Expected: ImportError

- [ ] **Step 3: 구현**

Create `apps/worker/src/ygworker/data_sources/krx.py`:

```python
from dataclasses import dataclass
from typing import Literal

from pykrx import stock
from tenacity import retry, stop_after_attempt, wait_exponential

Market = Literal["KOSPI", "KOSDAQ"]
_MARKET_TO_ENUM = {"KOSPI": "KRX_KS", "KOSDAQ": "KRX_KQ"}
_MARKET_TO_SUFFIX = {"KOSPI": ".KS", "KOSDAQ": ".KQ"}


@dataclass(frozen=True)
class KrxStockMaster:
    symbol: str       # 005930.KS
    market: str       # KRX_KS / KRX_KQ
    name_ko: str
    market_cap: float


@retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=1, min=1, max=8))
def list_top_stocks(market: Market, limit: int = 100, date: str | None = None) -> list[KrxStockMaster]:
    """KOSPI/KOSDAQ 시가총액 상위 N개 마스터 정보."""
    # date=None이면 pykrx가 가장 최근 영업일 사용
    cap_df = stock.get_market_cap_by_ticker(date or "", market=market)
    cap_df = cap_df.sort_values("시가총액", ascending=False).head(limit)

    out: list[KrxStockMaster] = []
    suffix = _MARKET_TO_SUFFIX[market]
    market_enum = _MARKET_TO_ENUM[market]
    for ticker, row in cap_df.iterrows():
        name_ko = stock.get_market_ticker_name(ticker)
        out.append(
            KrxStockMaster(
                symbol=f"{ticker}{suffix}",
                market=market_enum,
                name_ko=name_ko,
                market_cap=float(row["시가총액"]),
            )
        )
    return out
```

- [ ] **Step 4: 테스트 통과 + 커밋**

Run: `cd apps/worker && uv run pytest tests/test_data_sources_krx.py -v`
Expected: 2 PASS

```bash
git add apps/worker/src/ygworker/data_sources/krx.py apps/worker/tests/test_data_sources_krx.py
git commit -m "feat(worker): add krx data source for top KR tickers (TDD, mocked)"
```

---

## Task 9: data_sources/fx 어댑터

**Files:**
- Create: `apps/worker/src/ygworker/data_sources/fx.py`
- Create: `apps/worker/tests/test_data_sources_fx.py`

- [ ] **Step 1: 실패 테스트 작성**

Create `apps/worker/tests/test_data_sources_fx.py`:

```python
import re

import pytest
from pytest_httpx import HTTPXMock

from ygworker.data_sources.fx import fetch_usd_krw_rate


def test_fetch_usd_krw_rate_success(httpx_mock: HTTPXMock):
    # URL 기반(query string 순서 무관)이 아니라 host+path만 매칭
    httpx_mock.add_response(
        url=re.compile(r"^https://api\.exchangerate\.host/latest"),
        json={"rates": {"KRW": 1395.42}, "base": "USD"},
    )
    rate = fetch_usd_krw_rate()
    assert rate == 1395.42


def test_fetch_usd_krw_rate_retries_on_failure(httpx_mock: HTTPXMock):
    # 첫 두 번 500, 세 번째 성공
    httpx_mock.add_response(status_code=500)
    httpx_mock.add_response(status_code=500)
    httpx_mock.add_response(json={"rates": {"KRW": 1400.0}, "base": "USD"})
    rate = fetch_usd_krw_rate()
    assert rate == 1400.0


def test_fetch_usd_krw_rate_raises_after_3_failures(httpx_mock: HTTPXMock):
    httpx_mock.add_response(status_code=500)
    httpx_mock.add_response(status_code=500)
    httpx_mock.add_response(status_code=500)
    with pytest.raises(Exception):
        fetch_usd_krw_rate()
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `cd apps/worker && uv run pytest tests/test_data_sources_fx.py -v`
Expected: ImportError

- [ ] **Step 3: 구현**

Create `apps/worker/src/ygworker/data_sources/fx.py`:

```python
import httpx
from tenacity import retry, stop_after_attempt, wait_exponential


@retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=1, min=1, max=8))
def fetch_usd_krw_rate() -> float:
    """exchangerate.host에서 현재 USD/KRW 환율을 가져옴."""
    resp = httpx.get(
        "https://api.exchangerate.host/latest",
        params={"base": "USD", "symbols": "KRW"},
        timeout=10,
    )
    resp.raise_for_status()
    data = resp.json()
    return float(data["rates"]["KRW"])
```

- [ ] **Step 4: 테스트 통과 + 커밋**

Run: `cd apps/worker && uv run pytest tests/test_data_sources_fx.py -v`
Expected: 3 PASS

```bash
git add apps/worker/src/ygworker/data_sources/fx.py apps/worker/tests/test_data_sources_fx.py
git commit -m "feat(worker): add fx data source (USD/KRW via exchangerate.host)"
```

---

## Task 10: jobs/bootstrap_stocks (TDD)

**Files:**
- Create: `apps/worker/src/ygworker/jobs/bootstrap_stocks.py`
- Create: `apps/worker/tests/test_jobs_bootstrap_stocks.py`

이 잡은 **부팅 시 1회** 실행되어 stocks 테이블이 비어있으면 KR 100 + US 100을 prefetch한다.

- [ ] **Step 1: US 종목 하드코딩 리스트 작성**

`apps/worker/src/ygworker/data_sources/us_top.py` (NEW):

```python
"""시가총액 상위 미국 종목 하드코딩 리스트 (수동 큐레이션).

매년/분기마다 갱신. 현재(2026-05) 기준 상위 100.
출처: companiesmarketcap.com 등 공개 데이터 참조.
"""

US_TOP_100: list[str] = [
    "AAPL", "MSFT", "NVDA", "GOOGL", "GOOG", "AMZN", "META", "TSLA",
    "BRK-B", "AVGO", "LLY", "JPM", "WMT", "V", "XOM", "ORCL",
    "MA", "UNH", "COST", "HD", "PG", "JNJ", "BAC", "ABBV",
    "NFLX", "CRM", "CVX", "KO", "AMD", "MRK", "PEP", "TMO",
    "LIN", "ACN", "ADBE", "WFC", "MCD", "DIS", "CSCO", "ABT",
    "DHR", "IBM", "GE", "QCOM", "INTU", "AMGN", "AXP", "TXN",
    "VZ", "NOW", "PM", "RTX", "ISRG", "MS", "BX", "CAT",
    "GS", "PFE", "T", "PGR", "BKNG", "NEE", "TMUS", "C",
    "SCHW", "SPGI", "BLK", "HON", "ETN", "BSX", "DE", "ELV",
    "GILD", "BA", "CB", "VRTX", "LMT", "PANW", "ADP", "ANET",
    "MDLZ", "REGN", "MMC", "SYK", "SO", "ICE", "PLD", "MO",
    "CMCSA", "AMT", "ZTS", "DUK", "FI", "INTC", "CME", "EQIX",
    "TJX", "EOG", "AON", "SHW",
]

# 누락 방지를 위한 모듈 로드 시 검증
assert len(US_TOP_100) == 100, f"US_TOP_100 should have exactly 100 entries, got {len(US_TOP_100)}"
```

- [ ] **Step 2: 실패 테스트 작성**

Create `apps/worker/tests/test_jobs_bootstrap_stocks.py`:

```python
from unittest.mock import MagicMock, patch

from ygworker.data_sources.krx import KrxStockMaster
from ygworker.data_sources.yahoo import YahooQuote
from ygworker.jobs.bootstrap_stocks import run_bootstrap_stocks


def _yq(symbol: str, market: str, currency: str = "USD", price: float = 100.0) -> YahooQuote:
    return YahooQuote(
        symbol=symbol, name=f"{symbol} Corp", currency=currency, market=market,
        price=price, market_cap=1e12, per=20.0, sector="Tech",
        fifty_two_week_high=120.0, fifty_two_week_low=80.0,
    )


@patch("ygworker.jobs.bootstrap_stocks.list_top_stocks")
@patch("ygworker.jobs.bootstrap_stocks.fetch_quote")
def test_bootstrap_skips_if_table_not_empty(mock_quote, mock_top):
    fake_supabase = MagicMock()
    fake_supabase.table.return_value.select.return_value.limit.return_value.execute.return_value.data = [{"symbol": "AAPL"}]
    logger = MagicMock()

    run_bootstrap_stocks(fake_supabase, logger)

    mock_top.assert_not_called()
    mock_quote.assert_not_called()
    logger.info.assert_called_with("bootstrap_stocks.skip", reason="already_populated")


@patch("ygworker.jobs.bootstrap_stocks.fetch_quote")
@patch("ygworker.jobs.bootstrap_stocks.list_top_stocks")
def test_bootstrap_inserts_kr_top_and_us_top(mock_top, mock_quote):
    fake_supabase = MagicMock()
    fake_supabase.table.return_value.select.return_value.limit.return_value.execute.return_value.data = []
    fake_supabase.table.return_value.upsert.return_value.execute.return_value.data = []
    logger = MagicMock()

    mock_top.side_effect = [
        [KrxStockMaster("005930.KS", "KRX_KS", "삼성전자", 4e14)],     # KOSPI
        [KrxStockMaster("247540.KQ", "KRX_KQ", "에코프로비엠", 5e13)],  # KOSDAQ
    ]
    mock_quote.side_effect = lambda s: _yq(s, "KRX_KS" if s.endswith(".KS") else "KRX_KQ" if s.endswith(".KQ") else "NASDAQ", "KRW" if s.endswith((".KS", ".KQ")) else "USD")

    run_bootstrap_stocks(fake_supabase, logger, kr_limit=1, us_limit=2)

    upsert_calls = fake_supabase.table.return_value.upsert.call_args_list
    # 한 번에 batch upsert 또는 여러 번. 마지막 인자(records 리스트) 결합
    inserted_symbols = []
    for call in upsert_calls:
        records = call.args[0] if call.args else call.kwargs.get("records", [])
        if isinstance(records, list):
            inserted_symbols.extend([r["symbol"] for r in records])
    assert "005930.KS" in inserted_symbols
    assert "247540.KQ" in inserted_symbols
    # US top은 us_top.US_TOP_100 첫 2개
    assert "AAPL" in inserted_symbols
    assert "MSFT" in inserted_symbols
```

- [ ] **Step 3: 테스트 실패 확인**

Run: `cd apps/worker && uv run pytest tests/test_jobs_bootstrap_stocks.py -v`
Expected: ImportError

- [ ] **Step 4: 구현**

Create `apps/worker/src/ygworker/jobs/bootstrap_stocks.py`:

```python
from datetime import datetime, timezone
from typing import Any

from ygworker.data_sources.krx import KrxStockMaster, list_top_stocks
from ygworker.data_sources.us_top import US_TOP_100
from ygworker.data_sources.yahoo import YahooQuote, fetch_quote


def run_bootstrap_stocks(
    supabase: Any, logger: Any, kr_limit: int = 100, us_limit: int = 100
) -> None:
    """stocks 테이블이 비어있으면 KR 상위 + US 상위를 prefetch한다."""
    existing = (
        supabase.table("stocks").select("symbol").limit(1).execute().data
    )
    if existing:
        logger.info("bootstrap_stocks.skip", reason="already_populated")
        return

    logger.info("bootstrap_stocks.start", kr_limit=kr_limit, us_limit=us_limit)
    now = datetime.now(timezone.utc).isoformat()

    records: list[dict] = []

    # KR — KOSPI + KOSDAQ
    try:
        kospi = list_top_stocks("KOSPI", limit=kr_limit // 2)
        kosdaq = list_top_stocks("KOSDAQ", limit=kr_limit // 2)
    except Exception as exc:
        logger.error("bootstrap_stocks.kr_master_failed", error=str(exc))
        kospi, kosdaq = [], []

    for masters in (kospi, kosdaq):
        for m in masters:
            quote = _safe_quote(m.symbol, logger)
            records.append(_to_stock_row(m, quote, now))

    # US — top 100 하드코딩 리스트에서 us_limit개
    for symbol in US_TOP_100[:us_limit]:
        quote = _safe_quote(symbol, logger)
        if quote is None:
            continue
        records.append(_us_to_stock_row(symbol, quote, now))

    if records:
        supabase.table("stocks").upsert(records, on_conflict="symbol").execute()
        logger.info("bootstrap_stocks.done", inserted=len(records))
    else:
        logger.warning("bootstrap_stocks.no_records")


def _safe_quote(symbol: str, logger: Any) -> YahooQuote | None:
    try:
        return fetch_quote(symbol)
    except Exception as exc:
        logger.warning("bootstrap_stocks.quote_failed", symbol=symbol, error=str(exc))
        return None


def _to_stock_row(master: KrxStockMaster, quote: YahooQuote | None, now: str) -> dict:
    base = {
        "symbol": master.symbol,
        "market": master.market,
        "currency": "KRW",
        "name": master.name_ko,
        "name_ko": master.name_ko,
        "market_cap": master.market_cap,
        "is_active": True,
        "updated_at": now,
    }
    if quote is not None:
        base.update({
            "name": quote.name or master.name_ko,
            "last_price": quote.price,
            "last_price_at": now,
            "per": quote.per,
            "sector": quote.sector,
            "fifty_two_week_high": quote.fifty_two_week_high,
            "fifty_two_week_low": quote.fifty_two_week_low,
        })
    return base


def _us_to_stock_row(symbol: str, quote: YahooQuote, now: str) -> dict:
    return {
        "symbol": symbol,
        "market": quote.market,
        "currency": quote.currency,
        "name": quote.name,
        "name_ko": None,
        "market_cap": quote.market_cap,
        "per": quote.per,
        "sector": quote.sector,
        "last_price": quote.price,
        "last_price_at": now,
        "fifty_two_week_high": quote.fifty_two_week_high,
        "fifty_two_week_low": quote.fifty_two_week_low,
        "is_active": True,
        "updated_at": now,
    }
```

- [ ] **Step 5: 테스트 통과 + 커밋**

Run: `cd apps/worker && uv run pytest tests/test_jobs_bootstrap_stocks.py -v`
Expected: 2 PASS

```bash
git add apps/worker/src/ygworker/data_sources/us_top.py apps/worker/src/ygworker/jobs/bootstrap_stocks.py apps/worker/tests/test_jobs_bootstrap_stocks.py
git commit -m "feat(worker): add bootstrap_stocks job (TDD, prefetch top 100 KR + 100 US)"
```

---

## Task 11: jobs/fetch_prices (TDD)

**Files:**
- Create: `apps/worker/src/ygworker/jobs/fetch_prices.py`
- Create: `apps/worker/tests/test_jobs_fetch_prices.py`

**무엇을 하는가**: stocks 테이블에서 `is_active=true`인 모든 종목의 시세를 yahoo로 가져와 last_price/last_price_at 갱신. (Plan #2에서는 모든 active 종목 갱신. Plan #3에서 "보유∪펜딩∪관심" 범위로 좁힘.)

- [ ] **Step 1: 실패 테스트 작성**

Create `apps/worker/tests/test_jobs_fetch_prices.py`:

```python
from unittest.mock import MagicMock, patch

from ygworker.data_sources.yahoo import YahooQuote
from ygworker.jobs.fetch_prices import run_fetch_prices


def _yq(symbol, price=100.0, market="NASDAQ", currency="USD"):
    return YahooQuote(symbol=symbol, name=f"{symbol} Corp", currency=currency, market=market,
                     price=price, market_cap=None, per=None, sector=None,
                     fifty_two_week_high=None, fifty_two_week_low=None)


@patch("ygworker.jobs.fetch_prices.fetch_quotes")
def test_fetch_prices_updates_active_stocks(mock_fetch):
    fake = MagicMock()
    fake.table.return_value.select.return_value.eq.return_value.execute.return_value.data = [
        {"symbol": "AAPL"}, {"symbol": "MSFT"}, {"symbol": "005930.KS"},
    ]
    mock_fetch.return_value = [_yq("AAPL", 158.5), _yq("MSFT", 380.0), _yq("005930.KS", 70000.0, "KRX_KS", "KRW")]
    logger = MagicMock()

    run_fetch_prices(fake, logger)

    mock_fetch.assert_called_once_with(["AAPL", "MSFT", "005930.KS"])
    update_calls = fake.table.return_value.update.call_args_list
    assert len(update_calls) == 3
    updated_payload = [c.args[0] if c.args else c.kwargs for c in update_calls]
    assert all("last_price" in p and "last_price_at" in p for p in updated_payload)


@patch("ygworker.jobs.fetch_prices.fetch_quotes")
def test_fetch_prices_handles_empty_universe(mock_fetch):
    fake = MagicMock()
    fake.table.return_value.select.return_value.eq.return_value.execute.return_value.data = []
    logger = MagicMock()

    run_fetch_prices(fake, logger)

    mock_fetch.assert_not_called()
    logger.info.assert_called_with("fetch_prices.skip", reason="no_active_symbols")


@patch("ygworker.jobs.fetch_prices.fetch_quotes")
def test_fetch_prices_skips_failed_quotes(mock_fetch):
    fake = MagicMock()
    fake.table.return_value.select.return_value.eq.return_value.execute.return_value.data = [
        {"symbol": "AAPL"}, {"symbol": "BAD_SYMBOL"},
    ]
    # fetch_quotes는 실패한 심볼은 자동 누락
    mock_fetch.return_value = [_yq("AAPL", 158.5)]
    logger = MagicMock()

    run_fetch_prices(fake, logger)

    update_calls = fake.table.return_value.update.call_args_list
    assert len(update_calls) == 1
    # 업데이트된 건 AAPL뿐. BAD_SYMBOL는 update 호출 없음
```

- [ ] **Step 2: 테스트 실패 확인 → 구현**

Run: `cd apps/worker && uv run pytest tests/test_jobs_fetch_prices.py -v`
Expected: ImportError

Create `apps/worker/src/ygworker/jobs/fetch_prices.py`:

```python
from datetime import datetime, timezone
from typing import Any

from ygworker.data_sources.yahoo import fetch_quotes


def run_fetch_prices(supabase: Any, logger: Any) -> None:
    """is_active=true인 모든 stocks의 last_price/last_price_at을 갱신한다.

    NOTE: Plan #3 이후에는 보유/펜딩/관심 종목만으로 좁힐 예정.
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
        logger.info("fetch_prices.skip", reason="no_active_symbols")
        return

    logger.info("fetch_prices.start", count=len(symbols))
    quotes = fetch_quotes(symbols)
    now = datetime.now(timezone.utc).isoformat()

    for q in quotes:
        supabase.table("stocks").update(
            {"last_price": q.price, "last_price_at": now, "updated_at": now}
        ).eq("symbol", q.symbol).execute()

    logger.info("fetch_prices.done", fetched=len(quotes), missing=len(symbols) - len(quotes))
```

- [ ] **Step 3: 테스트 통과 + 커밋**

Run: `cd apps/worker && uv run pytest tests/test_jobs_fetch_prices.py -v`
Expected: 3 PASS

```bash
git add apps/worker/src/ygworker/jobs/fetch_prices.py apps/worker/tests/test_jobs_fetch_prices.py
git commit -m "feat(worker): add fetch_prices job (TDD, all active stocks)"
```

---

## Task 12: jobs/fetch_fx (TDD)

**Files:**
- Create: `apps/worker/src/ygworker/jobs/fetch_fx.py`
- Create: `apps/worker/tests/test_jobs_fetch_fx.py`

- [ ] **Step 1: 실패 테스트 작성**

Create `apps/worker/tests/test_jobs_fetch_fx.py`:

```python
from unittest.mock import MagicMock, patch

from ygworker.jobs.fetch_fx import run_fetch_fx


@patch("ygworker.jobs.fetch_fx.fetch_usd_krw_rate")
def test_fetch_fx_inserts_row(mock_rate):
    mock_rate.return_value = 1395.42
    fake = MagicMock()
    logger = MagicMock()

    run_fetch_fx(fake, logger)

    insert_call = fake.table.return_value.insert.call_args
    payload = insert_call.args[0] if insert_call.args else insert_call.kwargs.get("rows", [])
    assert payload["base"] == "USD"
    assert payload["quote"] == "KRW"
    assert payload["rate"] == 1395.42
    assert "ts" in payload


@patch("ygworker.jobs.fetch_fx.fetch_usd_krw_rate")
def test_fetch_fx_logs_error_on_failure(mock_rate):
    mock_rate.side_effect = RuntimeError("API down")
    fake = MagicMock()
    logger = MagicMock()

    run_fetch_fx(fake, logger)

    logger.error.assert_called_once()
    fake.table.return_value.insert.assert_not_called()
```

- [ ] **Step 2: 구현**

Create `apps/worker/src/ygworker/jobs/fetch_fx.py`:

```python
from datetime import datetime, timezone
from typing import Any

from ygworker.data_sources.fx import fetch_usd_krw_rate


def run_fetch_fx(supabase: Any, logger: Any) -> None:
    """exchangerate.host에서 USD/KRW 환율을 가져와 fx_rates에 INSERT."""
    try:
        rate = fetch_usd_krw_rate()
    except Exception as exc:
        logger.error("fetch_fx.failed", error=str(exc))
        return

    supabase.table("fx_rates").insert(
        {
            "base": "USD",
            "quote": "KRW",
            "rate": rate,
            "ts": datetime.now(timezone.utc).isoformat(),
        }
    ).execute()
    logger.info("fetch_fx.done", rate=rate)
```

- [ ] **Step 3: 테스트 통과 + 커밋**

Run: `cd apps/worker && uv run pytest tests/test_jobs_fetch_fx.py -v`
Expected: 2 PASS

```bash
git add apps/worker/src/ygworker/jobs/fetch_fx.py apps/worker/tests/test_jobs_fetch_fx.py
git commit -m "feat(worker): add fetch_fx job (USD/KRW every 30 min)"
```

---

## Task 13: RPC — FastAPI app + /rpc/stocks/lookup

**Files:**
- Create: `apps/worker/src/ygworker/rpc/__init__.py`
- Create: `apps/worker/src/ygworker/rpc/app.py`
- Create: `apps/worker/src/ygworker/rpc/stocks.py`
- Create: `apps/worker/tests/test_rpc_stocks_lookup.py`

- [ ] **Step 1: __init__.py**

Create `apps/worker/src/ygworker/rpc/__init__.py` (empty).

- [ ] **Step 2: 실패 테스트 작성**

Create `apps/worker/tests/test_rpc_stocks_lookup.py`:

```python
from unittest.mock import MagicMock, patch

import pytest
from fastapi.testclient import TestClient

from ygworker.data_sources.yahoo import YahooQuote
from ygworker.rpc.app import build_app


def _yq(symbol="AAPL"):
    return YahooQuote(symbol=symbol, name="Apple Inc.", currency="USD", market="NASDAQ",
                     price=158.5, market_cap=2.5e12, per=28.5, sector="Technology",
                     fifty_two_week_high=200.0, fifty_two_week_low=120.0)


@pytest.fixture
def client():
    fake_supabase = MagicMock()
    app = build_app(supabase=fake_supabase, secret="test-secret")
    return TestClient(app), fake_supabase


def test_lookup_unauthenticated_returns_401(client):
    c, _ = client
    r = c.post("/rpc/stocks/lookup", json={"symbol": "AAPL"})
    assert r.status_code == 401


def test_lookup_wrong_secret_returns_401(client):
    c, _ = client
    r = c.post(
        "/rpc/stocks/lookup",
        json={"symbol": "AAPL"},
        headers={"X-Worker-Secret": "wrong"},
    )
    assert r.status_code == 401


@patch("ygworker.rpc.stocks.fetch_quote")
def test_lookup_returns_quote_and_upserts(mock_quote, client):
    c, fake_supabase = client
    mock_quote.return_value = _yq("AAPL")
    r = c.post(
        "/rpc/stocks/lookup",
        json={"symbol": "AAPL"},
        headers={"X-Worker-Secret": "test-secret"},
    )
    assert r.status_code == 200
    body = r.json()
    assert body["symbol"] == "AAPL"
    assert body["name"] == "Apple Inc."
    assert body["price"] == 158.5
    assert body["market"] == "NASDAQ"
    fake_supabase.table.assert_called_with("stocks")


@patch("ygworker.rpc.stocks.fetch_quote")
def test_lookup_unknown_symbol_returns_404(mock_quote, client):
    c, _ = client
    mock_quote.return_value = None
    r = c.post(
        "/rpc/stocks/lookup",
        json={"symbol": "INVALID"},
        headers={"X-Worker-Secret": "test-secret"},
    )
    assert r.status_code == 404
```

- [ ] **Step 3: app + stocks.py 구현**

Create `apps/worker/src/ygworker/rpc/stocks.py`:

```python
from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Header
from pydantic import BaseModel

from ygworker.data_sources.yahoo import fetch_quote


class LookupRequest(BaseModel):
    symbol: str


class LookupResponse(BaseModel):
    symbol: str
    name: str
    market: str
    currency: str
    price: float
    name_ko: str | None = None


def make_router(supabase: Any, secret: str) -> APIRouter:
    router = APIRouter()

    def _check_secret(x_worker_secret: str | None = Header(default=None)) -> None:
        if x_worker_secret != secret:
            raise HTTPException(status_code=401, detail="unauthorized")

    @router.post("/rpc/stocks/lookup", response_model=LookupResponse)
    def lookup(req: LookupRequest, _: None = Depends(_check_secret)) -> LookupResponse:
        quote = fetch_quote(req.symbol)
        if quote is None:
            raise HTTPException(status_code=404, detail="not_found")

        now = datetime.now(timezone.utc).isoformat()
        # ad-hoc 조회된 종목은 한국어명을 알 수 없음 (yfinance에 한국어 표기 없음).
        # 한국 종목(.KS/.KQ)이면 quote.name이 영문일 것 — 실제 표시는 search 컴포넌트의
        # `name_ko ?? name` 폴백에 의존. 향후 pykrx로 한국어명 보강 가능.
        record = {
            "symbol": quote.symbol,
            "market": quote.market,
            "currency": quote.currency,
            "name": quote.name,
            "name_ko": None,
            "market_cap": quote.market_cap,
            "per": quote.per,
            "sector": quote.sector,
            "last_price": quote.price,
            "last_price_at": now,
            "fifty_two_week_high": quote.fifty_two_week_high,
            "fifty_two_week_low": quote.fifty_two_week_low,
            "is_active": True,
            "updated_at": now,
        }
        supabase.table("stocks").upsert(record, on_conflict="symbol").execute()

        return LookupResponse(
            symbol=quote.symbol,
            name=quote.name,
            market=quote.market,
            currency=quote.currency,
            price=quote.price,
        )

    return router
```

Create `apps/worker/src/ygworker/rpc/app.py`:

```python
from typing import Any

from fastapi import FastAPI

from ygworker.rpc.stocks import make_router as make_stocks_router


def build_app(supabase: Any, secret: str) -> FastAPI:
    app = FastAPI(title="YGinvest Worker RPC")

    @app.get("/health")
    def health() -> dict:
        return {"ok": True}

    app.include_router(make_stocks_router(supabase, secret))
    return app
```

- [ ] **Step 4: 테스트 통과 + 커밋**

Run: `cd apps/worker && uv run pytest tests/test_rpc_stocks_lookup.py -v`
Expected: 4 PASS

```bash
git add apps/worker/src/ygworker/rpc/ apps/worker/tests/test_rpc_stocks_lookup.py
git commit -m "feat(worker): add FastAPI RPC with /rpc/stocks/lookup (TDD)"
```

---

## Task 14: 워커 main.py — AsyncIOScheduler + FastAPI 통합

**Files:**
- Modify: `apps/worker/src/ygworker/config.py`
- Modify: `apps/worker/src/ygworker/main.py`
- Modify: `apps/worker/.env.example`
- Modify: `apps/worker/.env`

- [ ] **Step 1: config.py에 RPC 설정 추가**

Replace `apps/worker/src/ygworker/config.py`:

```python
import os
from dataclasses import dataclass

from dotenv import load_dotenv

load_dotenv()


@dataclass(frozen=True)
class Settings:
    supabase_url: str
    supabase_service_role_key: str
    log_level: str = "INFO"
    rpc_port: int = 8080
    rpc_secret: str = "dev-secret-change-me"


def load_settings() -> Settings:
    return Settings(
        supabase_url=_required("SUPABASE_URL"),
        supabase_service_role_key=_required("SUPABASE_SERVICE_ROLE_KEY"),
        log_level=os.environ.get("LOG_LEVEL", "INFO"),
        rpc_port=int(os.environ.get("WORKER_RPC_PORT", "8080")),
        rpc_secret=os.environ.get("WORKER_RPC_SECRET", "dev-secret-change-me"),
    )


def _required(key: str) -> str:
    value = os.environ.get(key)
    if not value:
        raise RuntimeError(f"환경변수 누락: {key}")
    return value
```

- [ ] **Step 2: main.py 재작성**

Replace `apps/worker/src/ygworker/main.py`:

```python
import asyncio
import logging
import signal
from typing import Any

import structlog
import uvicorn
from apscheduler.schedulers.asyncio import AsyncIOScheduler

from ygworker.config import load_settings
from ygworker.jobs.bootstrap_stocks import run_bootstrap_stocks
from ygworker.jobs.fetch_fx import run_fetch_fx
from ygworker.jobs.fetch_prices import run_fetch_prices
from ygworker.jobs.heartbeat import run_heartbeat
from ygworker.market_hours import is_any_market_open
from ygworker.rpc.app import build_app
from ygworker.supabase_client import make_client


def _make_logger(level: str) -> Any:
    structlog.configure(
        processors=[
            structlog.processors.add_log_level,
            structlog.processors.TimeStamper(fmt="iso"),
            structlog.processors.JSONRenderer(),
        ],
        wrapper_class=structlog.make_filtering_bound_logger(getattr(logging, level)),
    )
    return structlog.get_logger()


def _wrap_in_thread(fn, *args):
    """sync 잡을 asyncio 이벤트 루프에서 안전하게 실행."""

    async def runner():
        return await asyncio.to_thread(fn, *args)

    return runner


async def main_async() -> None:
    settings = load_settings()
    logger = _make_logger(settings.log_level)
    supabase = make_client(settings)

    logger.info("worker.starting", supabase_url=settings.supabase_url, rpc_port=settings.rpc_port)

    # 부팅 시 1회: 종목 마스터 prefetch
    await asyncio.to_thread(run_bootstrap_stocks, supabase, logger)

    scheduler = AsyncIOScheduler(timezone="Asia/Seoul")
    scheduler.add_job(
        _wrap_in_thread(run_heartbeat, supabase, logger),
        trigger="interval", seconds=60, id="heartbeat", replace_existing=True,
    )
    scheduler.add_job(
        _gated_fetch_prices(supabase, logger),
        trigger="interval", seconds=60, id="fetch_prices", replace_existing=True,
    )
    scheduler.add_job(
        _wrap_in_thread(run_fetch_fx, supabase, logger),
        trigger="interval", minutes=30, id="fetch_fx", replace_existing=True,
    )
    scheduler.start()
    logger.info("worker.scheduler_started")

    # 부팅 직후 한 번 fx 갱신
    # NOTE: run_fetch_fx 내부에서 예외를 catch + log하므로 외부 API 일시 장애여도
    #       워커 부팅이 죽지 않음. 다음 30분 사이클에 자동 재시도.
    await asyncio.to_thread(run_fetch_fx, supabase, logger)

    # FastAPI 시작
    app = build_app(supabase=supabase, secret=settings.rpc_secret)
    config = uvicorn.Config(app, host="0.0.0.0", port=settings.rpc_port, log_config=None, lifespan="off")
    server = uvicorn.Server(config)

    # SIGTERM/SIGINT 핸들러
    loop = asyncio.get_running_loop()
    stop_event = asyncio.Event()

    def _stop():
        logger.info("worker.stopping")
        stop_event.set()

    for sig in (signal.SIGINT, getattr(signal, "SIGTERM", signal.SIGINT)):
        try:
            loop.add_signal_handler(sig, _stop)
        except NotImplementedError:
            # Windows에서는 add_signal_handler 미지원 → 그냥 KeyboardInterrupt에 의존
            pass

    server_task = asyncio.create_task(server.serve())
    stop_task = asyncio.create_task(stop_event.wait())

    done, pending = await asyncio.wait(
        {server_task, stop_task}, return_when=asyncio.FIRST_COMPLETED
    )
    if stop_event.is_set():
        server.should_exit = True
        await server_task
    scheduler.shutdown(wait=False)


def _gated_fetch_prices(supabase: Any, logger: Any):
    async def runner():
        if not is_any_market_open():
            logger.debug("fetch_prices.gated", reason="no_market_open")
            return
        await asyncio.to_thread(run_fetch_prices, supabase, logger)

    return runner


def main() -> None:
    asyncio.run(main_async())


if __name__ == "__main__":
    main()
```

- [ ] **Step 3: env 파일 갱신**

Replace `apps/worker/.env.example`:

```
SUPABASE_URL=http://127.0.0.1:54321
SUPABASE_SERVICE_ROLE_KEY=<from supabase status: Secret>
LOG_LEVEL=INFO
WORKER_RPC_PORT=8080
WORKER_RPC_SECRET=dev-secret-change-me
```

Replace `apps/worker/.env`:

```
SUPABASE_URL=http://127.0.0.1:54321
SUPABASE_SERVICE_ROLE_KEY=sb_secret_N7UND0UgjKTVK-Uodkm0Hg_xSvEMPvz
LOG_LEVEL=INFO
WORKER_RPC_PORT=8080
WORKER_RPC_SECRET=local-dev-shared-secret
```

- [ ] **Step 4: 단위 테스트 전체 재실행**

Run: `cd apps/worker && uv run pytest tests/ -v 2>&1 | tail -20`
Expected: 모든 테스트 통과 (Plan #1 통합 3 + 단위 2 + Plan #2 신규 단위들). 통합 테스트(`test_signup_trigger.py`)는 Supabase 떠있어야 통과.

- [ ] **Step 5: 워커 부팅 수동 검증**

Run (백그라운드 또는 별 터미널):
```bash
cd apps/worker
PYTHONPATH=src uv run python -m ygworker.main
```

Expected 로그 (요약):
- `worker.starting`
- `bootstrap_stocks.start` → 200개 종목 upsert → `bootstrap_stocks.done`
- `worker.scheduler_started`
- `fetch_fx.done` (rate 약 1300-1500)
- (장 마감 중이면) `fetch_prices.gated` 또는 (장중) `fetch_prices.done`
- `Uvicorn running on http://0.0.0.0:8080`

healthcheck:
```bash
curl http://localhost:8080/health
# {"ok": true}
```

Studio Studio (http://127.0.0.1:54323) → `stocks` 테이블 → 약 200행, `fx_rates` 1행 확인.

⚠️ pykrx의 KRX 호출이 실제 인터넷 + KRX 사이트 응답에 의존. 실패 시 워커 로그 확인.

Ctrl+C로 종료.

- [ ] **Step 6: 커밋**

```bash
git add apps/worker/src/ygworker/config.py apps/worker/src/ygworker/main.py apps/worker/.env.example apps/worker/.env
git commit -m "feat(worker): integrate AsyncIOScheduler + FastAPI in single process

- Bootstrap stocks on startup (KR + US prefetch)
- Periodic jobs: heartbeat (1m), fetch_prices (1m, market-gated), fetch_fx (30m)
- FastAPI on :8080 with /health and /rpc/stocks/lookup
- Graceful shutdown on SIGINT/SIGTERM
- WORKER_RPC_PORT, WORKER_RPC_SECRET env vars"
```

---

## Task 15: Dockerfile 갱신 (포트 노출)

**Files:**
- Modify: `apps/worker/Dockerfile`

- [ ] **Step 1: Dockerfile 수정**

Replace `apps/worker/Dockerfile`:

```dockerfile
FROM python:3.12-slim

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1

# uv 설치
COPY --from=ghcr.io/astral-sh/uv:latest /uv /usr/local/bin/uv

WORKDIR /app

# 의존성만 먼저 복사 (캐시)
COPY pyproject.toml uv.lock ./
RUN uv sync --frozen --no-dev

# 소스 복사
COPY src ./src

ENV PYTHONPATH=/app/src

EXPOSE 8080

CMD ["uv", "run", "--no-dev", "python", "-m", "ygworker.main"]
```

- [ ] **Step 2: 빌드 검증**

Run: `cd apps/worker && docker build -t yginvest-worker:dev . 2>&1 | tail -5`
Expected: 빌드 성공

- [ ] **Step 3: 커밋**

```bash
git add apps/worker/Dockerfile
git commit -m "chore(worker): expose 8080 in Dockerfile for FastAPI RPC"
```

---

## Task 16: Web — workerRpc 헬퍼

**Files:**
- Create: `apps/web/lib/workerRpc.ts`

- [ ] **Step 1: workerRpc 작성**

Create `apps/web/lib/workerRpc.ts`:

```typescript
const WORKER_URL = process.env.WORKER_RPC_URL ?? "http://localhost:8080";
const WORKER_SECRET = process.env.WORKER_RPC_SECRET ?? "";

export type WorkerLookupResult = {
  symbol: string;
  name: string;
  market: string;
  currency: string;
  price: number;
  name_ko: string | null;
};

export async function lookupStock(symbol: string): Promise<WorkerLookupResult | null> {
  const res = await fetch(`${WORKER_URL}/rpc/stocks/lookup`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Worker-Secret": WORKER_SECRET,
    },
    body: JSON.stringify({ symbol }),
    signal: AbortSignal.timeout(8000),
    cache: "no-store",
  });

  if (res.status === 404) return null;
  if (!res.ok) {
    throw new Error(`worker lookup failed: ${res.status}`);
  }
  return (await res.json()) as WorkerLookupResult;
}
```

- [ ] **Step 2: 환경변수 추가**

Edit `apps/web/.env.local.example`:

```
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=<from supabase status: Publishable>
SUPABASE_SERVICE_ROLE_KEY=<from supabase status: Secret>
WORKER_RPC_URL=http://localhost:8080
WORKER_RPC_SECRET=<same as worker .env WORKER_RPC_SECRET>
```

Edit `apps/web/.env.local`:

```
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH
SUPABASE_SERVICE_ROLE_KEY=sb_secret_N7UND0UgjKTVK-Uodkm0Hg_xSvEMPvz
WORKER_RPC_URL=http://localhost:8080
WORKER_RPC_SECRET=local-dev-shared-secret
```

- [ ] **Step 3: 커밋**

```bash
git add apps/web/lib/workerRpc.ts apps/web/.env.local.example apps/web/.env.local
git commit -m "feat(web): add workerRpc helper for /rpc/stocks/lookup"
```

---

## Task 17: Web — search API route

**Files:**
- Create: `apps/web/app/api/stocks/search/route.ts`
- Create: `apps/web/app/api/stocks/lookup/route.ts`

- [ ] **Step 1: search route**

Create `apps/web/app/api/stocks/search/route.ts`:

```typescript
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = (searchParams.get("q") ?? "").trim();
  if (q.length === 0) {
    return NextResponse.json({ results: [] });
  }

  const supabase = await createClient();

  // symbol exact + prefix + 이름 trigram. 한 번의 OR로 처리.
  const escaped = q.replace(/[%_]/g, (c) => "\\" + c);
  const { data, error } = await supabase
    .from("stocks")
    .select("symbol, name, name_ko, market, currency, last_price, last_price_at")
    .or(
      [
        `symbol.ilike.${escaped}%`,
        `name.ilike.%${escaped}%`,
        `name_ko.ilike.%${escaped}%`,
      ].join(",")
    )
    .eq("is_active", true)
    .order("market_cap", { ascending: false, nullsFirst: false })
    .limit(20);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ results: data ?? [] });
}
```

- [ ] **Step 2: lookup route (ad-hoc)**

Create `apps/web/app/api/stocks/lookup/route.ts`:

```typescript
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { lookupStock } from "@/lib/workerRpc";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const symbol = (body?.symbol ?? "").trim();
  if (symbol.length === 0) {
    return NextResponse.json({ error: "symbol required" }, { status: 400 });
  }

  try {
    const result = await lookupStock(symbol);
    if (!result) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json({ error: "worker_unreachable" }, { status: 503 });
  }
}
```

- [ ] **Step 3: 커밋**

```bash
git add apps/web/app/api/stocks/
git commit -m "feat(web): add /api/stocks/search and /api/stocks/lookup routes"
```

---

## Task 18: Web — 검색 컴포넌트 + 페이지

**Files:**
- Create: `apps/web/components/stock-search.tsx`
- Create: `apps/web/app/app/trade/page.tsx`
- Create: `apps/web/app/app/trade/search/page.tsx`
- Create: `apps/web/app/app/trade/[symbol]/page.tsx`
- Modify: `apps/web/app/app/dashboard/page.tsx`

- [ ] **Step 1: 검색 클라이언트 컴포넌트**

Create `apps/web/components/stock-search.tsx`:

```tsx
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

type Result = {
  symbol: string;
  name: string;
  name_ko: string | null;
  market: string;
  currency: string;
  last_price: number | null;
};

const KRW = new Intl.NumberFormat("ko-KR", { style: "currency", currency: "KRW", maximumFractionDigits: 0 });
const USD = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });

function formatPrice(price: number | null, currency: string): string {
  if (price == null) return "—";
  return currency === "KRW" ? KRW.format(price) : USD.format(price);
}

export function StockSearch() {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Result[]>([]);
  const [loading, setLoading] = useState(false);
  const [showLookup, setShowLookup] = useState(false);
  const [lookupError, setLookupError] = useState<string | null>(null);

  useEffect(() => {
    if (q.trim().length === 0) {
      setResults([]);
      setShowLookup(false);
      return;
    }
    setLoading(true);
    const t = setTimeout(async () => {
      const res = await fetch(`/api/stocks/search?q=${encodeURIComponent(q)}`);
      const json = await res.json();
      setResults(json.results ?? []);
      setShowLookup((json.results ?? []).length === 0);
      setLoading(false);
    }, 250);
    return () => clearTimeout(t);
  }, [q]);

  async function adHocLookup() {
    setLookupError(null);
    setLoading(true);
    const res = await fetch("/api/stocks/lookup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ symbol: q.trim() }),
    });
    setLoading(false);
    if (res.ok) {
      const r = (await res.json()) as Result;
      setResults([r]);
      setShowLookup(false);
    } else if (res.status === 404) {
      setLookupError("해당 심볼을 찾을 수 없습니다.");
    } else {
      setLookupError("워커 응답 실패. 잠시 후 다시 시도해주세요.");
    }
  }

  return (
    <div className="space-y-4">
      <Input
        type="search"
        placeholder="종목명 또는 심볼 (예: 삼성전자, AAPL, 005930)"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        autoFocus
      />
      {loading && <div className="text-sm text-muted-foreground">검색 중...</div>}
      <ul className="space-y-2">
        {results.map((r) => (
          <li key={r.symbol}>
            <Link href={`/app/trade/${encodeURIComponent(r.symbol)}`}>
              <Card className="hover:bg-muted/30 transition">
                <CardContent className="py-3 flex items-center justify-between">
                  <div>
                    <div className="font-medium">{r.name_ko ?? r.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {r.symbol} · {r.market}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-mono">{formatPrice(r.last_price, r.currency)}</div>
                    <div className="text-xs text-muted-foreground">{r.currency}</div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          </li>
        ))}
      </ul>
      {showLookup && q.trim().length > 0 && (
        <div className="text-sm text-muted-foreground space-y-2">
          <div>로컬 캐시에 없는 종목입니다.</div>
          <Button variant="outline" onClick={adHocLookup} disabled={loading}>
            "{q.trim()}"을(를) Yahoo Finance에서 직접 조회
          </Button>
          {lookupError && <div className="text-destructive text-xs">{lookupError}</div>}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: trade 라우트들**

Create `apps/web/app/app/trade/page.tsx`:

```tsx
import { redirect } from "next/navigation";

export default function Trade() {
  redirect("/app/trade/search");
}
```

Create `apps/web/app/app/trade/search/page.tsx`:

```tsx
import { StockSearch } from "@/components/stock-search";

export default function SearchPage() {
  return (
    <div className="max-w-3xl mx-auto p-6 space-y-4">
      <h1 className="text-2xl font-bold">종목 검색</h1>
      <StockSearch />
    </div>
  );
}
```

Create `apps/web/app/app/trade/[symbol]/page.tsx`:

```tsx
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const KRW = new Intl.NumberFormat("ko-KR", { style: "currency", currency: "KRW", maximumFractionDigits: 0 });
const USD = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });

export default async function StockDetail({ params }: { params: Promise<{ symbol: string }> }) {
  const { symbol } = await params;
  const supabase = await createClient();
  const { data: stock } = await supabase
    .from("stocks")
    .select("*")
    .eq("symbol", decodeURIComponent(symbol))
    .single();

  if (!stock) notFound();

  const fmt = stock.currency === "KRW" ? KRW : USD;

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-4">
      <div>
        <div className="text-xs text-muted-foreground">{stock.symbol} · {stock.market}</div>
        <h1 className="text-2xl font-bold">{stock.name_ko ?? stock.name}</h1>
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
      <Card>
        <CardHeader>
          <CardTitle className="text-base">거래</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          매수/매도는 Plan #3에서 추가됩니다. 차트와 지표는 Plan #4에서 추가됩니다.
        </CardContent>
      </Card>
    </div>
  );
}
```

- [ ] **Step 3: dashboard에 거래 페이지 링크 추가**

Edit `apps/web/app/app/dashboard/page.tsx`. `<Card>` 곧 추가될 기능 내부를 다음과 같이 갱신:

```tsx
import Link from "next/link";
// ... 기존 imports

// CardContent 내부 (곧 추가될 기능 카드):
<CardContent className="text-sm text-muted-foreground space-y-2">
  <div>
    <Link href="/app/trade/search" className="text-foreground underline">
      → 종목 검색하기 (Plan #2 완료)
    </Link>
  </div>
  <div>· 매수/매도 + 환전 (Plan #3)</div>
  <div>· 종목 상세 차트 + 지표 (Plan #4)</div>
  <div>· 친구방 + 리더보드 (Plan #5)</div>
</CardContent>
```

- [ ] **Step 4: 빌드 검증 + 수동 검증**

Run: `cd apps/web && npm run build`
Expected: 새 라우트들 추가됨 (`/app/trade`, `/app/trade/search`, `/app/trade/[symbol]`, `/api/stocks/search`, `/api/stocks/lookup`)

수동: 워커가 떠 있고 stocks가 prefetch된 상태에서 `npm run dev` → 가입 → 대시보드 → "종목 검색하기" → "삼성"·"AAPL" 검색 → 결과 클릭 → 상세 페이지에 가격 표시.

- [ ] **Step 5: 커밋**

```bash
git add apps/web/components/stock-search.tsx apps/web/app/app/trade/ apps/web/app/app/dashboard/page.tsx
git commit -m "feat(web): add stock search UI + minimal detail page

- /app/trade/search with debounced search and ad-hoc lookup fallback
- /app/trade/[symbol] minimal detail (price, 52w, sector, marketCap, PER)
- Dashboard now links to search page"
```

---

## Task 19: E2E 테스트 — 검색 플로우

**Files:**
- Create: `apps/web/tests/e2e/stock-search.spec.ts`

이 테스트는 **stocks 테이블에 데이터가 있다고 가정**한다. CI에서는 통합 환경 없이는 못 돌리므로 로컬에서만. 테스트 시작 시 상태 점검 후 1행 이상 있을 때만 진행.

- [ ] **Step 1: 테스트 작성**

Create `apps/web/tests/e2e/stock-search.spec.ts`:

```typescript
import { test, expect } from "@playwright/test";

async function signupAndGoToSearch(page) {
  const email = `search-${Date.now()}@test.com`;
  await page.goto("/auth/login");
  await page.getByRole("button", { name: /가입하기/i }).click();
  await page.getByLabel("이메일").fill(email);
  await page.getByLabel("비밀번호").fill("TestPass123!");
  await page.getByRole("button", { name: /^가입$/i }).click();
  await expect(page).toHaveURL(/\/app\/dashboard/, { timeout: 15_000 });
  await page.goto("/app/trade/search");
  await expect(page.getByRole("heading", { name: "종목 검색" })).toBeVisible();
}

test.describe("Stock search flow", () => {
  test("search by Korean name returns Samsung", async ({ page }) => {
    await signupAndGoToSearch(page);

    await page.getByPlaceholder(/종목명 또는 심볼/i).fill("삼성전자");

    // 결과 카드에 "삼성전자" 표시
    await expect(page.getByText("삼성전자").first()).toBeVisible({ timeout: 10_000 });

    // 클릭하여 상세 페이지 이동
    await page.getByText("삼성전자").first().click();
    await expect(page).toHaveURL(/\/app\/trade\/005930\.KS/);
    await expect(page.getByRole("heading", { name: "삼성전자" })).toBeVisible();
    await expect(page.getByText("현재가")).toBeVisible();
  });

  test("search by US ticker returns AAPL", async ({ page }) => {
    await signupAndGoToSearch(page);

    await page.getByPlaceholder(/종목명 또는 심볼/i).fill("AAPL");
    await expect(page.getByText("AAPL")).toBeVisible({ timeout: 10_000 });

    await page.getByText("Apple").first().click();
    await expect(page).toHaveURL(/\/app\/trade\/AAPL/);
  });

  test("unknown symbol shows ad-hoc lookup option", async ({ page }) => {
    await signupAndGoToSearch(page);

    await page.getByPlaceholder(/종목명 또는 심볼/i).fill("ZZZNOTREAL");
    await expect(page.getByText(/로컬 캐시에 없는 종목/)).toBeVisible({ timeout: 5_000 });
  });
});
```

- [ ] **Step 2: 사전 점검 (테스트 전제)**

Run: `cd apps/worker && PYTHONPATH=src uv run python -m ygworker.main &`
또는 별도 터미널에서 워커 실행.

워커 부팅이 끝나면(약 30초~1분, KR 100 + US 100 fetch 완료까지) Studio에서 stocks 테이블 행 ≥ 100 확인.

- [ ] **Step 3: E2E 실행**

Run: `cd apps/web && npx playwright test tests/e2e/stock-search.spec.ts -v`
Expected: 3 PASS (Plan #1의 2개와 함께 총 5 PASS도 가능: `npx playwright test`로 전체 실행)

⚠️ Apple 결과의 한국어 표시명이 없으므로 "Apple"로 매칭. 첫 번째 검색 결과에 "Apple Inc." 가 있어야 함. yfinance가 다른 이름 반환할 가능성 있어 어시션 일부 유연하게.

- [ ] **Step 4: 커밋**

```bash
git add apps/web/tests/e2e/stock-search.spec.ts
git commit -m "test(web): E2E for stock search (KR by name, US by ticker, ad-hoc fallback)"
```

---

## Task 20: README 갱신

**Files:**
- Modify: `README.md`

- [ ] **Step 1: README 진행 상태 섹션 갱신**

Edit `README.md` "진행 상태" 섹션을 다음으로 교체:

```markdown
## 진행 상태

### Plan #1 — Foundation ✅ 완료 (master)

(이전과 동일)

### Plan #2 — Stock Universe & Price Feed ✅ 완료 (이 brunch)

- [x] DB: stocks (trigram 검색 인덱스), fx_rates 테이블 + RLS
- [x] 워커 데이터 소스: yahoo (yfinance) · krx (pykrx) · fx (exchangerate.host) — 모두 TDD with mocks
- [x] 워커 잡: bootstrap_stocks (KR top 100 + US top 100), fetch_prices (1분 / 장중), fetch_fx (30분)
- [x] AsyncIOScheduler + FastAPI 통합 (1 process, port 8080)
- [x] /rpc/stocks/lookup ad-hoc ticker 조회 RPC
- [x] Web: /api/stocks/search + /api/stocks/lookup
- [x] Web: /app/trade/search + /app/trade/[symbol] 페이지
- [x] E2E: 검색 → 상세 페이지 (KR 한국어, US 심볼, 알 수 없는 심볼 fallback)

### 다음 plans

- Plan #3: Trading Core (시장가/지정가/환전, 매칭 엔진)
- Plan #4: Trading UI (종목 상세 차트 + 매수/매도 시트)
- Plan #5: Rooms & Leaderboard
- Plan #6: 배당, 분할, Web Push, 추천
- Plan #7: PWA & Polish
```

- [ ] **Step 2: 디버깅 섹션 보강**

`디버깅 팁` 아래에 추가:

```markdown
- **워커 RPC가 안 잡힘**: 워커가 떠있는지 (`curl http://localhost:8080/health`), 그리고 `apps/web/.env.local`의 `WORKER_RPC_URL`/`WORKER_RPC_SECRET`이 워커 `.env`와 일치하는지 확인
- **stocks 테이블이 비어있음**: 워커 부팅 시 bootstrap_stocks가 한 번 돌아야 함. 처음 부팅 후 ~1분 정도 대기. KRX/Yahoo가 일시적으로 응답 안 하면 다음 부팅 때 재시도 (이미 비어있는 경우만 prefetch)
- **pykrx 호출 실패**: KRX 사이트 응답이 일시적으로 느릴 수 있음. tenacity 3회 재시도 자동. 그래도 실패하면 다음 부팅 또는 `refresh_master` 잡(미구현, Plan #2.5 후순위)을 기다림
```

- [ ] **Step 3: 커밋**

```bash
git add README.md
git commit -m "docs: update README for Plan #2 completion"
```

---

## 마무리 검증 체크리스트

- [ ] **로컬 워커 부팅**: `bootstrap_stocks.done inserted=200` 정도 출력 (KR/US 합계 ±10 허용 — pykrx 실패 시 KR이 부분만)
- [ ] **stocks 테이블 행 수**: ≥ 100
- [ ] **fx_rates 테이블**: ≥ 1행 (USD/KRW)
- [ ] **워커 헬스**: `curl http://localhost:8080/health` → `{"ok": true}`
- [ ] **워커 RPC**: `curl -X POST http://localhost:8080/rpc/stocks/lookup -H "X-Worker-Secret: local-dev-shared-secret" -H "Content-Type: application/json" -d '{"symbol":"NVDA"}'` → 200
- [ ] **단위 테스트**: `cd apps/worker && uv run pytest` → 모든 PASS (이전 5개 + 새 ~15개)
- [ ] **lint**: `cd apps/worker && uv run ruff check .` → All checks passed
- [ ] **웹 빌드**: `cd apps/web && npm run build` → 성공
- [ ] **웹 lint/typecheck**: `npm run lint && npx tsc --noEmit` → clean
- [ ] **E2E**: `cd apps/web && npx playwright test` → 모든 PASS (Plan #1 2 + Plan #2 3 = 5)
- [ ] **수동**: 가입 → 대시보드 → 종목 검색 → "삼성전자" 또는 "AAPL" 검색 → 클릭 → 상세 페이지에 가격 표시

---

## Plan #2에 포함되지 않은 것 (다음 plans)

| 항목 | Plan |
|------|------|
| OHLCV 차트 (15m/1h/1d) + Lightweight Charts | #4 |
| stock_bars 테이블 | #4 |
| 종목 뉴스 | #4 |
| 재무제표 표시 | #4 |
| holdings/orders/trades/fx_transactions | #3 |
| 시장가/지정가 주문 + 매칭 엔진 | #3 |
| 환전 API | #3 |
| 매수/매도 시트 | #4 |
| 일별 stocks master 재갱신 잡 (refresh_master) | Plan #2.5 (선택) 또는 Plan #3에서 함께 |
| 관심종목 (watchlists) | #4 |

---

## 디버깅 팁

- **`bootstrap_stocks.kr_master_failed`** 로그: pykrx의 KRX 사이트 호출 실패. 다음 부팅 시 재시도 (이미 행이 있으면 skip이지만, 0행일 때는 매번 재시도). 인터넷 연결 + KRX 응답 확인.
- **yfinance에서 `regularMarketPrice` 없음**: yfinance가 일부 ETF/특수 종목에 가격 누락 반환. 해당 심볼은 `bootstrap_stocks`에서 자동 누락.
- **`fetch_prices.gated` 자주 출력**: 정상. KR/US 장 모두 닫힌 시간대 (예: 새벽 6시–9시 KST). 그 시간대엔 가격 안 갱신.
- **FastAPI가 Windows에서 "add_signal_handler not implemented"**: 정상 (main.py에서 catch). Ctrl+C는 그래도 동작.
- **트라이그램 검색이 한국어에 안 통함**: pg_trgm은 ASCII에 강하고 한글에는 그저 그럼. "삼성전자" → "삼성"은 잘 잡히지만 "삼성SDS" → "SDS" 부분일치는 약할 수 있음. 향후 GIN tsvector + ko 형태소 분석기 도입 가능.
