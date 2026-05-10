# YGinvest Plan #4.5 — Trading UI Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Plan #4의 알려진 한계 5개 모두 해결 — 차트 인터벌 토글(15m/1h/1d), RSI/MACD/볼린저 지표, 종목 뉴스, 핵심 재무 지표, 포트폴리오 자산 배분 overview.

**Architecture:** 인트라데이 봉(15m/1h)은 DB 저장 안 하고 워커 RPC `/rpc/stocks/bars`로 on-demand fetch (yfinance Ticker.history). 뉴스/재무 지표도 동일하게 worker RPC. 일봉(1d)은 기존 stock_bars DB 캐시 유지. 클라이언트는 차트 컨트롤로 interval/indicator 전환. 포트폴리오 overview는 recharts 도넛.

**Tech Stack 추가:** recharts (포트폴리오 자산 배분 도넛) · 클라이언트 측 지표 계산 (RSI, MACD, Bollinger)

---

## 사전 요구사항

- Plan #1-4 완료 (master에 있음)
- 워커 가동 중 (필요시 부팅)
- 로컬 Supabase 가동

---

## 디자인 결정

**스토리지 정책**: 일봉만 DB(stock_bars), 인트라데이/뉴스/재무는 워커 RPC on-demand. 이유:
- 인트라데이는 데이터량 큼 (15m × 60일 × 200종목 = 1.2M 행)
- 뉴스/재무는 잘 안 봄 + 외부 API 의존
- DB 가벼움 + Supabase 무료 티어 친화

**지표 계산 위치**: 클라이언트(브라우저). 이유:
- 캔들 데이터는 어차피 클라이언트로 보내야 함
- 지표는 단순 슬라이딩 윈도우 계산 (RSI/MACD/Bollinger)
- 사용자가 지표 토글할 때 서버 왕복 없이 즉시 반응

---

## 파일 구조

```
apps/worker/src/ygworker/
  data_sources/
    yahoo.py                                         (MODIFY: fetch_history 추가)
    yahoo_news.py                                    (NEW: 뉴스 + 재무 키메트릭)
  rpc/
    stocks.py                                        (MODIFY: bars/news/financials 엔드포인트 추가)
  tests/
    test_data_sources_yahoo.py                       (MODIFY: fetch_history 테스트)
    test_data_sources_yahoo_news.py                  (NEW)
    test_rpc_stocks_lookup.py                        (MODIFY: 새 엔드포인트 테스트 추가)

apps/web/
  app/api/
    stocks/[symbol]/bars/route.ts                    (MODIFY: 1d 외엔 worker RPC 폴백)
    stocks/[symbol]/news/route.ts                    (NEW)
    stocks/[symbol]/financials/route.ts              (NEW)
  app/app/
    portfolio/overview/page.tsx                      (NEW: 자산 배분 + 누적 수익률)
    portfolio/page.tsx                               (MODIFY: redirect → overview)
    trade/[symbol]/page.tsx                          (MODIFY: ChartControls + News + Financials 통합)
    dashboard/page.tsx                               (MODIFY: overview 링크)
  components/
    stock-chart.tsx                                  (MODIFY: interval/indicator props)
    chart-controls.tsx                               (NEW: interval 토글 + indicator 픽커)
    stock-news.tsx                                   (NEW)
    stock-financials.tsx                             (NEW)
    allocation-donut.tsx                             (NEW: recharts 도넛)
  lib/
    workerRpc.ts                                     (MODIFY: bars/news/financials 헬퍼 추가)
    indicators.ts                                    (NEW: RSI/MACD/Bollinger 순수 함수)
  package.json                                       (MODIFY: recharts 추가)
  tests/e2e/
    chart-controls.spec.ts                           (NEW: interval 토글 + 지표 토글)

README.md                                            (MODIFY: Plan #4.5 진행상태)
```

각 파일의 책임:
- `lib/indicators.ts` — 순수 함수 모음 (RSI, MACD, Bollinger). 입력 closes 배열 → 출력 배열. 단위 테스트 가능
- `chart-controls.tsx` — interval (1d/1h/15m) + indicator (none/MA/RSI/MACD/볼린저) state lifting. fetch는 부모에서
- `stock-chart.tsx` — bars + interval + indicator props. 지표별 series 추가
- `allocation-donut.tsx` — holdings 데이터 받아 recharts PieChart 렌더
- `data_sources/yahoo_news.py` — `fetch_news(symbol, limit)` + `fetch_key_metrics(symbol)` (EPS, ROE, 베타 등)

---

## Task 1: 환경 점검

- [ ] **Step 1: 브랜치 + 워커 + DB 확인**

```bash
git branch --show-current   # plan-4.5-trading-ui-polish (이미 만들어져 있음)
supabase status
cd apps/worker && PYTHONPATH=src PYTHONUTF8=1 uv run python -m ygworker.main &  # 워커 백그라운드
curl -s http://localhost:8080/health
```

---

## Task 2: Worker — yahoo.fetch_history (TDD)

**Files:**
- Modify: `apps/worker/src/ygworker/data_sources/yahoo.py`
- Modify: `apps/worker/tests/test_data_sources_yahoo.py`

yfinance `Ticker(symbol).history(period, interval)` 래핑.

- [ ] **Step 1: 실패 테스트 작성**

`apps/worker/tests/test_data_sources_yahoo.py` 끝에 추가:

```python
@patch("ygworker.data_sources.yahoo.yf.Ticker")
def test_fetch_history_returns_ohlcv_list(mock_ticker):
    import pandas as pd
    df = pd.DataFrame(
        {
            "Open": [100.0, 102.0],
            "High": [103.0, 106.0],
            "Low": [99.0, 101.0],
            "Close": [102.0, 105.0],
            "Volume": [1_000_000, 1_500_000],
        },
        index=pd.to_datetime(["2026-05-08 09:30", "2026-05-08 09:45"]),
    )
    mock_ticker.return_value.history.return_value = df

    bars = fetch_history("AAPL", period="60d", interval="15m")
    assert len(bars) == 2
    assert bars[0]["open"] == 100.0
    assert bars[0]["close"] == 102.0
    assert bars[0]["volume"] == 1_000_000
    mock_ticker.return_value.history.assert_called_with(period="60d", interval="15m")


@patch("ygworker.data_sources.yahoo.yf.Ticker")
def test_fetch_history_returns_empty_on_no_data(mock_ticker):
    import pandas as pd
    mock_ticker.return_value.history.return_value = pd.DataFrame()
    assert fetch_history("INVALID", period="1d", interval="1d") == []
```

상단 import에 `fetch_history` 추가.

- [ ] **Step 2: 구현**

`apps/worker/src/ygworker/data_sources/yahoo.py`에 추가:

```python
@retry(stop=stop_after_attempt(2), wait=wait_exponential(multiplier=0.5, min=0.5, max=2))
def fetch_history(symbol: str, period: str = "60d", interval: str = "15m") -> list[dict]:
    """yfinance Ticker.history() 래핑.

    period: '1d', '5d', '60d', '1y', '2y', '5y', '10y', 'max'
    interval: '15m', '1h', '1d'
    """
    df = yf.Ticker(symbol).history(period=period, interval=interval)
    if df is None or df.empty:
        return []
    out: list[dict] = []
    for idx, row in df.iterrows():
        try:
            out.append({
                "ts": idx.to_pydatetime() if hasattr(idx, "to_pydatetime") else idx,
                "open": float(row["Open"]),
                "high": float(row["High"]),
                "low": float(row["Low"]),
                "close": float(row["Close"]),
                "volume": int(row["Volume"]) if not (row["Volume"] != row["Volume"]) else 0,
            })
        except (ValueError, TypeError, KeyError):
            continue
    return out
```

- [ ] **Step 3: 테스트 + 커밋**

```bash
cd apps/worker && uv run pytest tests/test_data_sources_yahoo.py -v
git add apps/worker/src/ygworker/data_sources/yahoo.py apps/worker/tests/test_data_sources_yahoo.py
git commit -m "feat(worker): yahoo.fetch_history (period/interval) for intraday bars"
```

---

## Task 3: Worker — yahoo_news.fetch_news + fetch_key_metrics (TDD)

**Files:**
- Create: `apps/worker/src/ygworker/data_sources/yahoo_news.py`
- Create: `apps/worker/tests/test_data_sources_yahoo_news.py`

- [ ] **Step 1: 실패 테스트 작성**

```python
from unittest.mock import patch, MagicMock

import pytest

from ygworker.data_sources.yahoo_news import fetch_news, fetch_key_metrics


@patch("ygworker.data_sources.yahoo_news.yf.Ticker")
def test_fetch_news_returns_titles_and_links(mock_ticker):
    mock_ticker.return_value.news = [
        {
            "title": "Apple announces new iPhone",
            "link": "https://example.com/news/1",
            "publisher": "Reuters",
            "providerPublishTime": 1715000000,
        },
        {
            "title": "AAPL stock surges",
            "link": "https://example.com/news/2",
            "publisher": "CNBC",
            "providerPublishTime": 1714900000,
        },
    ]
    news = fetch_news("AAPL", limit=5)
    assert len(news) == 2
    assert news[0]["title"] == "Apple announces new iPhone"
    assert news[0]["link"] == "https://example.com/news/1"
    assert news[0]["publisher"] == "Reuters"
    assert "published_at" in news[0]


@patch("ygworker.data_sources.yahoo_news.yf.Ticker")
def test_fetch_news_respects_limit(mock_ticker):
    mock_ticker.return_value.news = [
        {"title": f"News {i}", "link": f"https://example.com/{i}", "publisher": "X", "providerPublishTime": 1700000000 + i}
        for i in range(20)
    ]
    news = fetch_news("AAPL", limit=5)
    assert len(news) == 5


@patch("ygworker.data_sources.yahoo_news.yf.Ticker")
def test_fetch_key_metrics_returns_subset(mock_ticker):
    mock_ticker.return_value.info = {
        "trailingEps": 6.32,
        "forwardPE": 28.5,
        "dividendYield": 0.0042,
        "beta": 1.21,
        "profitMargins": 0.247,
        "returnOnEquity": 1.43,
        "debtToEquity": 195.0,
        "regularMarketPrice": 158.5,  # 무관, 무시
    }
    metrics = fetch_key_metrics("AAPL")
    assert metrics["trailing_eps"] == 6.32
    assert metrics["forward_pe"] == 28.5
    assert metrics["dividend_yield"] == 0.0042
    assert metrics["beta"] == 1.21
    assert metrics["profit_margin"] == 0.247
    assert metrics["roe"] == 1.43
    assert metrics["debt_to_equity"] == 195.0


@patch("ygworker.data_sources.yahoo_news.yf.Ticker")
def test_fetch_key_metrics_handles_missing_fields(mock_ticker):
    mock_ticker.return_value.info = {"trailingEps": 6.32}
    metrics = fetch_key_metrics("AAPL")
    assert metrics["trailing_eps"] == 6.32
    assert metrics["forward_pe"] is None
    assert metrics["beta"] is None
```

- [ ] **Step 2: 구현**

`apps/worker/src/ygworker/data_sources/yahoo_news.py`:

```python
from datetime import UTC, datetime

import yfinance as yf
from tenacity import retry, stop_after_attempt, wait_exponential


@retry(stop=stop_after_attempt(2), wait=wait_exponential(multiplier=0.5, min=0.5, max=2))
def fetch_news(symbol: str, limit: int = 10) -> list[dict]:
    """yfinance Ticker.news 래핑.

    Returns: list of dicts with (title, link, publisher, published_at).
    """
    raw = yf.Ticker(symbol).news or []
    out: list[dict] = []
    for item in raw[:limit]:
        try:
            ts = item.get("providerPublishTime")
            published_at = datetime.fromtimestamp(ts, tz=UTC).isoformat() if ts else None
            out.append({
                "title": item.get("title", ""),
                "link": item.get("link", ""),
                "publisher": item.get("publisher", ""),
                "published_at": published_at,
            })
        except (ValueError, TypeError):
            continue
    return out


@retry(stop=stop_after_attempt(2), wait=wait_exponential(multiplier=0.5, min=0.5, max=2))
def fetch_key_metrics(symbol: str) -> dict:
    """yfinance Ticker.info에서 핵심 재무 지표만 추출."""
    info = yf.Ticker(symbol).info or {}
    return {
        "trailing_eps": info.get("trailingEps"),
        "forward_pe": info.get("forwardPE"),
        "dividend_yield": info.get("dividendYield"),
        "beta": info.get("beta"),
        "profit_margin": info.get("profitMargins"),
        "roe": info.get("returnOnEquity"),
        "debt_to_equity": info.get("debtToEquity"),
    }
```

- [ ] **Step 3: 테스트 + 커밋**

```bash
cd apps/worker && uv run pytest tests/test_data_sources_yahoo_news.py -v
# Expected: 4 PASS
git add apps/worker/src/ygworker/data_sources/yahoo_news.py apps/worker/tests/test_data_sources_yahoo_news.py
git commit -m "feat(worker): fetch_news + fetch_key_metrics adapters (TDD, 4 tests)"
```

---

## Task 4: Worker — RPC endpoints 추가

**Files:**
- Modify: `apps/worker/src/ygworker/rpc/stocks.py`
- Modify: `apps/worker/tests/test_rpc_stocks_lookup.py`

기존 `/rpc/stocks/lookup` 옆에 3개 추가: `/rpc/stocks/bars`, `/rpc/stocks/news`, `/rpc/stocks/financials`.

- [ ] **Step 1: 테스트 추가**

`apps/worker/tests/test_rpc_stocks_lookup.py`에 추가 (기존 fixture 재사용):

```python
@patch("ygworker.rpc.stocks.fetch_history")
def test_bars_returns_ohlcv(mock_history, client):
    c, _ = client
    mock_history.return_value = [
        {"ts": "2026-05-08T13:30:00+00:00", "open": 100, "high": 105, "low": 99, "close": 102, "volume": 1_000_000},
    ]
    r = c.post(
        "/rpc/stocks/bars",
        json={"symbol": "AAPL", "interval": "15m", "period": "60d"},
        headers={"X-Worker-Secret": "test-secret"},
    )
    assert r.status_code == 200
    body = r.json()
    assert body["symbol"] == "AAPL"
    assert body["interval"] == "15m"
    assert len(body["bars"]) == 1
    mock_history.assert_called_with("AAPL", period="60d", interval="15m")


def test_bars_unauthenticated_401(client):
    c, _ = client
    r = c.post("/rpc/stocks/bars", json={"symbol": "AAPL", "interval": "15m"})
    assert r.status_code == 401


@patch("ygworker.rpc.stocks.fetch_news")
def test_news_returns_items(mock_news, client):
    c, _ = client
    mock_news.return_value = [
        {"title": "Apple news", "link": "https://example.com/1", "publisher": "Reuters", "published_at": "2026-05-08T00:00:00+00:00"},
    ]
    r = c.post(
        "/rpc/stocks/news",
        json={"symbol": "AAPL", "limit": 5},
        headers={"X-Worker-Secret": "test-secret"},
    )
    assert r.status_code == 200
    assert r.json()["news"][0]["title"] == "Apple news"


@patch("ygworker.rpc.stocks.fetch_key_metrics")
def test_financials_returns_metrics(mock_metrics, client):
    c, _ = client
    mock_metrics.return_value = {
        "trailing_eps": 6.32, "forward_pe": 28.5, "dividend_yield": 0.0042,
        "beta": 1.21, "profit_margin": 0.247, "roe": 1.43, "debt_to_equity": 195.0,
    }
    r = c.post(
        "/rpc/stocks/financials",
        json={"symbol": "AAPL"},
        headers={"X-Worker-Secret": "test-secret"},
    )
    assert r.status_code == 200
    body = r.json()
    assert body["trailing_eps"] == 6.32
    assert body["forward_pe"] == 28.5
```

- [ ] **Step 2: 구현**

`apps/worker/src/ygworker/rpc/stocks.py`에 imports + 새 엔드포인트 추가:

```python
from ygworker.data_sources.yahoo import fetch_history, fetch_quote
from ygworker.data_sources.yahoo_news import fetch_key_metrics, fetch_news
```

`make_router` 함수 안에 새 라우트 3개 추가 (기존 `/rpc/stocks/lookup` 다음):

```python
    class BarsRequest(BaseModel):
        symbol: str
        interval: str = "15m"
        period: str = "60d"

    @router.post("/rpc/stocks/bars")
    def bars(req: BarsRequest, _: None = Depends(_check_secret)) -> dict:
        if req.interval not in ("15m", "1h", "1d"):
            raise HTTPException(status_code=400, detail="invalid_interval")
        bars_data = fetch_history(req.symbol, period=req.period, interval=req.interval)
        # ts를 isoformat으로
        out = []
        for b in bars_data:
            ts = b["ts"].isoformat() if hasattr(b["ts"], "isoformat") else str(b["ts"])
            out.append({**b, "ts": ts})
        return {"symbol": req.symbol, "interval": req.interval, "bars": out}

    class NewsRequest(BaseModel):
        symbol: str
        limit: int = 10

    @router.post("/rpc/stocks/news")
    def news(req: NewsRequest, _: None = Depends(_check_secret)) -> dict:
        items = fetch_news(req.symbol, limit=req.limit)
        return {"symbol": req.symbol, "news": items}

    class FinancialsRequest(BaseModel):
        symbol: str

    @router.post("/rpc/stocks/financials")
    def financials(req: FinancialsRequest, _: None = Depends(_check_secret)) -> dict:
        return fetch_key_metrics(req.symbol)
```

- [ ] **Step 3: 테스트 + 커밋**

```bash
cd apps/worker && uv run pytest tests/test_rpc_stocks_lookup.py -v
# Expected: 7 PASS (4 기존 + 3 새 + 1 401 새)
git add apps/worker/src/ygworker/rpc/stocks.py apps/worker/tests/test_rpc_stocks_lookup.py
git commit -m "feat(worker): /rpc/stocks/{bars,news,financials} endpoints (TDD)"
```

---

## Task 5: Web — workerRpc 헬퍼 + API 라우트 3개

**Files:**
- Modify: `apps/web/lib/workerRpc.ts`
- Modify: `apps/web/app/api/stocks/[symbol]/bars/route.ts`
- Create: `apps/web/app/api/stocks/[symbol]/news/route.ts`
- Create: `apps/web/app/api/stocks/[symbol]/financials/route.ts`

- [ ] **Step 1: workerRpc 확장**

`apps/web/lib/workerRpc.ts` 끝에 추가:

```typescript
type Bar = {
  ts: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

export async function fetchBarsViaWorker(
  symbol: string,
  interval: string,
  period: string = "60d"
): Promise<Bar[]> {
  const res = await fetch(`${WORKER_URL}/rpc/stocks/bars`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Worker-Secret": WORKER_SECRET },
    body: JSON.stringify({ symbol, interval, period }),
    signal: AbortSignal.timeout(15_000),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`worker bars failed: ${res.status}`);
  const json = await res.json();
  return json.bars ?? [];
}

export type NewsItem = {
  title: string;
  link: string;
  publisher: string;
  published_at: string | null;
};

export async function fetchNewsViaWorker(symbol: string, limit: number = 10): Promise<NewsItem[]> {
  const res = await fetch(`${WORKER_URL}/rpc/stocks/news`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Worker-Secret": WORKER_SECRET },
    body: JSON.stringify({ symbol, limit }),
    signal: AbortSignal.timeout(15_000),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`worker news failed: ${res.status}`);
  const json = await res.json();
  return json.news ?? [];
}

export type KeyMetrics = {
  trailing_eps: number | null;
  forward_pe: number | null;
  dividend_yield: number | null;
  beta: number | null;
  profit_margin: number | null;
  roe: number | null;
  debt_to_equity: number | null;
};

export async function fetchKeyMetricsViaWorker(symbol: string): Promise<KeyMetrics> {
  const res = await fetch(`${WORKER_URL}/rpc/stocks/financials`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Worker-Secret": WORKER_SECRET },
    body: JSON.stringify({ symbol }),
    signal: AbortSignal.timeout(15_000),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`worker financials failed: ${res.status}`);
  return await res.json();
}
```

- [ ] **Step 2: bars route 확장**

기존 `apps/web/app/api/stocks/[symbol]/bars/route.ts`를 다음으로 교체:

```typescript
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { fetchBarsViaWorker } from "@/lib/workerRpc";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ symbol: string }> }
) {
  const { symbol } = await params;
  const decodedSymbol = decodeURIComponent(symbol);
  const { searchParams } = new URL(request.url);
  const interval = searchParams.get("interval") ?? "1d";
  const limit = Number(searchParams.get("limit") ?? "365");

  if (!["15m", "1h", "1d"].includes(interval)) {
    return NextResponse.json({ error: "invalid_interval" }, { status: 400 });
  }

  // 1d는 DB 캐시에서, 인트라데이는 워커 RPC로 on-demand
  if (interval === "1d") {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("stock_bars")
      .select("ts, open, high, low, close, volume")
      .eq("symbol", decodedSymbol)
      .eq("interval", "1d")
      .order("ts", { ascending: true })
      .limit(limit);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ symbol: decodedSymbol, interval, bars: data ?? [] });
  }

  // 15m / 1h: 워커 RPC
  try {
    const period = interval === "15m" ? "60d" : "2y";
    const bars = await fetchBarsViaWorker(decodedSymbol, interval, period);
    return NextResponse.json({ symbol: decodedSymbol, interval, bars });
  } catch (e) {
    return NextResponse.json({ error: "worker_unreachable" }, { status: 503 });
  }
}
```

- [ ] **Step 3: news route**

Create `apps/web/app/api/stocks/[symbol]/news/route.ts`:

```typescript
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { fetchNewsViaWorker } from "@/lib/workerRpc";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ symbol: string }> }
) {
  const { symbol } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const limit = Number(searchParams.get("limit") ?? "10");

  try {
    const news = await fetchNewsViaWorker(decodeURIComponent(symbol), limit);
    return NextResponse.json({ symbol, news });
  } catch (e) {
    return NextResponse.json({ error: "worker_unreachable" }, { status: 503 });
  }
}
```

- [ ] **Step 4: financials route**

Create `apps/web/app/api/stocks/[symbol]/financials/route.ts`:

```typescript
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { fetchKeyMetricsViaWorker } from "@/lib/workerRpc";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ symbol: string }> }
) {
  const { symbol } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  try {
    const metrics = await fetchKeyMetricsViaWorker(decodeURIComponent(symbol));
    return NextResponse.json(metrics);
  } catch (e) {
    return NextResponse.json({ error: "worker_unreachable" }, { status: 503 });
  }
}
```

- [ ] **Step 5: 빌드 + 커밋**

```bash
cd apps/web && npm run build && npm run lint && npx tsc --noEmit
git add apps/web/lib/workerRpc.ts apps/web/app/api/stocks/[symbol]/
git commit -m "feat(web): /api/stocks/[symbol]/{news,financials} + bars intraday via worker RPC"
```

---

## Task 6: Web — recharts 설치

**Files:**
- Modify: `apps/web/package.json`

- [ ] **Step 1: 설치**

```bash
cd apps/web && npm install recharts
```

- [ ] **Step 2: 커밋**

```bash
git add apps/web/package.json apps/web/package-lock.json
git commit -m "chore(web): install recharts (for portfolio allocation donut)"
```

---

## Task 7: Web — lib/indicators.ts (RSI/MACD/Bollinger 순수 함수)

**Files:**
- Create: `apps/web/lib/indicators.ts`

- [ ] **Step 1: 작성**

```typescript
// 클라이언트 사이드 지표 계산. 모두 closes: number[] 입력 → 결과 배열 출력.
// undefined는 데이터 부족 (워밍업 구간).

export function ma(closes: number[], period: number): (number | undefined)[] {
  const out: (number | undefined)[] = [];
  let sum = 0;
  for (let i = 0; i < closes.length; i++) {
    sum += closes[i];
    if (i >= period) sum -= closes[i - period];
    out.push(i >= period - 1 ? sum / period : undefined);
  }
  return out;
}

// EMA (지수이동평균) — MACD 계산용
function ema(values: number[], period: number): number[] {
  const k = 2 / (period + 1);
  const out: number[] = [];
  let prev = values[0];
  out.push(prev);
  for (let i = 1; i < values.length; i++) {
    prev = values[i] * k + prev * (1 - k);
    out.push(prev);
  }
  return out;
}

// RSI (Relative Strength Index) — Wilder smoothing
export function rsi(closes: number[], period: number = 14): (number | undefined)[] {
  const out: (number | undefined)[] = [undefined];
  if (closes.length < 2) return out;

  const gains: number[] = [0];
  const losses: number[] = [0];
  for (let i = 1; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1];
    gains.push(diff > 0 ? diff : 0);
    losses.push(diff < 0 ? -diff : 0);
  }

  let avgGain = 0;
  let avgLoss = 0;
  for (let i = 1; i < closes.length; i++) {
    if (i < period) {
      avgGain += gains[i] / period;
      avgLoss += losses[i] / period;
      out.push(undefined);
    } else if (i === period) {
      // 첫 평균 (간단 평균)
      avgGain += gains[i] / period;
      avgLoss += losses[i] / period;
      const rs = avgLoss === 0 ? Infinity : avgGain / avgLoss;
      out.push(100 - 100 / (1 + rs));
    } else {
      // Wilder smoothing
      avgGain = (avgGain * (period - 1) + gains[i]) / period;
      avgLoss = (avgLoss * (period - 1) + losses[i]) / period;
      const rs = avgLoss === 0 ? Infinity : avgGain / avgLoss;
      out.push(100 - 100 / (1 + rs));
    }
  }
  return out;
}

// MACD (12, 26, 9) — returns {macd, signal, histogram} arrays
export function macd(
  closes: number[],
  fast: number = 12,
  slow: number = 26,
  signal: number = 9
): { macd: number[]; signal: number[]; histogram: number[] } {
  if (closes.length < slow) {
    return { macd: [], signal: [], histogram: [] };
  }
  const emaFast = ema(closes, fast);
  const emaSlow = ema(closes, slow);
  const macdLine = emaFast.map((v, i) => v - emaSlow[i]);
  const signalLine = ema(macdLine.slice(slow - 1), signal);
  // Pad signalLine with nothing — align by slicing macd accordingly
  const macdResult = macdLine.slice(slow - 1);
  const histogram = macdResult.map((v, i) => v - signalLine[i]);
  return { macd: macdResult, signal: signalLine, histogram };
}

// Bollinger Bands — returns {upper, middle, lower}
export function bollinger(
  closes: number[],
  period: number = 20,
  stdDev: number = 2
): { upper: (number | undefined)[]; middle: (number | undefined)[]; lower: (number | undefined)[] } {
  const middle = ma(closes, period);
  const upper: (number | undefined)[] = [];
  const lower: (number | undefined)[] = [];
  for (let i = 0; i < closes.length; i++) {
    if (i < period - 1) {
      upper.push(undefined);
      lower.push(undefined);
      continue;
    }
    const window = closes.slice(i - period + 1, i + 1);
    const mean = middle[i]!;
    const variance = window.reduce((acc, v) => acc + (v - mean) ** 2, 0) / period;
    const sd = Math.sqrt(variance);
    upper.push(mean + stdDev * sd);
    lower.push(mean - stdDev * sd);
  }
  return { upper, middle, lower };
}
```

- [ ] **Step 2: 빌드 + 커밋**

```bash
cd apps/web && npx tsc --noEmit
git add apps/web/lib/indicators.ts
git commit -m "feat(web): indicators lib (MA/RSI/MACD/Bollinger pure functions)"
```

---

## Task 8: Web — StockChart 확장 (interval/indicator props)

**Files:**
- Modify: `apps/web/components/stock-chart.tsx`

기존 StockChart는 일봉만, MA20/MA60 고정. 이걸 props로 받도록.

- [ ] **Step 1: 재작성**

전체 교체:

```tsx
"use client";

import { useEffect, useRef } from "react";
import {
  createChart,
  CandlestickSeries,
  LineSeries,
  type IChartApi,
  type Time,
} from "lightweight-charts";
import { ma, rsi, bollinger } from "@/lib/indicators";

type Bar = {
  ts: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

export type IndicatorType = "none" | "ma" | "rsi" | "bollinger";

type Props = {
  bars: Bar[];
  height?: number;
  indicator?: IndicatorType;
};

function tsToTime(ts: string): Time {
  // 일봉이면 "YYYY-MM-DD", 인트라데이면 "YYYY-MM-DDTHH:mm:ss" → seconds since epoch
  if (ts.includes("T") && ts.length > 10) {
    const epoch = Math.floor(new Date(ts).getTime() / 1000);
    return epoch as Time;
  }
  return ts.split("T")[0] as Time;
}

export function StockChart({ bars, height = 320, indicator = "ma" }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    if (bars.length === 0) return;

    const chart = createChart(containerRef.current, {
      height,
      layout: { background: { color: "transparent" }, textColor: "#888" },
      grid: {
        vertLines: { color: "rgba(255,255,255,0.05)" },
        horzLines: { color: "rgba(255,255,255,0.05)" },
      },
      timeScale: { timeVisible: true, secondsVisible: false },
    });
    chartRef.current = chart;

    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: "#26a69a",
      downColor: "#ef5350",
      borderVisible: false,
      wickUpColor: "#26a69a",
      wickDownColor: "#ef5350",
    });

    const candleData = bars.map((b) => ({
      time: tsToTime(b.ts),
      open: b.open,
      high: b.high,
      low: b.low,
      close: b.close,
    }));
    candleSeries.setData(candleData);

    const closes = bars.map((b) => b.close);

    if (indicator === "ma") {
      const ma20 = ma(closes, 20);
      const ma60 = ma(closes, 60);
      const ma20Series = chart.addSeries(LineSeries, { color: "#f59e0b", lineWidth: 1 });
      ma20Series.setData(
        bars
          .map((b, i) => ({ time: tsToTime(b.ts), value: ma20[i] }))
          .filter((d): d is { time: Time; value: number } => d.value !== undefined)
      );
      const ma60Series = chart.addSeries(LineSeries, { color: "#a78bfa", lineWidth: 1 });
      ma60Series.setData(
        bars
          .map((b, i) => ({ time: tsToTime(b.ts), value: ma60[i] }))
          .filter((d): d is { time: Time; value: number } => d.value !== undefined)
      );
    } else if (indicator === "bollinger") {
      const { upper, middle, lower } = bollinger(closes, 20, 2);
      const middleSeries = chart.addSeries(LineSeries, { color: "#a78bfa", lineWidth: 1 });
      middleSeries.setData(
        bars
          .map((b, i) => ({ time: tsToTime(b.ts), value: middle[i] }))
          .filter((d): d is { time: Time; value: number } => d.value !== undefined)
      );
      const upperSeries = chart.addSeries(LineSeries, { color: "#fbbf24", lineWidth: 1 });
      upperSeries.setData(
        bars
          .map((b, i) => ({ time: tsToTime(b.ts), value: upper[i] }))
          .filter((d): d is { time: Time; value: number } => d.value !== undefined)
      );
      const lowerSeries = chart.addSeries(LineSeries, { color: "#fbbf24", lineWidth: 1 });
      lowerSeries.setData(
        bars
          .map((b, i) => ({ time: tsToTime(b.ts), value: lower[i] }))
          .filter((d): d is { time: Time; value: number } => d.value !== undefined)
      );
    }
    // RSI는 별도 패널이 필요해서 v1.5에선 텍스트로만 표시 (다른 개별 라인이라 메인 차트 위에 안 어울림)

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
  }, [bars, height, indicator]);

  if (bars.length === 0) {
    return (
      <div className="text-sm text-muted-foreground py-8 text-center">
        차트 데이터 없음
      </div>
    );
  }

  return (
    <div>
      <div ref={containerRef} className="w-full" style={{ height }} />
      <ChartLegend indicator={indicator} bars={bars} />
    </div>
  );
}

function ChartLegend({ indicator, bars }: { indicator: IndicatorType; bars: Bar[] }) {
  if (indicator === "none") return null;
  if (indicator === "ma") {
    return (
      <div className="text-xs text-muted-foreground mt-2 flex gap-3 justify-center">
        <span><span className="inline-block w-3 h-1 align-middle mr-1" style={{ backgroundColor: "#f59e0b" }} />MA20</span>
        <span><span className="inline-block w-3 h-1 align-middle mr-1" style={{ backgroundColor: "#a78bfa" }} />MA60</span>
      </div>
    );
  }
  if (indicator === "bollinger") {
    return (
      <div className="text-xs text-muted-foreground mt-2 flex gap-3 justify-center">
        <span><span className="inline-block w-3 h-1 align-middle mr-1" style={{ backgroundColor: "#fbbf24" }} />Upper/Lower (2σ)</span>
        <span><span className="inline-block w-3 h-1 align-middle mr-1" style={{ backgroundColor: "#a78bfa" }} />MA20</span>
      </div>
    );
  }
  if (indicator === "rsi") {
    const closes = bars.map((b) => b.close);
    const rsiValues = rsi(closes, 14);
    const last = rsiValues[rsiValues.length - 1];
    return (
      <div className="text-xs text-muted-foreground mt-2 text-center">
        RSI(14): {last !== undefined ? last.toFixed(1) : "—"}
        {last !== undefined && last >= 70 && <span className="ml-2 text-red-500">과매수</span>}
        {last !== undefined && last <= 30 && <span className="ml-2 text-green-500">과매도</span>}
      </div>
    );
  }
  return null;
}
```

NOTE: RSI는 별도 lower-pane이 더 적절하지만 v1.5는 단순화해서 마지막 값만 텍스트 표시. v2에서 별도 차트.

- [ ] **Step 2: 빌드 + 커밋**

```bash
cd apps/web && npm run build && npx tsc --noEmit
git add apps/web/components/stock-chart.tsx
git commit -m "feat(web): StockChart accepts indicator prop (ma/rsi/bollinger)"
```

---

## Task 9: Web — ChartControls 컴포넌트

**Files:**
- Create: `apps/web/components/chart-controls.tsx`

- [ ] **Step 1: 작성**

```tsx
"use client";

import { Button } from "@/components/ui/button";
import type { IndicatorType } from "@/components/stock-chart";

export type Interval = "1d" | "1h" | "15m";

type Props = {
  interval: Interval;
  onIntervalChange: (i: Interval) => void;
  indicator: IndicatorType;
  onIndicatorChange: (i: IndicatorType) => void;
};

export function ChartControls({ interval, onIntervalChange, indicator, onIndicatorChange }: Props) {
  return (
    <div className="flex flex-wrap gap-2 items-center justify-between mb-3">
      <div className="flex gap-1">
        {(["1d", "1h", "15m"] as Interval[]).map((i) => (
          <Button
            key={i}
            type="button"
            size="sm"
            variant={interval === i ? "default" : "outline"}
            onClick={() => onIntervalChange(i)}
          >
            {i === "1d" ? "일봉" : i === "1h" ? "1시간" : "15분"}
          </Button>
        ))}
      </div>
      <div className="flex gap-1">
        {(["none", "ma", "rsi", "bollinger"] as IndicatorType[]).map((ind) => (
          <Button
            key={ind}
            type="button"
            size="sm"
            variant={indicator === ind ? "default" : "outline"}
            onClick={() => onIndicatorChange(ind)}
          >
            {ind === "none" ? "지표 없음" : ind === "ma" ? "MA" : ind === "rsi" ? "RSI" : "BB"}
          </Button>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: 커밋**

```bash
git add apps/web/components/chart-controls.tsx
git commit -m "feat(web): ChartControls (interval + indicator toggles)"
```

---

## Task 10: Web — StockNews + StockFinancials 컴포넌트

**Files:**
- Create: `apps/web/components/stock-news.tsx`
- Create: `apps/web/components/stock-financials.tsx`

- [ ] **Step 1: StockNews**

```tsx
"use client";

import { useEffect, useState } from "react";

type NewsItem = {
  title: string;
  link: string;
  publisher: string;
  published_at: string | null;
};

export function StockNews({ symbol }: { symbol: string }) {
  const [news, setNews] = useState<NewsItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/stocks/${encodeURIComponent(symbol)}/news?limit=5`)
      .then((r) => r.ok ? r.json() : Promise.reject(r.statusText))
      .then((data) => { if (!cancelled) setNews(data.news ?? []); })
      .catch((e) => { if (!cancelled) setError(String(e)); });
    return () => { cancelled = true; };
  }, [symbol]);

  if (error) return <div className="text-sm text-muted-foreground">뉴스 불러오기 실패</div>;
  if (!news) return <div className="text-sm text-muted-foreground">뉴스 로딩 중...</div>;
  if (news.length === 0) return <div className="text-sm text-muted-foreground">뉴스 없음</div>;

  return (
    <ul className="space-y-2 text-sm">
      {news.map((n, i) => (
        <li key={i} className="border-b pb-2">
          <a href={n.link} target="_blank" rel="noopener noreferrer" className="hover:underline">
            <div className="font-medium">{n.title}</div>
            <div className="text-xs text-muted-foreground">
              {n.publisher} · {n.published_at ? new Date(n.published_at).toLocaleString("ko-KR") : ""}
            </div>
          </a>
        </li>
      ))}
    </ul>
  );
}
```

- [ ] **Step 2: StockFinancials**

```tsx
"use client";

import { useEffect, useState } from "react";

type Metrics = {
  trailing_eps: number | null;
  forward_pe: number | null;
  dividend_yield: number | null;
  beta: number | null;
  profit_margin: number | null;
  roe: number | null;
  debt_to_equity: number | null;
};

function fmtPct(v: number | null) {
  return v === null ? "—" : `${(v * 100).toFixed(2)}%`;
}
function fmtNum(v: number | null, digits = 2) {
  return v === null ? "—" : v.toFixed(digits);
}

export function StockFinancials({ symbol }: { symbol: string }) {
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/stocks/${encodeURIComponent(symbol)}/financials`)
      .then((r) => r.ok ? r.json() : Promise.reject(r.statusText))
      .then((data) => { if (!cancelled) setMetrics(data); })
      .catch((e) => { if (!cancelled) setError(String(e)); });
    return () => { cancelled = true; };
  }, [symbol]);

  if (error) return <div className="text-sm text-muted-foreground">재무 지표 불러오기 실패</div>;
  if (!metrics) return <div className="text-sm text-muted-foreground">로딩 중...</div>;

  return (
    <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
      <dt className="text-muted-foreground">EPS (12M)</dt>
      <dd className="font-mono">{fmtNum(metrics.trailing_eps)}</dd>
      <dt className="text-muted-foreground">Forward P/E</dt>
      <dd className="font-mono">{fmtNum(metrics.forward_pe)}</dd>
      <dt className="text-muted-foreground">배당 수익률</dt>
      <dd className="font-mono">{fmtPct(metrics.dividend_yield)}</dd>
      <dt className="text-muted-foreground">베타</dt>
      <dd className="font-mono">{fmtNum(metrics.beta)}</dd>
      <dt className="text-muted-foreground">순이익률</dt>
      <dd className="font-mono">{fmtPct(metrics.profit_margin)}</dd>
      <dt className="text-muted-foreground">ROE</dt>
      <dd className="font-mono">{fmtPct(metrics.roe)}</dd>
      <dt className="text-muted-foreground">부채비율</dt>
      <dd className="font-mono">{fmtNum(metrics.debt_to_equity, 1)}</dd>
    </dl>
  );
}
```

- [ ] **Step 3: 커밋**

```bash
cd apps/web && npm run build
git add apps/web/components/stock-news.tsx apps/web/components/stock-financials.tsx
git commit -m "feat(web): StockNews + StockFinancials components (lazy-load via API)"
```

---

## Task 11: Web — 종목 상세 페이지 통합 (interval state + new components)

**Files:**
- Modify: `apps/web/app/app/trade/[symbol]/page.tsx`
- Create: `apps/web/components/chart-area.tsx` (client wrapper for interval state)

페이지는 server component인데 interval은 client state라 wrapper 필요.

- [ ] **Step 1: ChartArea client wrapper**

`apps/web/components/chart-area.tsx`:

```tsx
"use client";

import { useEffect, useState } from "react";
import { StockChart, type IndicatorType } from "@/components/stock-chart";
import { ChartControls, type Interval } from "@/components/chart-controls";

type Bar = {
  ts: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

type Props = {
  symbol: string;
  initialBars: Bar[];  // 일봉 SSR에서 초기 fetch
};

export function ChartArea({ symbol, initialBars }: Props) {
  const [chartInterval, setChartInterval] = useState<Interval>("1d");
  const [indicator, setIndicator] = useState<IndicatorType>("ma");
  const [bars, setBars] = useState<Bar[]>(initialBars);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (chartInterval === "1d") {
      // 초기 SSR 데이터 그대로 (또는 재fetch — 일관성 위해 그대로 사용)
      setBars(initialBars);
      return;
    }
    // 인트라데이는 매번 fetch
    let cancelled = false;
    setLoading(true);
    fetch(`/api/stocks/${encodeURIComponent(symbol)}/bars?interval=${chartInterval}`)
      .then((r) => r.ok ? r.json() : Promise.reject(r.statusText))
      .then((data) => { if (!cancelled) { setBars(data.bars ?? []); setLoading(false); } })
      .catch(() => { if (!cancelled) { setBars([]); setLoading(false); } });
    return () => { cancelled = true; };
  }, [symbol, chartInterval, initialBars]);

  return (
    <div>
      <ChartControls
        interval={chartInterval}
        onIntervalChange={setChartInterval}
        indicator={indicator}
        onIndicatorChange={setIndicator}
      />
      {loading ? (
        <div className="text-sm text-muted-foreground py-8 text-center">차트 로딩 중...</div>
      ) : (
        <StockChart bars={bars} indicator={indicator} />
      )}
    </div>
  );
}
```

- [ ] **Step 2: 종목 상세 페이지 갱신**

`apps/web/app/app/trade/[symbol]/page.tsx`. 기존 `<StockChart bars={...} />` 부분 + 뉴스/재무 카드 추가:

기존 import의 StockChart 줄을 ChartArea로 교체:
```tsx
import { ChartArea } from "@/components/chart-area";
import { StockNews } from "@/components/stock-news";
import { StockFinancials } from "@/components/stock-financials";
```

기존 차트 카드 (`<Card>...일봉 차트 (최근 1년)...<StockChart bars={...} />...</Card>`)를 다음으로:

```tsx
      <Card>
        <CardHeader>
          <CardTitle className="text-base">차트</CardTitle>
        </CardHeader>
        <CardContent>
          <ChartArea
            symbol={stock.symbol}
            initialBars={(bars ?? []).map((b) => ({ ...b, ts: String(b.ts) }))}
          />
        </CardContent>
      </Card>
```

기본 정보 카드 다음에 추가:

```tsx
      <Card>
        <CardHeader>
          <CardTitle className="text-base">재무 지표</CardTitle>
        </CardHeader>
        <CardContent>
          <StockFinancials symbol={stock.symbol} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">뉴스</CardTitle>
        </CardHeader>
        <CardContent>
          <StockNews symbol={stock.symbol} />
        </CardContent>
      </Card>
```

- [ ] **Step 3: 빌드 + 커밋**

```bash
cd apps/web && npm run build && npx tsc --noEmit
git add apps/web/components/chart-area.tsx apps/web/app/app/trade/[symbol]/page.tsx
git commit -m "feat(web): integrate ChartArea (interval+indicator) + StockNews + StockFinancials"
```

---

## Task 12: Web — 포트폴리오 Overview (recharts 도넛)

**Files:**
- Create: `apps/web/components/allocation-donut.tsx`
- Create: `apps/web/app/app/portfolio/overview/page.tsx`
- Modify: `apps/web/app/app/portfolio/page.tsx`

- [ ] **Step 1: AllocationDonut**

```tsx
"use client";

import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from "recharts";

type Slice = {
  name: string;
  value: number;  // KRW 환산
};

const COLORS = ["#26a69a", "#f59e0b", "#a78bfa", "#ef5350", "#60a5fa", "#fbbf24", "#34d399", "#f472b6"];

export function AllocationDonut({ slices }: { slices: Slice[] }) {
  if (slices.length === 0) {
    return <div className="text-sm text-muted-foreground py-8 text-center">자산 없음</div>;
  }
  return (
    <ResponsiveContainer width="100%" height={300}>
      <PieChart>
        <Pie
          data={slices}
          dataKey="value"
          nameKey="name"
          cx="50%"
          cy="50%"
          innerRadius={60}
          outerRadius={100}
          paddingAngle={2}
        >
          {slices.map((_, i) => (
            <Cell key={i} fill={COLORS[i % COLORS.length]} />
          ))}
        </Pie>
        <Tooltip
          formatter={(v: number) => v.toLocaleString("ko-KR") + " KRW"}
        />
        <Legend />
      </PieChart>
    </ResponsiveContainer>
  );
}
```

- [ ] **Step 2: Overview 페이지**

`apps/web/app/app/portfolio/overview/page.tsx`:

```tsx
import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AllocationDonut } from "@/components/allocation-donut";

const KRW = new Intl.NumberFormat("ko-KR", { style: "currency", currency: "KRW", maximumFractionDigits: 0 });

export default async function PortfolioOverview() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const { data: portfolio } = await supabase
    .from("portfolios")
    .select("id, krw_balance, usd_balance, starting_krw, starting_usd, fx_rate_at_start")
    .eq("user_id", user.id)
    .is("room_id", null)
    .single();

  // 최신 환율
  const { data: fxRow } = await supabase
    .from("fx_rates")
    .select("rate")
    .eq("base", "USD").eq("quote", "KRW")
    .order("ts", { ascending: false }).limit(1).maybeSingle();
  const fxRate = fxRow?.rate ? Number(fxRow.rate) : 1395;

  // 보유 + 종목 가격
  const { data: holdings } = await supabase
    .from("holdings")
    .select("symbol, quantity, avg_cost, stocks(name, name_ko, currency, last_price)")
    .eq("portfolio_id", portfolio?.id ?? "");

  const krwCash = Number(portfolio?.krw_balance ?? 0);
  const usdCash = Number(portfolio?.usd_balance ?? 0);
  const usdCashKrw = usdCash * fxRate;

  // 보유 평가금
  const slices: { name: string; value: number }[] = [];
  let totalHoldingsKrw = 0;
  for (const h of holdings ?? []) {
    const stock = Array.isArray(h.stocks) ? h.stocks[0] : h.stocks;
    if (!stock?.last_price) continue;
    const valueLocal = Number(stock.last_price) * Number(h.quantity);
    const valueKrw = stock.currency === "KRW" ? valueLocal : valueLocal * fxRate;
    totalHoldingsKrw += valueKrw;
    slices.push({
      name: stock.name_ko ?? stock.name ?? h.symbol,
      value: Math.round(valueKrw),
    });
  }
  if (krwCash > 0) slices.push({ name: "KRW 현금", value: Math.round(krwCash) });
  if (usdCashKrw > 0) slices.push({ name: "USD 현금", value: Math.round(usdCashKrw) });

  const totalKrw = krwCash + usdCashKrw + totalHoldingsKrw;
  const startingKrwEq =
    Number(portfolio?.starting_krw ?? 0) +
    Number(portfolio?.starting_usd ?? 0) * Number(portfolio?.fx_rate_at_start ?? 1395);
  const returnPct = startingKrwEq > 0 ? ((totalKrw - startingKrwEq) / startingKrwEq) * 100 : 0;

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-4">
      <h1 className="text-2xl font-bold">포트폴리오 Overview</h1>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card>
          <CardHeader><CardTitle className="text-base">총자산 (KRW 환산)</CardTitle></CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{KRW.format(totalKrw)}</div>
            <div className="text-xs text-muted-foreground mt-1">
              시작: {KRW.format(startingKrwEq)} (1 USD = ₩{fxRate})
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-base">누적 수익률</CardTitle></CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${returnPct >= 0 ? "text-green-500" : "text-red-500"}`}>
              {returnPct >= 0 ? "+" : ""}{returnPct.toFixed(2)}%
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              {KRW.format(totalKrw - startingKrwEq)} {totalKrw - startingKrwEq >= 0 ? "이익" : "손실"}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">자산 배분</CardTitle></CardHeader>
        <CardContent>
          <AllocationDonut slices={slices} />
        </CardContent>
      </Card>

      <div className="text-sm text-muted-foreground">
        <Link href="/app/portfolio/holdings" className="underline">→ 보유 종목 상세</Link>
        {" · "}
        <Link href="/app/portfolio/orders" className="underline">→ 주문 내역</Link>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: portfolio index를 overview로 redirect**

`apps/web/app/app/portfolio/page.tsx`:

```tsx
import { redirect } from "next/navigation";
export default function Portfolio() {
  redirect("/app/portfolio/overview");
}
```

- [ ] **Step 4: 빌드 + 커밋**

```bash
cd apps/web && npm run build && npx tsc --noEmit
git add apps/web/components/allocation-donut.tsx apps/web/app/app/portfolio/
git commit -m "feat(web): /app/portfolio/overview with allocation donut + return %"
```

---

## Task 13: Dashboard 링크 갱신

**Files:**
- Modify: `apps/web/app/app/dashboard/page.tsx`

- [ ] **Step 1: overview 링크 추가, holdings 줄에 그대로 두기**

기존 holdings 링크 위에 overview 링크 추가:

```tsx
          <div>
            <Link href="/app/portfolio/overview" className="text-foreground underline">
              → 포트폴리오 Overview
            </Link>
          </div>
          <div>
            <Link href="/app/portfolio/holdings" className="text-foreground underline">
              → 보유 종목
            </Link>
          </div>
```

- [ ] **Step 2: 커밋**

```bash
git add apps/web/app/app/dashboard/page.tsx
git commit -m "feat(web): dashboard link to /app/portfolio/overview"
```

---

## Task 14: E2E — chart-controls (interval 토글)

**Files:**
- Create: `apps/web/tests/e2e/chart-controls.spec.ts`

- [ ] **Step 1: 작성**

```typescript
import { test, expect, type Page } from "@playwright/test";

async function signupAndGoToTrade(page: Page, symbol: string) {
  const email = `cc-${Date.now()}@test.com`;
  await page.goto("/auth/login");
  await page.getByRole("button", { name: /가입하기/i }).click();
  await page.getByLabel("이메일").fill(email);
  await page.getByLabel("비밀번호").fill("TestPass123!");
  await page.getByRole("button", { name: /^가입$/i }).click();
  await expect(page).toHaveURL(/\/app\/dashboard/, { timeout: 15_000 });
  await page.goto(`/app/trade/${encodeURIComponent(symbol)}`);
}

test.describe("Chart controls", () => {
  test("AAPL 차트: 일봉 → 1시간 토글, 지표 RSI 토글", async ({ page }) => {
    await signupAndGoToTrade(page, "AAPL");

    // 일봉이 기본 (active)
    const dayBtn = page.getByRole("button", { name: "일봉" });
    await expect(dayBtn).toBeVisible();

    // 1시간 클릭
    await page.getByRole("button", { name: "1시간" }).click();
    // 차트 영역에 "차트 로딩 중" 또는 차트 자체가 보이는지 확인
    // 워커 응답에 따라 데이터 있으면 차트, 없으면 "차트 데이터 없음"
    // 적어도 1.5초 기다림 (RPC + 렌더)
    await page.waitForTimeout(2000);

    // 지표 RSI 토글
    await page.getByRole("button", { name: "RSI" }).click();
    await expect(page.getByText(/RSI\(14\)/)).toBeVisible({ timeout: 5_000 });
  });
});
```

- [ ] **Step 2: 실행 + 커밋**

```bash
cd apps/web && npx playwright test tests/e2e/chart-controls.spec.ts -v
# Expected: 1 PASS (워커가 떠있으면)
git add apps/web/tests/e2e/chart-controls.spec.ts
git commit -m "test(web): E2E for chart interval + indicator toggle"
```

---

## Task 15: README + 마무리

**Files:**
- Modify: `README.md`

- [ ] **Step 1: 진행 상태 갱신**

Plan #4 다음에 추가:

```markdown
### Plan #4.5 — Trading UI Polish ✅ 완료

- [x] 차트 인터벌 토글 (1d/1h/15m, 인트라데이는 워커 RPC on-demand)
- [x] 지표 토글 (MA20/MA60, RSI(14), 볼린저 밴드 — 클라이언트 계산)
- [x] 종목 뉴스 카드 (yfinance Ticker.news lazy-load)
- [x] 핵심 재무 지표 카드 (EPS, Forward P/E, 베타, ROE, 부채비율 등)
- [x] 포트폴리오 Overview 페이지 (총자산 + 누적 수익률 + 자산 배분 도넛)
- [x] 워커 RPC 추가: /rpc/stocks/{bars,news,financials}
- [x] 테스트: 워커 +7 (yahoo 2 + yahoo_news 4 + RPC 3) + Web E2E +1 = **누적 70+ PASS**
```

다음 plans에서 "Plan #4 (차트)" 줄 제거 (이미 #4 완료), Plan #4.5 줄 추가, 또는 그냥 Plan #5로 넘어가는 다음 단계만 명시.

- [ ] **Step 2: 디버깅 팁 추가**

```markdown
- **인트라데이 차트가 비어있음**: 워커 RPC `/rpc/stocks/bars` 응답 확인. yfinance가 KR 인트라데이는 데이터 제한적이라 일부 종목만 동작
- **재무 지표가 — 로 표시**: yfinance Ticker.info에 해당 필드가 없는 종목 (소형주/특수 종목). 정상 동작
- **뉴스가 비어있음**: yfinance Ticker.news가 빈 배열 반환하는 종목 있음. 한국 종목은 영어 뉴스 부족
```

- [ ] **Step 3: 커밋**

```bash
git add README.md
git commit -m "docs: Plan #4.5 (Trading UI Polish) completion"
```

---

## 마무리 검증

- [ ] 워커 단위 테스트: `cd apps/worker && uv run pytest` → 66+ PASS
- [ ] 웹 빌드: `cd apps/web && npm run build` → 성공, 새 라우트들 표시
- [ ] 웹 lint/tsc: clean
- [ ] E2E: `cd apps/web && npx playwright test` → 8+ PASS, 2 SKIP
- [ ] 수동: 가입 → AAPL 검색 → 1시간/15분 토글, RSI/볼린저 토글, 뉴스/재무 카드, /app/portfolio/overview 도넛

---

## Plan #4.5에 포함되지 않은 것 (defer)

| 항목 | 정리 |
|------|------|
| 인트라데이 봉 DB 캐싱 | 워커 RPC로 충분, DB 부담 회피 |
| 풀 재무제표 (분기별 손익계산서) | 너무 복잡, 핵심 지표만 |
| RSI/MACD 별도 차트 패널 (lower) | Lightweight Charts 멀티 패널 복잡, v2에서 |
| 포트폴리오 시계열 그래프 (수익률 추이) | portfolio_snapshots는 Plan #5에서 도입 |
| 거래량 패널 | 메인 차트 위에 살짝 표시는 가능, v2 |

---

## 디버깅 팁

- **차트 변경 시 깜빡임**: useEffect 의존성에 `bars/indicator/height` 모두 들어가서 매번 재렌더. v2에서 incremental update 가능
- **RSI 계산 첫 14개 undefined**: 정상. 워밍업 구간
- **MACD slow=26 미만 데이터**: 빈 배열 반환. 60일 인트라데이는 충분
- **포트폴리오 도넛이 비어있음**: 보유 종목 0 + 현금만 있을 때. 현금만 슬라이스로 표시 (KRW/USD)
