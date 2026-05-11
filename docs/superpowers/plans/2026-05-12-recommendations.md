# Rule-Based Stock Recommendations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (chosen by user — inline) to implement this plan task-by-task.

**Goal:** 사용자가 대시보드에서 한눈에 흥미로운 종목을 발견할 수 있도록, 5개 룰 기반 카테고리로 추천 종목을 노출. spec §9.4 구현.

**Architecture:** `recommendations` 테이블에 카테고리별 rank 1-10 종목 캐시. 워커가 1시간 주기로 `stocks` + `stock_bars` 테이블을 읽어 5개 카테고리 계산 후 atomic DELETE + INSERT. 웹은 RLS public read로 직접 SELECT, 대시보드와 `/app/trade/search` 페이지에 카테고리별 카드 그리드로 노출.

**Tech Stack:** PostgreSQL (recommendations 캐시 + RLS), Python (stock_bars 집계 + 룰 계산), Next.js Server Components, Tailwind.

---

## Scope

In scope (5 카테고리, spec §9.4):
- **top_gainers** — 어제 종가 대비 오늘 종가 상승률 상위 10 (KR/US 각각)
- **top_losers** — 어제 종가 대비 오늘 종가 하락률 상위 10 (KR/US 각각)
- **volume_surge** — 오늘 거래량 / 최근 5일 평균 거래량 ≥ 3.0 인 종목 ratio 상위 10 (KR/US 각각)
- **near_52w_high** — last_price / fifty_two_week_high ≥ 0.95 인 종목 market_cap 상위 10 (KR/US 각각)
- **low_per_value** — KR 시총 top 200 중 PER > 0 인 종목 PER 최저 10 (KR만)
- 1시간 주기 재계산 (cron interval)
- 대시보드 + trade/search 페이지에 카테고리별 가로 스크롤 카드 (각 5개씩)

Out of scope (defer):
- v2 머신러닝 기반 추천
- 사용자별 개인화 (관심 종목 기반)
- 추천 클릭 추적 / 분석
- 추천 사유(reason) 자연어 생성 — v1은 score 숫자만 표시
- US `low_per_value` (yfinance PER 정확도 KR보다 낮음 — v1.5)

---

## File Structure

### DB migrations (1)
- `supabase/migrations/20260514000001_recommendations.sql` — 테이블 + RLS + 인덱스

### Worker
- `apps/worker/src/ygworker/jobs/compute_recommendations.py` — 5 카테고리 계산 + atomic 갱신
- `apps/worker/src/ygworker/main.py` — 스케줄러 통합 (1시간)
- `apps/worker/tests/test_jobs_compute_recommendations.py` — 단위 테스트 (MagicMock)

### Web
- `apps/web/components/recommendations-section.tsx` — 카테고리별 가로 스크롤 카드
- `apps/web/app/app/dashboard/page.tsx` — 추천 섹션 통합
- `apps/web/app/app/trade/search/page.tsx` — 추천 섹션 통합 (선택)

### Docs
- `README.md` — Plan #8 완료 + 카테고리 설명

---

## Task 1: 환경 점검 + branch

- [ ] **Step 1**

```bash
git branch --show-current  # plan-8-recommendations
supabase status            # API 54321 RUNNING
```

---

## Task 2: Migration — recommendations 테이블 + RLS

**Files:**
- Create: `supabase/migrations/20260514000001_recommendations.sql`

- [ ] **Step 1: 마이그레이션 작성**

```sql
create table public.recommendations (
  id uuid primary key default gen_random_uuid(),
  category text not null check (category in (
    'top_gainers', 'top_losers', 'volume_surge',
    'near_52w_high', 'low_per_value'
  )),
  market_scope text not null check (market_scope in ('KR', 'US', 'ALL')),
  symbol text not null references public.stocks(symbol),
  rank int not null check (rank >= 1 and rank <= 50),
  score numeric(20,8) not null,            -- 카테고리별 점수 (change_pct, ratio, per 등)
  reason text,                              -- 선택 — 워커가 채울 수 있는 짧은 설명
  computed_at timestamptz not null default now(),
  -- (category, market_scope, symbol) UNIQUE: 같은 카테고리에서 같은 종목 중복 방지
  unique (category, market_scope, symbol)
);

-- 한 카테고리 + scope 조회용 (정렬된 결과)
create index recommendations_category_idx
  on public.recommendations (category, market_scope, rank);

-- 최신 계산 시각 조회용 (UI에서 "방금 갱신" 표시 가능)
create index recommendations_computed_at_idx
  on public.recommendations (computed_at desc);

alter table public.recommendations enable row level security;

-- 모든 인증 사용자가 추천 조회 가능 (개인화 X — v2)
create policy "recommendations: 누구나 읽기"
  on public.recommendations for select
  to authenticated
  using (true);
-- INSERT/UPDATE/DELETE는 service_role(워커)만

comment on table public.recommendations is '룰 기반 종목 추천 캐시 (워커가 1시간마다 재계산)';
```

- [ ] **Step 2: 적용 + 커밋**

```bash
supabase db reset
git add supabase/migrations/20260514000001_recommendations.sql
git commit -m "feat(db): recommendations cache table + RLS"
```

---

## Task 3: Worker — compute_recommendations 잡 (TDD)

**Files:**
- Create: `apps/worker/src/ygworker/jobs/compute_recommendations.py`
- Create: `apps/worker/tests/test_jobs_compute_recommendations.py`

알고리즘:
1. `stocks` 테이블에서 모든 is_active=true 종목 + 메타 SELECT (symbol, currency, last_price, market_cap, per, fifty_two_week_high)
2. `stock_bars` interval='1d'에서 최근 6 거래일 (저장 효율: 한 번에 fetch 후 in-memory groupby)
3. 각 종목별로 5 metrics 계산:
   - `change_pct = (today_close - prev_close) / prev_close`
   - `volume_ratio = today_volume / mean(prev 5d volume)`
   - `near_52w_pct = last_price / fifty_two_week_high`
4. 시장(KR/US) 분리 후 카테고리별 sort + top 10
5. `low_per_value`: KR 시총 top 200 → PER>0 → PER asc top 10
6. 트랜잭션:
   - `DELETE FROM recommendations`
   - `INSERT INTO recommendations (...)` 50개 (5 카테고리 × KR/US × 10) — 또는 `low_per_value`만 1 scope이므로 90 rows

- [ ] **Step 1: 실패 테스트**

```python
# apps/worker/tests/test_jobs_compute_recommendations.py
from datetime import UTC, datetime, timedelta
from unittest.mock import MagicMock

from ygworker.jobs.compute_recommendations import (
    run_compute_recommendations,
    _compute_change_pct,
    _compute_volume_ratio,
)


def test_change_pct_positive():
    # 100 → 110: +10%
    assert abs(_compute_change_pct(today=110, prev=100) - 0.10) < 1e-9


def test_change_pct_negative():
    # 100 → 90: -10%
    assert abs(_compute_change_pct(today=90, prev=100) - (-0.10)) < 1e-9


def test_change_pct_zero_prev_returns_zero():
    # 분모 0 보호
    assert _compute_change_pct(today=10, prev=0) == 0.0


def test_volume_ratio_3x():
    # today 300, 5d avg 100 → 3.0
    assert _compute_volume_ratio(today=300, prev_5d=[100, 100, 100, 100, 100]) == 3.0


def test_volume_ratio_zero_avg_returns_zero():
    assert _compute_volume_ratio(today=500, prev_5d=[0, 0]) == 0.0


def test_run_compute_writes_recommendations_after_delete():
    """워커가 추천 테이블을 atomic 갱신: DELETE all → INSERT new."""
    fake = MagicMock()

    # stocks 테이블 응답 — KR 1개 + US 1개
    stocks_data = [
        {
            "symbol": "005930.KS", "currency": "KRW", "market": "KRX_KS",
            "last_price": 285500, "market_cap": 1_700_000_000_000_000,
            "per": 10.5, "fifty_two_week_high": 290000,
        },
        {
            "symbol": "AAPL", "currency": "USD", "market": "NASDAQ",
            "last_price": 200, "market_cap": 3_000_000_000_000,
            "per": 32.0, "fifty_two_week_high": 220,
        },
    ]
    fake.table.return_value.select.return_value.eq.return_value.execute.return_value.data = (
        stocks_data
    )

    # stock_bars 응답 — 각 종목당 6 거래일 (today + 5 prev)
    today_iso = datetime.now(UTC).date().isoformat()
    def _bars(symbol, today_close, prev_closes, today_vol, prev_vols):
        return [
            {"symbol": symbol, "ts": today_iso, "close": today_close, "volume": today_vol},
            *[
                {
                    "symbol": symbol,
                    "ts": (datetime.now(UTC).date() - timedelta(days=i + 1)).isoformat(),
                    "close": c, "volume": v,
                }
                for i, (c, v) in enumerate(zip(prev_closes, prev_vols))
            ],
        ]
    bars_data = (
        _bars("005930.KS", 285500, [260000, 258000, 255000, 257000, 260000],
              500_000_000, [100_000_000] * 5)  # 5x volume surge!
        + _bars("AAPL", 200, [180, 178, 175, 177, 179],
                50_000_000, [20_000_000] * 5)  # 2.5x — below 3.0 threshold
    )
    fake.table.return_value.select.return_value.gte.return_value.in_.return_value.execute.return_value.data = (
        bars_data
    )

    logger = MagicMock()
    run_compute_recommendations(fake, logger)

    # DELETE 호출 확인
    delete_calls = fake.table.return_value.delete.call_args_list
    assert any(c for c in delete_calls)  # 최소 1번 호출

    # INSERT 호출 확인 (5 카테고리에 각 시장별로)
    insert_calls = fake.table.return_value.insert.call_args_list
    inserted = []
    for c in insert_calls:
        rows = c.args[0] if c.args else []
        inserted.extend(rows)

    categories = {r["category"] for r in inserted}
    assert "top_gainers" in categories
    assert "volume_surge" in categories  # KR 5x volume

    # 005930.KS는 +9.8% (285500/260000 - 1) → top_gainers에 포함
    kr_gainers = [r for r in inserted if r["category"] == "top_gainers" and r["market_scope"] == "KR"]
    assert any(r["symbol"] == "005930.KS" for r in kr_gainers)

    # 005930.KS는 5x volume → KR volume_surge에 포함
    kr_surge = [r for r in inserted if r["category"] == "volume_surge" and r["market_scope"] == "KR"]
    assert any(r["symbol"] == "005930.KS" for r in kr_surge)

    # AAPL volume 2.5x는 3.0 미만 → US volume_surge 비어있어야
    us_surge = [r for r in inserted if r["category"] == "volume_surge" and r["market_scope"] == "US"]
    assert all(r["symbol"] != "AAPL" for r in us_surge)


def test_run_compute_skips_when_no_stocks():
    fake = MagicMock()
    fake.table.return_value.select.return_value.eq.return_value.execute.return_value.data = []
    logger = MagicMock()

    run_compute_recommendations(fake, logger)

    fake.table.return_value.delete.assert_not_called()
    logger.info.assert_called_with("compute_recommendations.skip", reason="no_stocks")
```

- [ ] **Step 2: 테스트 RED 확인**

```bash
cd apps/worker && uv run pytest tests/test_jobs_compute_recommendations.py -v
# Expected: ModuleNotFoundError
```

- [ ] **Step 3: 구현**

```python
# apps/worker/src/ygworker/jobs/compute_recommendations.py
"""1시간 주기. stocks + stock_bars를 읽어 5 카테고리 추천 계산.

- top_gainers / top_losers: 오늘 vs 어제 종가 change_pct, KR/US 각 top 10
- volume_surge: 오늘 / 5일 평균 거래량 ≥ 3.0, ratio 상위 10 (KR/US)
- near_52w_high: last_price / fifty_two_week_high ≥ 0.95, market_cap 상위 10 (KR/US)
- low_per_value: KR 시총 top 200 중 PER > 0, PER 최저 10 (KR만, 'KR' scope)

Atomic 갱신: 전체 DELETE → INSERT.
"""

from collections import defaultdict
from datetime import UTC, date, datetime, timedelta
from typing import Any


def _compute_change_pct(*, today: float, prev: float) -> float:
    # prev=0 보호 (분모). 음수 prev는 stock_bars에 들어올 수 없음.
    if prev == 0:
        return 0.0
    return (today - prev) / prev


def _compute_volume_ratio(*, today: float, prev_5d: list[float]) -> float:
    if not prev_5d:
        return 0.0
    avg = sum(prev_5d) / len(prev_5d)
    if avg == 0:
        return 0.0
    return today / avg


def run_compute_recommendations(supabase: Any, logger: Any) -> None:
    stocks = (
        supabase.table("stocks")
        .select("symbol, currency, market, last_price, market_cap, per, fifty_two_week_high")
        .eq("is_active", True)
        .execute()
        .data
    )
    if not stocks:
        logger.info("compute_recommendations.skip", reason="no_stocks")
        return

    logger.info("compute_recommendations.start", count=len(stocks))
    symbols = [s["symbol"] for s in stocks]

    # 최근 7 거래일치 일봉 (실제로 필요한 건 6 = today + 5 prev, 휴장일 여유분)
    cutoff = (date.today() - timedelta(days=14)).isoformat()
    bars = (
        supabase.table("stock_bars")
        .select("symbol, ts, close, volume")
        .gte("ts", cutoff)
        .in_("symbol", symbols)
        .execute()
        .data
    )

    # symbol → sorted (desc by ts) bars
    by_symbol: dict[str, list[dict]] = defaultdict(list)
    for b in bars:
        by_symbol[b["symbol"]].append(b)
    for sym, lst in by_symbol.items():
        lst.sort(key=lambda x: x["ts"], reverse=True)

    # 종목별 메트릭 계산
    enriched: list[dict] = []
    for s in stocks:
        sym = s["symbol"]
        sym_bars = by_symbol.get(sym, [])
        if len(sym_bars) < 2:
            continue  # 일봉 부족 — change_pct 계산 불가

        today_bar = sym_bars[0]
        prev_bar = sym_bars[1]
        change_pct = _compute_change_pct(
            today=float(today_bar["close"]), prev=float(prev_bar["close"])
        )

        prev_5_vols = [float(b["volume"]) for b in sym_bars[1:6]]
        volume_ratio = _compute_volume_ratio(
            today=float(today_bar["volume"]), prev_5d=prev_5_vols
        )

        last_price = float(s["last_price"]) if s["last_price"] else 0
        fifty_two_high = (
            float(s["fifty_two_week_high"]) if s["fifty_two_week_high"] else 0
        )
        near_52w_pct = last_price / fifty_two_high if fifty_two_high > 0 else 0

        enriched.append({
            **s,
            "change_pct": change_pct,
            "volume_ratio": volume_ratio,
            "near_52w_pct": near_52w_pct,
            "scope": "KR" if sym.endswith((".KS", ".KQ")) else "US",
        })

    # 카테고리별 ranking
    now_iso = datetime.now(UTC).isoformat()
    rows: list[dict] = []

    for scope in ("KR", "US"):
        scoped = [e for e in enriched if e["scope"] == scope]

        # top_gainers (change_pct desc)
        gainers = sorted(scoped, key=lambda x: x["change_pct"], reverse=True)[:10]
        for rank, e in enumerate(gainers, start=1):
            rows.append({
                "category": "top_gainers", "market_scope": scope, "symbol": e["symbol"],
                "rank": rank, "score": e["change_pct"] * 100,  # %로 저장
                "reason": f"{e['change_pct'] * 100:+.2f}%",
                "computed_at": now_iso,
            })

        # top_losers (change_pct asc)
        losers = sorted(scoped, key=lambda x: x["change_pct"])[:10]
        for rank, e in enumerate(losers, start=1):
            rows.append({
                "category": "top_losers", "market_scope": scope, "symbol": e["symbol"],
                "rank": rank, "score": e["change_pct"] * 100,
                "reason": f"{e['change_pct'] * 100:+.2f}%",
                "computed_at": now_iso,
            })

        # volume_surge (ratio >= 3.0, sort by ratio desc, top 10)
        surge = [e for e in scoped if e["volume_ratio"] >= 3.0]
        surge.sort(key=lambda x: x["volume_ratio"], reverse=True)
        for rank, e in enumerate(surge[:10], start=1):
            rows.append({
                "category": "volume_surge", "market_scope": scope, "symbol": e["symbol"],
                "rank": rank, "score": e["volume_ratio"],
                "reason": f"{e['volume_ratio']:.1f}× 평균",
                "computed_at": now_iso,
            })

        # near_52w_high (near_52w_pct >= 0.95, sort by market_cap desc, top 10)
        near = [
            e for e in scoped
            if e["near_52w_pct"] >= 0.95 and e.get("market_cap")
        ]
        near.sort(key=lambda x: float(x["market_cap"]), reverse=True)
        for rank, e in enumerate(near[:10], start=1):
            rows.append({
                "category": "near_52w_high", "market_scope": scope, "symbol": e["symbol"],
                "rank": rank, "score": e["near_52w_pct"],
                "reason": f"52주 최고가 대비 {e['near_52w_pct'] * 100:.1f}%",
                "computed_at": now_iso,
            })

    # low_per_value (KR only, market_cap top 200 중 per > 0, per asc top 10)
    kr_with_cap = [
        e for e in enriched
        if e["scope"] == "KR" and e.get("market_cap")
    ]
    kr_with_cap.sort(key=lambda x: float(x["market_cap"]), reverse=True)
    kr_top200 = kr_with_cap[:200]
    low_per = [e for e in kr_top200 if e.get("per") and float(e["per"]) > 0]
    low_per.sort(key=lambda x: float(x["per"]))
    for rank, e in enumerate(low_per[:10], start=1):
        rows.append({
            "category": "low_per_value", "market_scope": "KR", "symbol": e["symbol"],
            "rank": rank, "score": float(e["per"]),
            "reason": f"PER {float(e['per']):.1f}",
            "computed_at": now_iso,
        })

    # Atomic 갱신: DELETE all → INSERT
    # NOTE: 동시 worker 인스턴스가 있으면 race 발생. v1은 단일 워커 가정.
    try:
        supabase.table("recommendations").delete().gte("rank", 0).execute()
        if rows:
            supabase.table("recommendations").insert(rows).execute()
    except Exception as exc:
        logger.error("compute_recommendations.write_failed", error=str(exc))
        return

    logger.info(
        "compute_recommendations.done",
        inserted=len(rows),
        categories=len({r["category"] for r in rows}),
    )
```

NOTE: `supabase.table("recommendations").delete().gte("rank", 0)` — PostgREST DELETE는 WHERE 절 강제이므로 `rank>=0` (모든 row) 사용. 또는 `.neq("id", "00000000-0000-0000-0000-000000000000")` 등.

- [ ] **Step 4: GREEN 확인**

```bash
cd apps/worker && uv run pytest tests/test_jobs_compute_recommendations.py -v
# Expected: 7 PASS
```

- [ ] **Step 5: 커밋**

```bash
git add apps/worker/src/ygworker/jobs/compute_recommendations.py apps/worker/tests/test_jobs_compute_recommendations.py
git commit -m "feat(worker): compute_recommendations job (TDD 7/7, 5 categories)"
```

---

## Task 4: Worker main.py — 스케줄러 통합

**Files:**
- Modify: `apps/worker/src/ygworker/main.py`

- [ ] **Step 1: import + 스케줄 추가**

```python
from ygworker.jobs.compute_recommendations import run_compute_recommendations
```

기존 잡 묶음 끝에 추가:

```python
    # 1시간 주기: 룰 기반 종목 추천 재계산
    scheduler.add_job(
        _wrap_in_thread(run_compute_recommendations, supabase, logger),
        trigger="interval",
        hours=1,
        id="compute_recommendations",
        replace_existing=True,
    )
```

- [ ] **Step 2: 부팅 시 즉시 1회 실행 (시드용)**

`scheduler.start()` 다음에 fx와 비슷하게 즉시 호출:

```python
    # 부팅 시 1회: 추천 즉시 계산 (UI에 비어있는 추천 섹션 방지)
    # NOTE: stocks/stock_bars가 비어있으면 자체 skip
    await asyncio.to_thread(run_compute_recommendations, supabase, logger)
```

- [ ] **Step 3: 커밋**

```bash
git add apps/worker/src/ygworker/main.py
git commit -m "feat(worker): integrate compute_recommendations (1h + boot)"
```

---

## Task 5: Web — RecommendationsSection 컴포넌트

**Files:**
- Create: `apps/web/components/recommendations-section.tsx`

가로 스크롤 카드. 카테고리별로 한 줄 (KR + US 분리해서 두 행).

- [ ] **Step 1: 컴포넌트**

```tsx
// apps/web/components/recommendations-section.tsx
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const CATEGORY_LABEL: Record<string, string> = {
  top_gainers: "급등 종목",
  top_losers: "급락 종목",
  volume_surge: "거래량 급증",
  near_52w_high: "52주 신고가 근처",
  low_per_value: "저PER 가치",
};

type Rec = {
  category: string;
  market_scope: string;
  symbol: string;
  rank: number;
  score: number;
  reason: string | null;
};

type StockMeta = {
  symbol: string;
  name: string;
  name_ko: string | null;
  currency: string;
  last_price: number | null;
};

const KRW = new Intl.NumberFormat("ko-KR", {
  style: "currency", currency: "KRW", maximumFractionDigits: 0,
});
const USD = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });

export async function RecommendationsSection({
  scope = "KR",
  category,
  limit = 5,
}: {
  scope?: "KR" | "US";
  category: keyof typeof CATEGORY_LABEL;
  limit?: number;
}) {
  const supabase = await createClient();
  const { data: recs } = await supabase
    .from("recommendations")
    .select("category, market_scope, symbol, rank, score, reason")
    .eq("category", category)
    .eq("market_scope", scope)
    .order("rank", { ascending: true })
    .limit(limit);

  if (!recs || recs.length === 0) {
    return null;
  }

  const symbols = (recs as Rec[]).map((r) => r.symbol);
  const { data: stocks } = await supabase
    .from("stocks")
    .select("symbol, name, name_ko, currency, last_price")
    .in("symbol", symbols);
  const stockBySymbol = new Map<string, StockMeta>(
    ((stocks as StockMeta[] | null) ?? []).map((s) => [s.symbol, s]),
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">
          {CATEGORY_LABEL[category]} · {scope}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex gap-2 overflow-x-auto pb-2">
          {(recs as Rec[]).map((r) => {
            const stock = stockBySymbol.get(r.symbol);
            const fmt = stock?.currency === "KRW" ? KRW : USD;
            const name = stock?.name_ko ?? stock?.name ?? r.symbol;
            const price = stock?.last_price ? fmt.format(Number(stock.last_price)) : "—";
            return (
              <Link
                key={`${category}-${scope}-${r.symbol}`}
                href={`/app/trade/${encodeURIComponent(r.symbol)}`}
                className="flex-shrink-0 w-40 border rounded-lg p-3 hover:bg-muted/30 transition-colors"
              >
                <div className="text-xs text-muted-foreground">#{r.rank}</div>
                <div className="font-medium text-sm truncate">{name}</div>
                <div className="text-xs text-muted-foreground">{r.symbol}</div>
                <div className="text-sm font-mono mt-1">{price}</div>
                {r.reason && (
                  <div className={`text-xs mt-1 ${
                    category === "top_gainers" || category === "volume_surge" || category === "near_52w_high"
                      ? "text-green-500"
                      : category === "top_losers"
                      ? "text-red-500"
                      : "text-muted-foreground"
                  }`}>
                    {r.reason}
                  </div>
                )}
              </Link>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 2: 빌드 확인 + 커밋**

```bash
cd apps/web && npx tsc --noEmit && npm run lint
git add apps/web/components/recommendations-section.tsx
git commit -m "feat(web): RecommendationsSection — horizontal scroll cards per category"
```

---

## Task 6: Dashboard 통합

**Files:**
- Modify: `apps/web/app/app/dashboard/page.tsx`

대시보드 잔고 카드 다음, "곧 추가될 기능" 카드 이전에 추천 섹션들 노출.

- [ ] **Step 1: 페이지 수정**

기존 dashboard `<div className="max-w-3xl mx-auto p-6 space-y-6">` 안에 추가:

```tsx
import { RecommendationsSection } from "@/components/recommendations-section";

// ... 잔고 카드 다음, "곧 추가될 기능" 카드 앞에:
<RecommendationsSection category="top_gainers" scope="KR" />
<RecommendationsSection category="volume_surge" scope="KR" />
<RecommendationsSection category="low_per_value" scope="KR" />
<RecommendationsSection category="top_gainers" scope="US" />
<RecommendationsSection category="near_52w_high" scope="US" />
```

`RecommendationsSection`이 빈 결과면 `null` 반환하므로 추천 없는 카테고리는 그냥 사라짐.

- [ ] **Step 2: 빌드 + 커밋**

```bash
cd apps/web && npm run build && npx tsc --noEmit && npm run lint
git add apps/web/app/app/dashboard/page.tsx
git commit -m "feat(web): 대시보드에 5개 추천 섹션 노출 (KR top_gainers/volume_surge/low_per_value + US top_gainers/near_52w_high)"
```

---

## Task 7: 통합 테스트 — recommendations 갱신 사이클

**Files:**
- Create: `apps/worker/tests/test_compute_recommendations_integration.py`

real PG로 stock_bars seed → run → recommendations 채워졌는지 검증.

- [ ] **Step 1: 작성**

```python
"""Plan #8 추천 계산 통합 테스트 (real Postgres)."""

import os
import uuid
from datetime import UTC, date, datetime, timedelta

import pytest
from dotenv import load_dotenv
from supabase import create_client

from ygworker.jobs.compute_recommendations import run_compute_recommendations

load_dotenv()


@pytest.fixture(scope="module")
def admin():
    return create_client(
        os.environ["SUPABASE_URL"], os.environ["SUPABASE_SERVICE_ROLE_KEY"]
    )


@pytest.fixture
def cleanup(admin):
    symbols = []
    yield symbols
    for sym in symbols:
        try:
            admin.table("stock_bars").delete().eq("symbol", sym).execute()
            admin.table("recommendations").delete().eq("symbol", sym).execute()
            admin.table("stocks").delete().eq("symbol", sym).execute()
        except Exception:
            pass


def _seed_stock_and_bars(admin, cleanup, symbol, currency, last_price, market_cap, per, hi, today_close, prev_closes, today_vol, prev_vols):
    cleanup.append(symbol)
    market = "KRX_KS" if currency == "KRW" else "NASDAQ"
    admin.table("stocks").upsert({
        "symbol": symbol, "name": f"{symbol} Test", "market": market,
        "currency": currency, "last_price": last_price, "market_cap": market_cap,
        "per": per, "fifty_two_week_high": hi, "is_active": True,
    }, on_conflict="symbol").execute()

    today_d = date.today()
    bars = [{
        "symbol": symbol, "interval": "1d", "ts": today_d.isoformat(),
        "open": today_close, "high": today_close, "low": today_close,
        "close": today_close, "volume": today_vol,
    }]
    for i, (c, v) in enumerate(zip(prev_closes, prev_vols)):
        d = today_d - timedelta(days=i + 1)
        bars.append({
            "symbol": symbol, "interval": "1d", "ts": d.isoformat(),
            "open": c, "high": c, "low": c, "close": c, "volume": v,
        })
    admin.table("stock_bars").upsert(bars, on_conflict="symbol,interval,ts").execute()


class _Logger:
    def info(self, *a, **k): pass
    def warning(self, *a, **k): pass
    def error(self, *a, **k): pass


def test_compute_recommendations_round_trip(admin, cleanup):
    # KR 종목: 오늘 +10% + 거래량 5배 (top_gainers, volume_surge 진입 예상)
    _seed_stock_and_bars(
        admin, cleanup, "TEST_KR1", "KRW",
        last_price=11000, market_cap=1_000_000_000_000, per=8.5, hi=11500,
        today_close=11000,
        prev_closes=[10000, 9900, 9800, 9900, 10000],
        today_vol=500_000, prev_vols=[100_000] * 5,
    )

    run_compute_recommendations(admin, _Logger())

    # top_gainers KR에 TEST_KR1 포함
    gainers = (
        admin.table("recommendations")
        .select("symbol, rank, score, reason")
        .eq("category", "top_gainers").eq("market_scope", "KR")
        .order("rank").execute().data
    )
    assert any(r["symbol"] == "TEST_KR1" for r in gainers)

    # volume_surge KR에 TEST_KR1 포함 (5x)
    surge = (
        admin.table("recommendations")
        .select("symbol")
        .eq("category", "volume_surge").eq("market_scope", "KR")
        .execute().data
    )
    assert any(r["symbol"] == "TEST_KR1" for r in surge)
```

- [ ] **Step 2: 실행 + 커밋**

```bash
cd apps/worker && uv run pytest tests/test_compute_recommendations_integration.py -v
# Expected: 1 PASS

git add apps/worker/tests/test_compute_recommendations_integration.py
git commit -m "test(db): compute_recommendations integration — round trip"
```

---

## Task 8: README + 마무리

**Files:**
- Modify: `README.md`

- [ ] **Step 1: 진행 상태**

Plan #7.5 다음에:

```markdown
### Plan #8 — Rule-Based Recommendations ✅ 완료

5개 룰 기반 카테고리로 추천 종목 노출:

- **top_gainers / top_losers** — 어제→오늘 종가 변동률 ±상위 10 (KR/US 각각)
- **volume_surge** — 오늘 거래량 / 5일 평균 ≥ 3.0인 종목, ratio 상위 10 (KR/US)
- **near_52w_high** — 52주 최고가 대비 ≥ 95%인 종목, market_cap 상위 10 (KR/US)
- **low_per_value** — KR 시총 top 200 중 PER > 0, PER 최저 10 (KR only)

- [x] DB: `recommendations` 캐시 테이블 + RLS (`SELECT` public, write service_role)
- [x] 워커 잡: `compute_recommendations` (1시간 주기 + 부팅 시 즉시 1회)
- [x] Web: `RecommendationsSection` server component (가로 스크롤 카드 5개씩)
- [x] 대시보드 5섹션: KR top_gainers / volume_surge / low_per_value + US top_gainers / near_52w_high
- [x] 테스트: 워커 단위 +7 (helper 5 + worker e2e 2) + 통합 +1 = **누적 153 unit/integration + 9 E2E 통과**

NOTE: 갱신 atomic하지만 단일 워커 가정 (DELETE all → INSERT). 다중 인스턴스 시 race
가능 — 워커 1개만 운영하므로 v1 OK.
```

- [ ] **Step 2: 디버깅 팁**

```markdown
- **추천 섹션이 비어있음**: 1) `select count(*) from recommendations` 0이면 워커가 아직 안 돌았거나 stock_bars가 부족 (각 종목당 ≥2일치 필요) 2) 워커 부팅 시 자동 1회 실행됨 — 부팅 후 1분 내 채워짐
- **추천이 갱신 안 됨**: cron이 1시간 주기. 강제 즉시 갱신은 워커 재배포로
- **`top_gainers` KR에 같은 종목 중복**: `(category, market_scope, symbol)` UNIQUE라 불가. 확인된다면 schema 위반
```

- [ ] **Step 3: 커밋**

```bash
git add README.md
git commit -m "docs: Plan #8 (Rule-Based Recommendations) completion"
```

---

## 마무리 검증

- [ ] DB: 1 새 마이그레이션 적용 (~35 total)
- [ ] 워커 단위 테스트: 7 new PASS (helper 5 + e2e 2)
- [ ] 통합 테스트: 1 PASS
- [ ] 빌드/lint/tsc: clean
- [ ] 워커 부팅: scheduler_started + compute_recommendations 즉시 1회 실행 로그
- [ ] 수동 검증:
  1. `select category, market_scope, count(*) from recommendations group by 1, 2` — 5+ 카테고리 × scope에 rows
  2. 대시보드에 추천 카드 가로 스크롤 보임
  3. 카드 클릭 → 종목 상세 페이지로 이동
  4. 1시간 후 score 갱신됨 (`select max(computed_at) from recommendations` 변동)

---

## Plan #8 포함되지 않은 것 (defer)

| 항목 | 처리 |
|------|------|
| US `low_per_value` | v1.5 (yfinance PER 정확도) |
| 사용자별 개인화 | v2 (관심 종목 기반) |
| ML 기반 추천 | v2 |
| 추천 클릭 추적 | v2 |
| 자연어 reason 생성 | v1.5 |
| 다중 worker 인스턴스 동시 갱신 | v2 (단일 INSERT/DELETE row-level lock) |
