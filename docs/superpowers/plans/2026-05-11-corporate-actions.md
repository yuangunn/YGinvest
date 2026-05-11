# Corporate Actions (Dividends + Splits/Merges) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (chosen by user) to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add automatic dividend payouts and stock split/merge handling to YGinvest, fully simulated server-side.

**Architecture:** Three new tables (`dividend_events`, `dividend_payouts`, `corporate_actions`) record upcoming/applied events. Two atomic PG functions (`apply_dividend`, `apply_corporate_action`) mutate holdings + balances + orders in a single transaction. A worker job polls yfinance daily for new dividends/splits across all active stocks; a second job applies any events whose `ex_date` has passed and updates affected portfolios. Tax (KR 15.4%, US 15%) is withheld at payout. Split quantities are floored (integer-only trading), with leftover fractional value refunded as cash. Pending limit orders auto-adjust to the new ratio.

**Tech Stack:** PostgreSQL (security definer + atomic mutations), Python 3.12 (yfinance), APScheduler cron, pytest + Playwright. No web push (deferred to Plan #7).

---

## File Structure

### DB migrations (3)
- `supabase/migrations/20260512000001_corporate_action_tables.sql` — three tables + RLS
- `supabase/migrations/20260512000002_fn_apply_dividend.sql` — atomic dividend application
- `supabase/migrations/20260512000003_fn_apply_corporate_action.sql` — atomic split/merge application

### Worker
- `apps/worker/src/ygworker/data_sources/yahoo_corporate.py` — `fetch_dividends`, `fetch_splits` (yfinance wrappers)
- `apps/worker/src/ygworker/jobs/fetch_corporate_data.py` — daily fetch for all active stocks
- `apps/worker/src/ygworker/jobs/apply_corporate_events.py` — daily apply (both dividends + actions)
- `apps/worker/src/ygworker/main.py` — schedule the 2 new cron jobs

### Worker tests
- `apps/worker/tests/test_data_sources_yahoo_corporate.py` — unit (mocked yfinance)
- `apps/worker/tests/test_jobs_fetch_corporate_data.py` — unit
- `apps/worker/tests/test_jobs_apply_corporate_events.py` — unit
- `apps/worker/tests/test_corporate_action_functions.py` — integration (real PG)

### Web
- `apps/web/app/app/portfolio/transactions/page.tsx` — add dividends section

### Docs
- `README.md` — Plan #6 completion + debug tips

---

## Scope (explicit limits)

In scope:
- Cash dividends (most common); tax withholding (KR 15.4%, US 15%)
- Forward splits (`split`, ratio>1) and reverse splits (`reverse_split`, ratio<1, e.g. 0.5)
- Cascade to pending limit orders (quantity + limit_price adjusted; cancel if new_qty=0; reserved cash refunded)
- Leftover fractional shares from `floor()` paid out as cash at last_price

Out of scope (deferred):
- Stock dividends, spin-offs, special dividends, mergers/acquisitions, rights offerings
- Web Push notification on dividend/action (Plan #7)
- Backdating dividends to ex-date holders (we apply to current holders at job run time, accepting that someone who sold after ex-date but before job runs will miss it — documented limitation)
- Adjusting historical stock_bars for splits (visual chart distortion — accept as known issue)

---

## Task 1: 환경 점검 + branch

- [ ] **Step 1: 브랜치 + supabase + 워커 확인**

```bash
git branch --show-current   # plan-6-corporate-actions
supabase status              # API: 54321 RUNNING
```

워커는 통합 테스트 + 잡 작업할 때만 띄움.

---

## Task 2: Migration — 3개 테이블 + RLS

**Files:**
- Create: `supabase/migrations/20260512000001_corporate_action_tables.sql`

- [ ] **Step 1: 마이그레이션 작성**

```sql
-- 배당 이벤트 (다음 ex-date + 금액). 워커가 fetch_corporate_data로 yfinance에서 채움.
create table public.dividend_events (
  id uuid primary key default gen_random_uuid(),
  symbol text not null references public.stocks(symbol),
  ex_date date not null,
  payable_date date,
  amount_per_share numeric(20,8) not null check (amount_per_share > 0),
  currency text not null check (currency in ('KRW', 'USD')),
  applied boolean not null default false,
  applied_at timestamptz,
  created_at timestamptz not null default now(),
  unique (symbol, ex_date)
);

create index dividend_events_unapplied_idx
  on public.dividend_events (ex_date) where not applied;

alter table public.dividend_events enable row level security;

create policy "dividend_events: 누구나 읽기"
  on public.dividend_events for select
  to authenticated
  using (true);
-- INSERT/UPDATE는 service_role(워커)만. authenticated 권한 없음.

comment on table public.dividend_events is '배당 이벤트 (워커가 yfinance에서 fetch)';


-- 배당 입금 내역 (사용자별)
create table public.dividend_payouts (
  id uuid primary key default gen_random_uuid(),
  portfolio_id uuid not null references public.portfolios(id) on delete cascade,
  symbol text not null references public.stocks(symbol),
  ex_date date not null,
  qty numeric(20,4) not null check (qty > 0),
  gross numeric(20,4) not null check (gross > 0),  -- 세전 (qty * amount_per_share)
  tax numeric(20,4) not null check (tax >= 0),     -- 원천징수
  net numeric(20,4) not null check (net > 0),      -- 실수령
  currency text not null check (currency in ('KRW', 'USD')),
  executed_at timestamptz not null default now()
);

create index dividend_payouts_portfolio_idx
  on public.dividend_payouts (portfolio_id, executed_at desc);

alter table public.dividend_payouts enable row level security;

create policy "dividend_payouts: 본인 읽기"
  on public.dividend_payouts for select
  to authenticated
  using (
    portfolio_id in (
      select id from public.portfolios where user_id = auth.uid()
    )
  );

comment on table public.dividend_payouts is '배당 입금 내역 (워커가 apply_dividend로 기록)';


-- 코퍼릿 액션 (분할/병합)
create table public.corporate_actions (
  id uuid primary key default gen_random_uuid(),
  symbol text not null references public.stocks(symbol),
  action_type text not null check (action_type in ('split', 'reverse_split')),
  ratio numeric(20,8) not null check (ratio > 0),  -- 2:1 분할 → 2.0, 1:2 병합 → 0.5
  ex_date date not null,
  applied boolean not null default false,
  applied_at timestamptz,
  created_at timestamptz not null default now(),
  unique (symbol, ex_date, action_type)
);

create index corporate_actions_unapplied_idx
  on public.corporate_actions (ex_date) where not applied;

alter table public.corporate_actions enable row level security;

create policy "corporate_actions: 누구나 읽기"
  on public.corporate_actions for select
  to authenticated
  using (true);
-- INSERT/UPDATE는 service_role(워커)만.

comment on table public.corporate_actions is '분할/병합 (워커가 yfinance에서 fetch)';
```

- [ ] **Step 2: 적용 + 커밋**

```bash
supabase db reset
git add supabase/migrations/20260512000001_corporate_action_tables.sql
git commit -m "feat(db): dividend_events + dividend_payouts + corporate_actions tables + RLS"
```

---

## Task 3: PG function — apply_dividend (atomic)

**Files:**
- Create: `supabase/migrations/20260512000002_fn_apply_dividend.sql`

- [ ] **Step 1: 마이그레이션**

```sql
-- 단일 dividend_events row를 모든 holders에게 적용.
-- KR 원천징수 15.4%, US 15%.
-- service_role 전용 (워커 cron만 호출).
create or replace function public.apply_dividend(p_event_id uuid)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event dividend_events%rowtype;
  v_tax_rate numeric;
  v_holder record;
  v_gross numeric;
  v_tax numeric;
  v_net numeric;
  v_holders_count int := 0;
  v_total_net numeric := 0;
begin
  -- Lock event
  select * into v_event from dividend_events where id = p_event_id for update;
  if not found then
    raise exception 'event_not_found';
  end if;
  if v_event.applied then
    raise exception 'already_applied';
  end if;
  if v_event.ex_date > current_date then
    raise exception 'ex_date_not_reached';
  end if;

  -- 세율
  v_tax_rate := case v_event.currency
    when 'KRW' then 0.154   -- 15.4% (15% + 1.4% 지방)
    when 'USD' then 0.15
    else 0
  end;

  -- 각 holder에게 적용
  for v_holder in
    select h.portfolio_id, h.quantity, p.status
    from holdings h
    join portfolios p on p.id = h.portfolio_id
    where h.symbol = v_event.symbol and p.status = 'active'
    for update
  loop
    v_gross := v_holder.quantity * v_event.amount_per_share;
    v_tax := v_gross * v_tax_rate;
    v_net := v_gross - v_tax;

    insert into dividend_payouts (
      portfolio_id, symbol, ex_date, qty, gross, tax, net, currency
    ) values (
      v_holder.portfolio_id, v_event.symbol, v_event.ex_date,
      v_holder.quantity, v_gross, v_tax, v_net, v_event.currency
    );

    if v_event.currency = 'KRW' then
      update portfolios set krw_balance = krw_balance + v_net
      where id = v_holder.portfolio_id;
    else
      update portfolios set usd_balance = usd_balance + v_net
      where id = v_holder.portfolio_id;
    end if;

    v_holders_count := v_holders_count + 1;
    v_total_net := v_total_net + v_net;
  end loop;

  -- 이벤트 applied 마킹
  update dividend_events
  set applied = true, applied_at = now()
  where id = p_event_id;

  return json_build_object(
    'event_id', p_event_id,
    'symbol', v_event.symbol,
    'holders', v_holders_count,
    'total_net', v_total_net,
    'currency', v_event.currency
  );
end;
$$;

revoke all on function apply_dividend(uuid) from public;
grant execute on function apply_dividend(uuid) to service_role;
```

- [ ] **Step 2: 적용 + 커밋**

```bash
supabase db reset
git add supabase/migrations/20260512000002_fn_apply_dividend.sql
git commit -m "feat(db): apply_dividend PG function (atomic payout to all holders)"
```

---

## Task 4: PG function — apply_corporate_action (atomic)

**Files:**
- Create: `supabase/migrations/20260512000003_fn_apply_corporate_action.sql`

- [ ] **Step 1: 마이그레이션**

```sql
-- 단일 corporate_actions row를 모든 holders + 펜딩 주문에 적용.
-- 분할(ratio>1): 수량 늘리고, 가격 비례 낮춤. floor()로 정수만 보유.
-- 병합(ratio<1): 수량 줄이고, 가격 비례 올림.
-- 잔여 분수주는 last_price * leftover로 cash 환원.
-- service_role 전용.
create or replace function public.apply_corporate_action(p_action_id uuid)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_action corporate_actions%rowtype;
  v_currency text;
  v_last_price numeric;
  v_holder record;
  v_new_qty numeric;
  v_leftover numeric;
  v_leftover_cash numeric;
  v_new_avg numeric;
  v_holders_count int := 0;
  v_order record;
  v_new_order_qty numeric;
  v_new_order_limit numeric;
  v_new_reserved numeric;
  v_orders_adjusted int := 0;
  v_orders_cancelled int := 0;
  v_fee_rate numeric;
begin
  -- Lock action
  select * into v_action from corporate_actions where id = p_action_id for update;
  if not found then
    raise exception 'action_not_found';
  end if;
  if v_action.applied then
    raise exception 'already_applied';
  end if;
  if v_action.ex_date > current_date then
    raise exception 'ex_date_not_reached';
  end if;

  -- 종목 정보 (currency, last_price for leftover cash)
  select currency, coalesce(last_price, 0) into v_currency, v_last_price
  from stocks where symbol = v_action.symbol;
  if v_currency is null then
    raise exception 'stock_not_found';
  end if;

  -- 각 holder 처리
  for v_holder in
    select h.portfolio_id, h.quantity, h.avg_cost
    from holdings h
    join portfolios p on p.id = h.portfolio_id
    where h.symbol = v_action.symbol and p.status = 'active'
    for update
  loop
    v_new_qty := floor(v_holder.quantity * v_action.ratio);
    v_leftover := v_holder.quantity * v_action.ratio - v_new_qty;  -- 0~1
    v_leftover_cash := v_leftover * v_last_price;

    if v_new_qty > 0 then
      -- 비용 보존: total_cost = quantity * avg_cost, new_avg = total_cost / new_qty
      v_new_avg := (v_holder.quantity * v_holder.avg_cost) / v_new_qty;
      update holdings
      set quantity = v_new_qty, avg_cost = v_new_avg, updated_at = now()
      where portfolio_id = v_holder.portfolio_id and symbol = v_action.symbol;
    else
      -- 전량 분수주가 됨 (예: 1주에 1:10 reverse split → 0.1주). holdings 행 제거.
      delete from holdings
      where portfolio_id = v_holder.portfolio_id and symbol = v_action.symbol;
    end if;

    -- 잔여 현금 환원
    if v_leftover_cash > 0 then
      if v_currency = 'KRW' then
        update portfolios set krw_balance = krw_balance + v_leftover_cash
        where id = v_holder.portfolio_id;
      else
        update portfolios set usd_balance = usd_balance + v_leftover_cash
        where id = v_holder.portfolio_id;
      end if;
    end if;

    v_holders_count := v_holders_count + 1;
  end loop;

  -- 펜딩 주문 조정
  v_fee_rate := case v_currency
    when 'KRW' then 0.00215  -- KR sell 0.215% (가장 높은 것 사용 — 보수적 reserve)
    else 0.0005              -- US 0.05%
  end;

  for v_order in
    select o.id, o.portfolio_id, o.side, o.quantity, o.limit_price,
           o.reserved_amount, o.reserved_currency
    from orders o
    join portfolios p on p.id = o.portfolio_id
    where o.symbol = v_action.symbol
      and o.status = 'pending'
      and o.order_type = 'limit'
      and p.status = 'active'
    for update
  loop
    v_new_order_qty := floor(v_order.quantity * v_action.ratio);
    v_new_order_limit := v_order.limit_price / v_action.ratio;

    if v_new_order_qty = 0 then
      -- 주문 자동 취소 + reserved 환원
      if v_order.side = 'buy' and v_order.reserved_amount is not null then
        if v_order.reserved_currency = 'KRW' then
          update portfolios set krw_balance = krw_balance + v_order.reserved_amount
          where id = v_order.portfolio_id;
        else
          update portfolios set usd_balance = usd_balance + v_order.reserved_amount
          where id = v_order.portfolio_id;
        end if;
      end if;
      update orders set status = 'cancelled', cancelled_at = now()
      where id = v_order.id;
      v_orders_cancelled := v_orders_cancelled + 1;
    else
      -- 주문 갱신. BUY는 reserved 재계산.
      if v_order.side = 'buy' then
        v_new_reserved := v_new_order_qty * v_new_order_limit * (1 + v_fee_rate);
        -- reserved 차이 보정
        if v_order.reserved_amount is not null then
          if v_order.reserved_currency = 'KRW' then
            update portfolios
            set krw_balance = krw_balance + (v_order.reserved_amount - v_new_reserved)
            where id = v_order.portfolio_id;
          else
            update portfolios
            set usd_balance = usd_balance + (v_order.reserved_amount - v_new_reserved)
            where id = v_order.portfolio_id;
          end if;
        end if;
        update orders
        set quantity = v_new_order_qty,
            limit_price = v_new_order_limit,
            reserved_amount = v_new_reserved
        where id = v_order.id;
      else
        -- SELL: reserved_amount NULL이라 현금 조정 없음. 수량 + limit만 갱신.
        update orders
        set quantity = v_new_order_qty,
            limit_price = v_new_order_limit
        where id = v_order.id;
      end if;
      v_orders_adjusted := v_orders_adjusted + 1;
    end if;
  end loop;

  -- 액션 applied 마킹
  update corporate_actions
  set applied = true, applied_at = now()
  where id = p_action_id;

  return json_build_object(
    'action_id', p_action_id,
    'symbol', v_action.symbol,
    'ratio', v_action.ratio,
    'holders', v_holders_count,
    'orders_adjusted', v_orders_adjusted,
    'orders_cancelled', v_orders_cancelled
  );
end;
$$;

revoke all on function apply_corporate_action(uuid) from public;
grant execute on function apply_corporate_action(uuid) to service_role;
```

- [ ] **Step 2: 적용 + 커밋**

```bash
supabase db reset
git add supabase/migrations/20260512000003_fn_apply_corporate_action.sql
git commit -m "feat(db): apply_corporate_action PG function (split/merge with order rebalance)"
```

---

## Task 5: Worker data source — yahoo_corporate.py (TDD)

**Files:**
- Create: `apps/worker/src/ygworker/data_sources/yahoo_corporate.py`
- Create: `apps/worker/tests/test_data_sources_yahoo_corporate.py`

- [ ] **Step 1: 실패 테스트**

```python
# apps/worker/tests/test_data_sources_yahoo_corporate.py
from datetime import date
from unittest.mock import patch, MagicMock

import pandas as pd
import pytest

from ygworker.data_sources.yahoo_corporate import fetch_dividends, fetch_splits


@patch("ygworker.data_sources.yahoo_corporate.yf.Ticker")
def test_fetch_dividends_returns_future_events(mock_ticker):
    """yfinance dividends Series에서 ex-date >= today만 반환."""
    today = date(2026, 5, 11)
    past = pd.Timestamp("2026-05-01")
    future = pd.Timestamp("2026-08-15")

    series = pd.Series([0.24, 0.25], index=[past, future])
    mock_ticker.return_value.dividends = series

    out = fetch_dividends("AAPL", today=today)
    # past는 제외, future만
    assert len(out) == 1
    assert out[0]["ex_date"] == date(2026, 8, 15)
    assert out[0]["amount_per_share"] == 0.25


@patch("ygworker.data_sources.yahoo_corporate.yf.Ticker")
def test_fetch_dividends_skips_zero(mock_ticker):
    """배당 금액이 0이거나 NaN인 행은 제외."""
    future = pd.Timestamp("2026-08-15")
    other = pd.Timestamp("2026-09-15")

    series = pd.Series([0.0, 0.50], index=[future, other])
    mock_ticker.return_value.dividends = series

    out = fetch_dividends("AAPL", today=date(2026, 5, 11))
    assert len(out) == 1
    assert out[0]["amount_per_share"] == 0.50


@patch("ygworker.data_sources.yahoo_corporate.yf.Ticker")
def test_fetch_dividends_empty_series_returns_empty_list(mock_ticker):
    mock_ticker.return_value.dividends = pd.Series([], dtype=float)
    assert fetch_dividends("ZZZZ", today=date(2026, 5, 11)) == []


@patch("ygworker.data_sources.yahoo_corporate.yf.Ticker")
def test_fetch_splits_returns_forward_split(mock_ticker):
    """ratio > 1은 forward split."""
    future = pd.Timestamp("2026-06-01")
    series = pd.Series([2.0], index=[future])
    mock_ticker.return_value.splits = series

    out = fetch_splits("AAPL", today=date(2026, 5, 11))
    assert len(out) == 1
    assert out[0]["ex_date"] == date(2026, 6, 1)
    assert out[0]["ratio"] == 2.0
    assert out[0]["action_type"] == "split"


@patch("ygworker.data_sources.yahoo_corporate.yf.Ticker")
def test_fetch_splits_returns_reverse_split(mock_ticker):
    """ratio < 1은 reverse split."""
    future = pd.Timestamp("2026-06-01")
    series = pd.Series([0.5], index=[future])
    mock_ticker.return_value.splits = series

    out = fetch_splits("XYZ", today=date(2026, 5, 11))
    assert len(out) == 1
    assert out[0]["ratio"] == 0.5
    assert out[0]["action_type"] == "reverse_split"


@patch("ygworker.data_sources.yahoo_corporate.yf.Ticker")
def test_fetch_splits_skips_ratio_one(mock_ticker):
    """ratio == 1은 의미 없음. 제외."""
    series = pd.Series([1.0], index=[pd.Timestamp("2026-06-01")])
    mock_ticker.return_value.splits = series

    assert fetch_splits("FOO", today=date(2026, 5, 11)) == []
```

- [ ] **Step 2: 테스트 실패 확인**

```bash
cd apps/worker && uv run pytest tests/test_data_sources_yahoo_corporate.py -v
# Expected: ModuleNotFoundError: yahoo_corporate
```

- [ ] **Step 3: 구현**

```python
# apps/worker/src/ygworker/data_sources/yahoo_corporate.py
"""yfinance corporate actions: dividends + splits/merges.

KR 종목(`.KS`/`.KQ` suffix)도 yfinance가 그대로 받음. FDR과 달리 suffix
필요. KR 배당은 yfinance가 한국 거래소 ex-date를 정확히 알고 있는 종목만
지원 (모든 종목 X — yfinance 한계).
"""

from datetime import date
from typing import Any

import yfinance as yf
from tenacity import retry, stop_after_attempt, wait_exponential


@retry(stop=stop_after_attempt(2), wait=wait_exponential(multiplier=0.5, min=0.5, max=2))
def fetch_dividends(symbol: str, today: date) -> list[dict]:
    """yfinance Ticker.dividends에서 ex_date >= today인 행만 반환.

    Returns: list of {ex_date: date, amount_per_share: float}
    """
    series = yf.Ticker(symbol).dividends
    if series is None or len(series) == 0:
        return []

    out: list[dict] = []
    for ts, amount in series.items():
        try:
            ex_date = _ts_to_date(ts)
            if ex_date < today:
                continue
            amount_f = float(amount)
            if amount_f <= 0 or _is_nan(amount_f):
                continue
            out.append({"ex_date": ex_date, "amount_per_share": amount_f})
        except (ValueError, TypeError):
            continue
    return out


@retry(stop=stop_after_attempt(2), wait=wait_exponential(multiplier=0.5, min=0.5, max=2))
def fetch_splits(symbol: str, today: date) -> list[dict]:
    """yfinance Ticker.splits에서 ex_date >= today + ratio != 1 행만 반환.

    Returns: list of {ex_date: date, ratio: float, action_type: 'split'|'reverse_split'}
    """
    series = yf.Ticker(symbol).splits
    if series is None or len(series) == 0:
        return []

    out: list[dict] = []
    for ts, ratio in series.items():
        try:
            ex_date = _ts_to_date(ts)
            if ex_date < today:
                continue
            ratio_f = float(ratio)
            if ratio_f <= 0 or ratio_f == 1.0 or _is_nan(ratio_f):
                continue
            out.append({
                "ex_date": ex_date,
                "ratio": ratio_f,
                "action_type": "split" if ratio_f > 1 else "reverse_split",
            })
        except (ValueError, TypeError):
            continue
    return out


def _ts_to_date(value: Any) -> date:
    if hasattr(value, "date"):
        return value.date()
    return value


def _is_nan(value: Any) -> bool:
    try:
        return value != value
    except Exception:
        return False
```

- [ ] **Step 4: 테스트 통과 + 커밋**

```bash
cd apps/worker && uv run pytest tests/test_data_sources_yahoo_corporate.py -v
# Expected: 6 PASS

git add apps/worker/src/ygworker/data_sources/yahoo_corporate.py apps/worker/tests/test_data_sources_yahoo_corporate.py
git commit -m "feat(worker): yahoo_corporate data source (dividends + splits, TDD)"
```

---

## Task 6: Worker job — fetch_corporate_data (TDD)

**Files:**
- Create: `apps/worker/src/ygworker/jobs/fetch_corporate_data.py`
- Create: `apps/worker/tests/test_jobs_fetch_corporate_data.py`

- [ ] **Step 1: 실패 테스트**

```python
# apps/worker/tests/test_jobs_fetch_corporate_data.py
from datetime import date
from unittest.mock import MagicMock, patch

from ygworker.jobs.fetch_corporate_data import run_fetch_corporate_data


@patch("ygworker.jobs.fetch_corporate_data.fetch_splits")
@patch("ygworker.jobs.fetch_corporate_data.fetch_dividends")
def test_fetch_iterates_all_active_stocks_and_upserts(mock_div, mock_split):
    fake = MagicMock()
    fake.table.return_value.select.return_value.eq.return_value.execute.return_value.data = [
        {"symbol": "AAPL", "currency": "USD"},
        {"symbol": "005930.KS", "currency": "KRW"},
    ]
    mock_div.side_effect = [
        [{"ex_date": date(2026, 8, 15), "amount_per_share": 0.25}],
        [],  # 삼성 future dividend 없음
    ]
    mock_split.side_effect = [
        [],
        [{"ex_date": date(2026, 7, 1), "ratio": 2.0, "action_type": "split"}],
    ]
    logger = MagicMock()

    run_fetch_corporate_data(fake, logger, today=date(2026, 5, 11))

    # dividend upsert는 AAPL용 1건
    div_upsert_calls = [
        c for c in fake.table.return_value.upsert.call_args_list
        if c.args and c.args[0] and "amount_per_share" in c.args[0][0]
    ]
    assert len(div_upsert_calls) == 1
    assert div_upsert_calls[0].args[0][0]["symbol"] == "AAPL"
    assert div_upsert_calls[0].args[0][0]["amount_per_share"] == 0.25

    # split upsert는 삼성용 1건
    split_upsert_calls = [
        c for c in fake.table.return_value.upsert.call_args_list
        if c.args and c.args[0] and "ratio" in c.args[0][0]
    ]
    assert len(split_upsert_calls) == 1
    assert split_upsert_calls[0].args[0][0]["symbol"] == "005930.KS"
    assert split_upsert_calls[0].args[0][0]["ratio"] == 2.0


@patch("ygworker.jobs.fetch_corporate_data.fetch_splits")
@patch("ygworker.jobs.fetch_corporate_data.fetch_dividends")
def test_fetch_skips_when_no_active_stocks(mock_div, mock_split):
    fake = MagicMock()
    fake.table.return_value.select.return_value.eq.return_value.execute.return_value.data = []
    logger = MagicMock()

    run_fetch_corporate_data(fake, logger)

    mock_div.assert_not_called()
    mock_split.assert_not_called()
    logger.info.assert_called_with("fetch_corporate_data.skip", reason="no_active_stocks")


@patch("ygworker.jobs.fetch_corporate_data.fetch_splits")
@patch("ygworker.jobs.fetch_corporate_data.fetch_dividends")
def test_fetch_continues_on_per_symbol_failure(mock_div, mock_split):
    fake = MagicMock()
    fake.table.return_value.select.return_value.eq.return_value.execute.return_value.data = [
        {"symbol": "AAPL", "currency": "USD"},
        {"symbol": "BAD", "currency": "USD"},
    ]
    mock_div.side_effect = [
        [{"ex_date": date(2026, 8, 15), "amount_per_share": 0.25}],
        RuntimeError("network"),
    ]
    mock_split.side_effect = [[], RuntimeError("network")]
    logger = MagicMock()

    run_fetch_corporate_data(fake, logger, today=date(2026, 5, 11))

    # AAPL 배당은 들어감
    div_calls = [
        c for c in fake.table.return_value.upsert.call_args_list
        if c.args and c.args[0] and "amount_per_share" in c.args[0][0]
    ]
    assert any(c.args[0][0]["symbol"] == "AAPL" for c in div_calls)
    logger.warning.assert_called()
```

- [ ] **Step 2: 테스트 실패 확인**

```bash
cd apps/worker && uv run pytest tests/test_jobs_fetch_corporate_data.py -v
# Expected: ModuleNotFoundError
```

- [ ] **Step 3: 구현**

```python
# apps/worker/src/ygworker/jobs/fetch_corporate_data.py
"""일별 corporate actions fetch.

모든 active stocks를 iterate하면서 yfinance에서 future dividends + splits을
가져와서 dividend_events / corporate_actions에 upsert.

매일 06:00 KST cron (US 장 마감 ~07:00 KST 이후, 다음 장 시작 전).
"""

from datetime import date
from typing import Any

from ygworker.data_sources.yahoo_corporate import fetch_dividends, fetch_splits


def run_fetch_corporate_data(
    supabase: Any, logger: Any, today: date | None = None
) -> None:
    if today is None:
        today = date.today()

    stocks = (
        supabase.table("stocks")
        .select("symbol, currency")
        .eq("is_active", True)
        .execute()
        .data
    )
    if not stocks:
        logger.info("fetch_corporate_data.skip", reason="no_active_stocks")
        return

    logger.info("fetch_corporate_data.start", count=len(stocks))
    div_inserted = 0
    split_inserted = 0
    failed = 0

    for s in stocks:
        symbol = s["symbol"]
        currency = s["currency"]

        # Dividends
        try:
            divs = fetch_dividends(symbol, today)
        except Exception as exc:
            logger.warning(
                "fetch_corporate_data.div_failed", symbol=symbol, error=str(exc)
            )
            failed += 1
            divs = []
        for d in divs:
            try:
                supabase.table("dividend_events").upsert(
                    [{
                        "symbol": symbol,
                        "ex_date": d["ex_date"].isoformat(),
                        "amount_per_share": d["amount_per_share"],
                        "currency": currency,
                    }],
                    on_conflict="symbol,ex_date",
                ).execute()
                div_inserted += 1
            except Exception as exc:
                logger.warning(
                    "fetch_corporate_data.div_upsert_failed",
                    symbol=symbol, error=str(exc),
                )

        # Splits
        try:
            splits = fetch_splits(symbol, today)
        except Exception as exc:
            logger.warning(
                "fetch_corporate_data.split_failed", symbol=symbol, error=str(exc)
            )
            failed += 1
            splits = []
        for sp in splits:
            try:
                supabase.table("corporate_actions").upsert(
                    [{
                        "symbol": symbol,
                        "action_type": sp["action_type"],
                        "ratio": sp["ratio"],
                        "ex_date": sp["ex_date"].isoformat(),
                    }],
                    on_conflict="symbol,ex_date,action_type",
                ).execute()
                split_inserted += 1
            except Exception as exc:
                logger.warning(
                    "fetch_corporate_data.split_upsert_failed",
                    symbol=symbol, error=str(exc),
                )

    logger.info(
        "fetch_corporate_data.done",
        dividends_inserted=div_inserted,
        splits_inserted=split_inserted,
        failed=failed,
    )
```

- [ ] **Step 4: 테스트 통과 + 커밋**

```bash
cd apps/worker && uv run pytest tests/test_jobs_fetch_corporate_data.py -v
# Expected: 3 PASS

git add apps/worker/src/ygworker/jobs/fetch_corporate_data.py apps/worker/tests/test_jobs_fetch_corporate_data.py
git commit -m "feat(worker): fetch_corporate_data job (TDD, 3 tests)"
```

---

## Task 7: Worker job — apply_corporate_events (TDD)

**Files:**
- Create: `apps/worker/src/ygworker/jobs/apply_corporate_events.py`
- Create: `apps/worker/tests/test_jobs_apply_corporate_events.py`

- [ ] **Step 1: 실패 테스트**

```python
# apps/worker/tests/test_jobs_apply_corporate_events.py
from unittest.mock import MagicMock

from ygworker.jobs.apply_corporate_events import run_apply_corporate_events


def test_apply_unapplied_dividends_and_actions():
    fake = MagicMock()
    # dividend_events: 2건 (둘 다 ex_date 도달)
    # corporate_actions: 1건
    div_rows = [{"id": "d1"}, {"id": "d2"}]
    action_rows = [{"id": "a1"}]
    # 첫 호출(events) → div, 두번째(actions) → actions
    fake.table.return_value.select.return_value.eq.return_value.lte.return_value.execute.return_value.data = (
        div_rows
    )
    # Side-effect: 두 번 호출되므로 변경

    # Use side_effect 더 정확히
    select_responses = [
        MagicMock(data=div_rows),
        MagicMock(data=action_rows),
    ]
    fake.table.return_value.select.return_value.eq.return_value.lte.return_value.execute.side_effect = (
        select_responses
    )

    fake.rpc.return_value.execute.side_effect = [
        MagicMock(data={"holders": 3, "total_net": 100}),
        MagicMock(data={"holders": 3, "total_net": 200}),
        MagicMock(data={"holders": 2, "orders_adjusted": 1, "orders_cancelled": 0}),
    ]

    logger = MagicMock()
    run_apply_corporate_events(fake, logger)

    rpc_calls = fake.rpc.call_args_list
    assert len(rpc_calls) == 3
    rpc_names = [c.args[0] for c in rpc_calls]
    assert rpc_names.count("apply_dividend") == 2
    assert rpc_names.count("apply_corporate_action") == 1


def test_apply_handles_no_unapplied():
    fake = MagicMock()
    fake.table.return_value.select.return_value.eq.return_value.lte.return_value.execute.return_value.data = []
    logger = MagicMock()

    run_apply_corporate_events(fake, logger)

    fake.rpc.assert_not_called()
    logger.info.assert_called_with(
        "apply_corporate_events.done",
        dividends_applied=0, actions_applied=0, failed=0,
    )


def test_apply_continues_on_per_event_failure():
    fake = MagicMock()
    select_responses = [
        MagicMock(data=[{"id": "d1"}, {"id": "d2"}]),
        MagicMock(data=[]),  # actions 없음
    ]
    fake.table.return_value.select.return_value.eq.return_value.lte.return_value.execute.side_effect = (
        select_responses
    )
    fake.rpc.return_value.execute.side_effect = [
        RuntimeError("event_not_found"),  # d1 실패
        MagicMock(data={"holders": 2, "total_net": 50}),  # d2 성공
    ]
    logger = MagicMock()

    run_apply_corporate_events(fake, logger)

    assert fake.rpc.call_count == 2
    logger.warning.assert_called()
```

- [ ] **Step 2: 테스트 실패 확인**

```bash
cd apps/worker && uv run pytest tests/test_jobs_apply_corporate_events.py -v
# Expected: ModuleNotFoundError
```

- [ ] **Step 3: 구현**

```python
# apps/worker/src/ygworker/jobs/apply_corporate_events.py
"""ex_date 도달한 dividend_events + corporate_actions를 atomically 적용.

PG functions (apply_dividend, apply_corporate_action)이 모든 holders/orders
변경을 single transaction으로 처리. 워커는 단순 dispatcher.

매일 09:00 KST cron (KR 장 시작 직후, US 장 마감 직후).
"""

from datetime import date
from typing import Any


def run_apply_corporate_events(
    supabase: Any, logger: Any, today: date | None = None
) -> None:
    if today is None:
        today = date.today()
    today_iso = today.isoformat()

    div_applied = 0
    act_applied = 0
    failed = 0

    # 1) 미적용 배당 events
    events = (
        supabase.table("dividend_events")
        .select("id")
        .eq("applied", False)
        .lte("ex_date", today_iso)
        .execute()
        .data
    )
    for ev in events or []:
        try:
            supabase.rpc("apply_dividend", {"p_event_id": ev["id"]}).execute()
            div_applied += 1
        except Exception as exc:
            failed += 1
            logger.warning(
                "apply_corporate_events.dividend_failed",
                event_id=ev["id"], error=str(exc),
            )

    # 2) 미적용 corporate actions
    actions = (
        supabase.table("corporate_actions")
        .select("id")
        .eq("applied", False)
        .lte("ex_date", today_iso)
        .execute()
        .data
    )
    for act in actions or []:
        try:
            supabase.rpc("apply_corporate_action", {"p_action_id": act["id"]}).execute()
            act_applied += 1
        except Exception as exc:
            failed += 1
            logger.warning(
                "apply_corporate_events.action_failed",
                action_id=act["id"], error=str(exc),
            )

    logger.info(
        "apply_corporate_events.done",
        dividends_applied=div_applied,
        actions_applied=act_applied,
        failed=failed,
    )
```

- [ ] **Step 4: 테스트 통과 + 커밋**

```bash
cd apps/worker && uv run pytest tests/test_jobs_apply_corporate_events.py -v
# Expected: 3 PASS

git add apps/worker/src/ygworker/jobs/apply_corporate_events.py apps/worker/tests/test_jobs_apply_corporate_events.py
git commit -m "feat(worker): apply_corporate_events job (TDD, 3 tests)"
```

---

## Task 8: Worker main.py — 새 잡 2개 통합

**Files:**
- Modify: `apps/worker/src/ygworker/main.py`

- [ ] **Step 1: import + 스케줄 추가**

```python
from ygworker.jobs.apply_corporate_events import run_apply_corporate_events
from ygworker.jobs.fetch_corporate_data import run_fetch_corporate_data
```

기존 `scheduler.add_job(...)` 묶음에 추가 (`portfolio_snapshot` 다음 줄에):

```python
    # 매일 06:00 KST: yfinance에서 dividends + splits fetch
    scheduler.add_job(
        _wrap_in_thread(run_fetch_corporate_data, supabase, logger),
        trigger="cron",
        hour=6,
        minute=0,
        id="fetch_corporate_data",
        replace_existing=True,
    )
    # 매일 09:00 KST: ex_date 도달한 dividend/action 적용
    scheduler.add_job(
        _wrap_in_thread(run_apply_corporate_events, supabase, logger),
        trigger="cron",
        hour=9,
        minute=0,
        id="apply_corporate_events",
        replace_existing=True,
    )
```

- [ ] **Step 2: 부팅 검증**

```bash
cd apps/worker
PYTHONPATH=src PYTHONUTF8=1 SUPABASE_URL=http://127.0.0.1:54321 SUPABASE_SERVICE_ROLE_KEY=... WORKER_RPC_SECRET=dev timeout 10 uv run python -m ygworker.main 2>&1 | grep -i "scheduler_started\|error" | head -5
# Expected: worker.scheduler_started 1줄
```

- [ ] **Step 3: 커밋**

```bash
git add apps/worker/src/ygworker/main.py
git commit -m "feat(worker): integrate fetch_corporate_data (06:00) + apply_corporate_events (09:00)"
```

---

## Task 9: 통합 테스트 — corporate action flows

**Files:**
- Create: `apps/worker/tests/test_corporate_action_functions.py`

- [ ] **Step 1: 작성**

```python
"""Plan #6 corporate actions PG functions 통합 테스트 (real Postgres)."""

import os
import uuid
from datetime import UTC, date, datetime, timedelta

import pytest
from dotenv import load_dotenv
from postgrest.exceptions import APIError
from supabase import create_client

load_dotenv()


@pytest.fixture(scope="module")
def admin():
    return create_client(
        os.environ["SUPABASE_URL"], os.environ["SUPABASE_SERVICE_ROLE_KEY"]
    )


@pytest.fixture
def cleanup(admin):
    user_ids: list[str] = []
    symbols: list[str] = []
    yield {"users": user_ids, "symbols": symbols}
    for uid in user_ids:
        try:
            admin.auth.admin.delete_user(uid)
        except Exception:
            pass
    for sym in symbols:
        try:
            admin.table("stocks").delete().eq("symbol", sym).execute()
        except Exception:
            pass


def _make_user_with_holdings(admin, cleanup, symbol: str, qty: float, currency: str):
    """가입 + portfolio에 holding 추가. Returns (user_id, portfolio_id)."""
    email = f"corp-{uuid.uuid4()}@test.com"
    res = admin.auth.admin.create_user(
        {"email": email, "password": "TestPass123!", "email_confirm": True}
    )
    user_id = res.user.id
    cleanup["users"].append(user_id)

    pfl = (
        admin.table("portfolios")
        .select("id")
        .eq("user_id", user_id)
        .is_("room_id", "null")
        .single()
        .execute()
        .data
    )
    admin.table("holdings").insert({
        "portfolio_id": pfl["id"],
        "symbol": symbol,
        "quantity": qty,
        "avg_cost": 100 if currency == "USD" else 50000,
    }).execute()
    return user_id, pfl["id"]


def _seed_stock(admin, cleanup, symbol: str, currency: str, last_price: float):
    admin.table("stocks").upsert({
        "symbol": symbol,
        "name": f"{symbol} Test",
        "market": "NASDAQ" if currency == "USD" else "KRX_KS",
        "currency": currency,
        "last_price": last_price,
        "is_active": True,
    }, on_conflict="symbol").execute()
    cleanup["symbols"].append(symbol)


def test_apply_dividend_pays_holders_with_tax(admin, cleanup):
    """배당 적용: 보유 10주 × $0.25 = $2.50 gross, $0.375 tax (15%), $2.125 net."""
    symbol = "TEST_DIV_US"
    _seed_stock(admin, cleanup, symbol, "USD", 150)
    _, pfl_id = _make_user_with_holdings(admin, cleanup, symbol, 10, "USD")

    # 이벤트 생성 (ex_date 어제 — 이미 도달)
    yesterday = (date.today() - timedelta(days=1)).isoformat()
    ev = admin.table("dividend_events").insert({
        "symbol": symbol,
        "ex_date": yesterday,
        "amount_per_share": 0.25,
        "currency": "USD",
    }).execute().data[0]

    # 초기 잔고 기록
    initial = admin.table("portfolios").select("usd_balance").eq("id", pfl_id).single().execute().data
    initial_usd = float(initial["usd_balance"])

    # apply_dividend RPC 호출
    res = admin.rpc("apply_dividend", {"p_event_id": ev["id"]}).execute()
    body = res.data
    assert body["holders"] == 1
    assert abs(float(body["total_net"]) - 2.125) < 0.01  # $2.50 - $0.375

    # portfolio 잔고 확인
    after = admin.table("portfolios").select("usd_balance").eq("id", pfl_id).single().execute().data
    delta = float(after["usd_balance"]) - initial_usd
    assert abs(delta - 2.125) < 0.01

    # dividend_payouts row 확인
    payouts = admin.table("dividend_payouts").select("*").eq("portfolio_id", pfl_id).eq("symbol", symbol).execute().data
    assert len(payouts) == 1
    assert abs(float(payouts[0]["gross"]) - 2.50) < 0.01
    assert abs(float(payouts[0]["tax"]) - 0.375) < 0.01

    # 이벤트 applied 확인
    ev_after = admin.table("dividend_events").select("applied").eq("id", ev["id"]).single().execute().data
    assert ev_after["applied"] is True


def test_apply_dividend_kr_uses_15_4_percent_tax(admin, cleanup):
    """KR 배당 세율 15.4% 적용."""
    symbol = "TEST_DIV_KR"
    _seed_stock(admin, cleanup, symbol, "KRW", 50000)
    _, pfl_id = _make_user_with_holdings(admin, cleanup, symbol, 10, "KRW")

    yesterday = (date.today() - timedelta(days=1)).isoformat()
    ev = admin.table("dividend_events").insert({
        "symbol": symbol,
        "ex_date": yesterday,
        "amount_per_share": 1000,
        "currency": "KRW",
    }).execute().data[0]

    res = admin.rpc("apply_dividend", {"p_event_id": ev["id"]}).execute()
    # 10 × 1000 = 10,000 gross; 10,000 × 0.154 = 1,540 tax; 8,460 net
    assert abs(float(res.data["total_net"]) - 8460) < 1


def test_apply_dividend_rejects_double_apply(admin, cleanup):
    symbol = "TEST_DIV_DBL"
    _seed_stock(admin, cleanup, symbol, "USD", 100)
    _make_user_with_holdings(admin, cleanup, symbol, 5, "USD")

    yesterday = (date.today() - timedelta(days=1)).isoformat()
    ev = admin.table("dividend_events").insert({
        "symbol": symbol,
        "ex_date": yesterday,
        "amount_per_share": 0.5,
        "currency": "USD",
    }).execute().data[0]

    admin.rpc("apply_dividend", {"p_event_id": ev["id"]}).execute()
    with pytest.raises(APIError) as exc:
        admin.rpc("apply_dividend", {"p_event_id": ev["id"]}).execute()
    assert "already_applied" in str(exc.value)


def test_apply_corporate_action_2_to_1_split(admin, cleanup):
    """2:1 forward split: 보유 10주 → 20주, avg_cost 절반."""
    symbol = "TEST_SPLIT_US"
    _seed_stock(admin, cleanup, symbol, "USD", 150)
    _, pfl_id = _make_user_with_holdings(admin, cleanup, symbol, 10, "USD")

    yesterday = (date.today() - timedelta(days=1)).isoformat()
    act = admin.table("corporate_actions").insert({
        "symbol": symbol,
        "action_type": "split",
        "ratio": 2.0,
        "ex_date": yesterday,
    }).execute().data[0]

    initial = admin.table("portfolios").select("usd_balance").eq("id", pfl_id).single().execute().data
    initial_usd = float(initial["usd_balance"])

    res = admin.rpc("apply_corporate_action", {"p_action_id": act["id"]}).execute()
    assert res.data["holders"] == 1

    holding = admin.table("holdings").select("quantity, avg_cost").eq("portfolio_id", pfl_id).eq("symbol", symbol).single().execute().data
    assert float(holding["quantity"]) == 20
    assert abs(float(holding["avg_cost"]) - 50) < 0.01  # 100/2

    # 정확한 분할이라 leftover_cash = 0
    after = admin.table("portfolios").select("usd_balance").eq("id", pfl_id).single().execute().data
    assert abs(float(after["usd_balance"]) - initial_usd) < 0.01


def test_apply_corporate_action_1_to_2_merge_with_leftover(admin, cleanup):
    """1:2 reverse split (ratio=0.5): 보유 5주 → 2주, leftover 0.5주는 cash 환원."""
    symbol = "TEST_MERGE_US"
    _seed_stock(admin, cleanup, symbol, "USD", 100)
    _, pfl_id = _make_user_with_holdings(admin, cleanup, symbol, 5, "USD")

    yesterday = (date.today() - timedelta(days=1)).isoformat()
    act = admin.table("corporate_actions").insert({
        "symbol": symbol,
        "action_type": "reverse_split",
        "ratio": 0.5,
        "ex_date": yesterday,
    }).execute().data[0]

    initial = admin.table("portfolios").select("usd_balance").eq("id", pfl_id).single().execute().data
    initial_usd = float(initial["usd_balance"])

    admin.rpc("apply_corporate_action", {"p_action_id": act["id"]}).execute()

    holding = admin.table("holdings").select("quantity").eq("portfolio_id", pfl_id).eq("symbol", symbol).single().execute().data
    assert float(holding["quantity"]) == 2  # floor(5 * 0.5) = 2

    # leftover: 5 * 0.5 - 2 = 0.5주 × $100 = $50
    after = admin.table("portfolios").select("usd_balance").eq("id", pfl_id).single().execute().data
    delta = float(after["usd_balance"]) - initial_usd
    assert abs(delta - 50) < 0.01


def test_apply_corporate_action_full_dilution_deletes_holding(admin, cleanup):
    """1:10 reverse split with single share: floor(1*0.1)=0 → holdings row 삭제."""
    symbol = "TEST_FULL_DILUTE"
    _seed_stock(admin, cleanup, symbol, "USD", 200)
    _, pfl_id = _make_user_with_holdings(admin, cleanup, symbol, 1, "USD")

    yesterday = (date.today() - timedelta(days=1)).isoformat()
    act = admin.table("corporate_actions").insert({
        "symbol": symbol,
        "action_type": "reverse_split",
        "ratio": 0.1,
        "ex_date": yesterday,
    }).execute().data[0]

    initial = admin.table("portfolios").select("usd_balance").eq("id", pfl_id).single().execute().data
    initial_usd = float(initial["usd_balance"])

    admin.rpc("apply_corporate_action", {"p_action_id": act["id"]}).execute()

    # holdings row 삭제됨 (quantity > 0 CHECK이라 0 row 못 둠)
    holding_q = (
        admin.table("holdings")
        .select("quantity")
        .eq("portfolio_id", pfl_id)
        .eq("symbol", symbol)
        .execute()
    )
    assert holding_q.data == []

    # 전량 leftover: 1 * 0.1 = 0.1주 × $200 = $20
    after = admin.table("portfolios").select("usd_balance").eq("id", pfl_id).single().execute().data
    delta = float(after["usd_balance"]) - initial_usd
    assert abs(delta - 20) < 0.01


def test_apply_corporate_action_rebalances_pending_buy_order(admin, cleanup):
    """2:1 forward split with a pending BUY limit order:
    수량 2배, limit_price 절반, reserved_amount는 동일 (수학적으로 보존)."""
    symbol = "TEST_SPLIT_ORDER"
    _seed_stock(admin, cleanup, symbol, "USD", 150)
    _, pfl_id = _make_user_with_holdings(admin, cleanup, symbol, 1, "USD")
    # holdings는 액션 적용을 위해 필요 (위 함수가 그 행도 처리)

    # 펜딩 BUY 지정가 주문 시드 (워커가 직접 raw INSERT — place_limit_order는 auth.uid() 필요)
    # 시드 reserved: 10주 × $100 × (1 + 0.0005) = $1000.50
    order_id = admin.table("orders").insert({
        "portfolio_id": pfl_id,
        "symbol": symbol,
        "side": "buy",
        "order_type": "limit",
        "quantity": 10,
        "limit_price": 100,
        "status": "pending",
        "reserved_amount": 1000.50,
        "reserved_currency": "USD",
    }).execute().data[0]

    yesterday = (date.today() - timedelta(days=1)).isoformat()
    act = admin.table("corporate_actions").insert({
        "symbol": symbol,
        "action_type": "split",
        "ratio": 2.0,
        "ex_date": yesterday,
    }).execute().data[0]

    initial = admin.table("portfolios").select("usd_balance").eq("id", pfl_id).single().execute().data
    initial_usd = float(initial["usd_balance"])

    res = admin.rpc("apply_corporate_action", {"p_action_id": act["id"]}).execute()
    assert res.data["orders_adjusted"] == 1
    assert res.data["orders_cancelled"] == 0

    o_after = (
        admin.table("orders")
        .select("quantity, limit_price, reserved_amount, status")
        .eq("id", order_id["id"])
        .single()
        .execute()
        .data
    )
    assert float(o_after["quantity"]) == 20  # 10 * 2
    assert abs(float(o_after["limit_price"]) - 50) < 0.01  # 100 / 2
    # new reserved = 20 * 50 * 1.0005 = $1000.50 (정확히 동일)
    assert abs(float(o_after["reserved_amount"]) - 1000.50) < 0.01
    assert o_after["status"] == "pending"

    # 잔고 차이는 holdings leftover(0) + 주문 reserved 차이(0) = 0
    after = admin.table("portfolios").select("usd_balance").eq("id", pfl_id).single().execute().data
    assert abs(float(after["usd_balance"]) - initial_usd) < 0.01
```

- [ ] **Step 2: 실행**

```bash
cd apps/worker && uv run pytest tests/test_corporate_action_functions.py -v
# Expected: 5 PASS
```

- [ ] **Step 3: 커밋**

```bash
git add apps/worker/tests/test_corporate_action_functions.py
git commit -m "test(db): integration tests for apply_dividend/apply_corporate_action (5 scenarios)"
```

---

## Task 10: Web — Portfolio transactions에 배당 섹션 추가

**Files:**
- Modify: `apps/web/app/app/portfolio/transactions/page.tsx`

- [ ] **Step 1: 페이지 수정**

기존 trades + fx Promise.all에 dividends 추가:

```tsx
const [trades, fx, dividends] = portfolioId
  ? await Promise.all([
      supabase
        .from("trades")
        .select("*")
        .eq("portfolio_id", portfolioId)
        .order("executed_at", { ascending: false })
        .limit(50),
      supabase
        .from("fx_transactions")
        .select("*")
        .eq("portfolio_id", portfolioId)
        .order("executed_at", { ascending: false })
        .limit(50),
      supabase
        .from("dividend_payouts")
        .select("*")
        .eq("portfolio_id", portfolioId)
        .order("executed_at", { ascending: false })
        .limit(50),
    ])
  : [{ data: null }, { data: null }, { data: null }];
```

기존 환전 카드 다음에 배당 카드 추가:

```tsx
<Card>
  <CardHeader><CardTitle className="text-base">배당</CardTitle></CardHeader>
  <CardContent>
    {!dividends.data?.length ? (
      <div className="text-sm text-muted-foreground">없음</div>
    ) : (
      <ul className="text-sm space-y-1">
        {dividends.data.map((d) => (
          <li key={d.id}>
            {d.symbol} · {d.qty}주 · {d.currency === "KRW" ? "₩" : "$"}{Number(d.gross).toLocaleString()} (gross) −
            {" "}{d.currency === "KRW" ? "₩" : "$"}{Number(d.tax).toLocaleString()} (tax) ={" "}
            <strong>{d.currency === "KRW" ? "₩" : "$"}{Number(d.net).toLocaleString()}</strong>
            {" · "}ex {d.ex_date}
            {" · "}{new Date(d.executed_at).toLocaleString("ko-KR")}
          </li>
        ))}
      </ul>
    )}
  </CardContent>
</Card>
```

- [ ] **Step 2: 빌드 + 커밋**

```bash
cd apps/web && npm run build && npx tsc --noEmit && npm run lint
git add apps/web/app/app/portfolio/transactions/page.tsx
git commit -m "feat(web): show dividend payouts in /app/portfolio/transactions"
```

---

## Task 11: README 갱신 + 마무리

**Files:**
- Modify: `README.md`

- [ ] **Step 1: 진행 상태**

Plan #5 다음에 추가:

```markdown
### Plan #6 — Corporate Actions (Dividends + Splits) ✅ 완료

- [x] DB: dividend_events, dividend_payouts, corporate_actions 테이블 + RLS
- [x] PG 함수 2개: apply_dividend (KR 15.4% / US 15% 세율), apply_corporate_action (split + reverse_split with order rebalance + leftover cash)
- [x] 워커 잡 2개: fetch_corporate_data (06:00 KST), apply_corporate_events (09:00 KST)
- [x] 데이터 소스: yahoo_corporate.py (yfinance Ticker.dividends/splits 래핑)
- [x] Web: /app/portfolio/transactions에 배당 섹션 추가
- [x] 테스트: 워커 단위 +12 (data source 6 + fetch 3 + apply 3) + 통합 +7 (US/KR/double + 2:1 split + 1:2 merge + full dilution + order rebalance) = **누적 100+ PASS**

### 다음 plans

- Plan #7: Web Push 알림 (VAPID + service worker + 6개 트리거)
- Plan #8: 룰 기반 추천 (top_gainers/losers/volume_surge/near_52w_high/low_per_value)
- Plan #9: PWA & Polish (manifest, 다크/라이트, 모바일 UX)
- Plan #10 (v1.5): Design Polish — shadcn 기본 → 커스텀 디자인 시스템
```

- [ ] **Step 2: 디버깅 팁 추가**

```markdown
- **배당이 적용 안 됨**: `dividend_events` 테이블 확인. yfinance가 ex_date를 못 가져오는 KR 종목 다수 (yfinance 한계). FDR로 보완은 v1.5
- **분할 후 보유 수량 0**: floor(qty * ratio) = 0이면 holdings row 삭제됨. leftover_cash로 환원됨 (잔고 확인)
- **펜딩 주문이 분할 후 자동 취소**: floor(qty * ratio) = 0인 케이스. 환원된 reserved_amount가 잔고에 들어감
- **`already_applied`**: PG 함수가 중복 호출 방지. apply 후 events.applied=true
- **`ex_date_not_reached`**: 워커가 너무 일찍 호출 — apply_corporate_events 잡은 ex_date <= today만 처리해야 함
```

- [ ] **Step 3: 커밋**

```bash
git add README.md
git commit -m "docs: Plan #6 (Corporate Actions) completion"
```

---

## 마무리 검증

- [ ] `supabase db reset` 통과, 3 새 마이그레이션 적용 (32+ total)
- [ ] 워커 단위 테스트: 12 new PASS (yahoo_corporate 6 + fetch 3 + apply 3)
- [ ] 통합 테스트: 5 PASS (apply_dividend US/KR/double + 2:1 split + 1:2 merge)
- [ ] 빌드/lint/tsc: clean
- [ ] 워커 부팅: scheduler_started 로그 + 2 새 잡 등록
- [ ] 수동:
  1. 가입 → portfolio에 holdings (예: AAPL 10주) 시드 (admin 클라이언트로)
  2. `dividend_events` insert (ex_date=어제)
  3. `select * from dividend_events where applied=false` → 1건
  4. 9시까지 기다리거나 수동 `select apply_dividend(id)`
  5. /app/portfolio/transactions에서 배당 카드 보임

---

## Plan #6 포함되지 않은 것 (defer)

| 항목 | 처리 |
|------|------|
| Web Push 알림 (배당/분할 시 발송) | Plan #7 |
| 룰 기반 종목 추천 | Plan #8 |
| Stock dividends (주식 배당) | v2 |
| 스핀오프 / M&A | v2 |
| 배당 ex-date의 정확한 holders (현재는 job 실행 시점 holders) | v1.5 |
| 분할 후 stock_bars 자동 조정 | v1.5 |
| KR 종목 배당 정확도 (yfinance 한계, FDR 보완) | v1.5 |

---

## 디버깅 팁 (개발 중)

- **PG 함수 `event_not_found`**: dividend_events.id가 잘못됨. UUID 형식 확인
- **`stock_not_found`**: 분할 적용 시 stocks 테이블에 해당 symbol 없음. apply 전에 stocks 행 존재해야
- **`ex_date_not_reached`**: 미래 이벤트 강제 적용 막음. ex_date <= today 조건 만족해야
- **yfinance dividend returns past dates**: `fetch_dividends`가 today 기준 필터링. 과거 배당은 무시 (소급 적용 안 함 — v1 단순화)
- **leftover_cash가 음수**: floor 결과가 quantity*ratio보다 커질 수 없으므로 항상 ≥0. 음수면 buggy
- **펜딩 주문 reserved_amount 차이 보정 음수**: 새 reserved가 더 크면 portfolios 잔고에서 차감. portfolio 잔고 부족하면 어쩌지? → 분할은 가격 비례이므로 reserved 총액은 동일해야. 정수 floor 때문에 약간 줄 수 있어도 늘진 않음. 안전.
