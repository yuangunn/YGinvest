# YGinvest Plan #3 — Trading Core Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 사용자가 글로벌 포트폴리오에서 시장가/지정가 주문을 제출하면 잔고·보유·주문이 원자적으로 업데이트되고, 워커가 1분마다 펜딩 지정가 주문을 매칭하며, 환전(KRW↔USD)으로 통화 잔고 간 이동이 가능하다.

**Architecture:** Postgres 함수에 트랜잭션 + `SELECT FOR UPDATE` 잠금을 묶어 race-safe 주문 처리. Next.js API Route는 인증·시장시간 검증 후 `supabase.rpc()`로 함수 호출. 워커는 1분 주기로 `match_limit_order`를 펜딩 주문에 호출. 미니멀 UI(매수/매도 카드, 주문 목록, 환전 폼)로 흐름을 검증 — Plan #4에서 Bottom Sheet + 차트로 폴리시.

**Tech Stack 추가:** Postgres `plpgsql` functions · `supabase.rpc()` · Next.js API Routes (server actions은 미사용 — RPC 호출이 단순)

---

## 사전 요구사항

- Plan #2 완료 (master 머지됨, 클라우드 배포됨)
- Supabase 로컬 + Docker 가동 중
- 워커 가상환경 + 웹 dev 서버 가동 가능

---

## 파일 구조 (이 plan에서 추가/수정)

```
supabase/migrations/
  20260510020001_holdings.sql                    (NEW)
  20260510020002_orders.sql                      (NEW)
  20260510020003_trades.sql                      (NEW)
  20260510020004_fx_transactions.sql             (NEW)
  20260510020005_trading_rls.sql                 (NEW)
  20260510020006_fn_place_market_order.sql       (NEW)
  20260510020007_fn_place_limit_order.sql        (NEW)
  20260510020008_fn_cancel_order.sql             (NEW)
  20260510020009_fn_match_limit_order.sql        (NEW)
  20260510020010_fn_exchange_currency.sql        (NEW)

apps/worker/
  src/ygworker/jobs/
    matching_engine.py                            (NEW: 1분 주기로 펜딩 주문 매칭)
  src/ygworker/main.py                            (MODIFY: matching_engine 잡 추가)
  tests/
    test_jobs_matching_engine.py                  (NEW: 단위 테스트, 모킹)
    test_trading_functions.py                     (NEW: PG 함수 통합 테스트)

apps/web/
  app/api/
    orders/route.ts                               (NEW: POST /api/orders, GET /api/orders)
    orders/[id]/route.ts                          (NEW: DELETE /api/orders/:id)
    fx/exchange/route.ts                          (NEW: POST /api/fx/exchange)
    fx/transactions/route.ts                      (NEW: GET /api/fx/transactions)
    holdings/route.ts                             (NEW: GET /api/holdings)
    trades/route.ts                               (NEW: GET /api/trades)
  app/app/trade/[symbol]/page.tsx                 (MODIFY: 매수/매도 카드 추가)
  app/app/portfolio/                              (NEW dir)
    page.tsx                                      (NEW: redirect → orders)
    orders/page.tsx                               (NEW: 주문 목록 + 취소 버튼)
    holdings/page.tsx                             (NEW: 보유 종목 목록)
    transactions/page.tsx                         (NEW: 환전 + 체결 내역)
  app/app/fx/
    page.tsx                                      (NEW: 환전 폼)
  components/
    order-form.tsx                                (NEW: 매수/매도 클라이언트 폼)
    cancel-order-button.tsx                       (NEW: 펜딩 주문 취소)
    fx-exchange-form.tsx                          (NEW: KRW↔USD 환전 폼)
  lib/
    market-hours.ts                               (NEW: KR/US 장 운영 시간 판정 client+server)
  app/app/dashboard/page.tsx                      (MODIFY: 포트폴리오/주문/환전 링크)
  tests/e2e/
    trading-market-order.spec.ts                  (NEW: 가입→매수→잔고검증)
    trading-limit-cancel.spec.ts                  (NEW: 지정가→취소→잔고복원)

README.md                                         (MODIFY: 진행 상태)
```

각 파일의 책임:
- **Postgres 함수**: 트랜잭션 + 잠금 + 검증을 한 곳에 모음. RLS와 별개로 PG 함수 자체에 권한 체크 (auth.uid()).
- **Next.js API Route**: 인증, 시장시간, 입력 검증 후 `supabase.rpc()` 호출. 비즈니스 로직은 PG 함수가 책임짐.
- **Worker matching_engine**: service_role로 PG 함수 호출. 30분 stale 종목은 매칭 스킵.
- **Web UI**: 미니멀 폼 — Plan #4가 BottomSheet/차트로 대체.

---

## Task 1: 브랜치 + 환경 점검

- [ ] **Step 1: 현재 브랜치 확인**

Run: `git branch --show-current`
Expected: `plan-3-trading-core` (이미 생성되어 있음)

- [ ] **Step 2: 의존성 가동 확인**

```bash
supabase status   # 로컬 가동 중이어야 함
curl -s http://localhost:8080/health   # 워커 (이미 가동 중일 수 있음)
```

워커가 안 떠있으면 `cd apps/worker && PYTHONPATH=src PYTHONUTF8=1 uv run python -m ygworker.main`

---

## Task 2: Migration — holdings 테이블

**Files:**
- Create: `supabase/migrations/20260510020001_holdings.sql`

- [ ] **Step 1: 마이그레이션 작성**

Create `supabase/migrations/20260510020001_holdings.sql`:

```sql
create table public.holdings (
  portfolio_id uuid not null references public.portfolios(id) on delete cascade,
  symbol text not null references public.stocks(symbol),
  quantity numeric(20,4) not null check (quantity > 0),
  avg_cost numeric(20,4) not null check (avg_cost >= 0),  -- 체결 통화 기준
  updated_at timestamptz not null default now(),
  primary key (portfolio_id, symbol)
);

create index holdings_symbol_idx on public.holdings (symbol);

comment on table public.holdings is '포트폴리오별 현재 보유 종목 (수량/평단가)';
```

- [ ] **Step 2: 적용 + 커밋**

```bash
supabase db reset
git add supabase/migrations/20260510020001_holdings.sql
git commit -m "feat(db): add holdings table"
```

---

## Task 3: Migration — orders 테이블

**Files:**
- Create: `supabase/migrations/20260510020002_orders.sql`

- [ ] **Step 1: 마이그레이션 작성**

Create `supabase/migrations/20260510020002_orders.sql`:

```sql
create table public.orders (
  id uuid primary key default gen_random_uuid(),
  portfolio_id uuid not null references public.portfolios(id) on delete cascade,
  symbol text not null references public.stocks(symbol),
  side text not null check (side in ('buy', 'sell')),
  order_type text not null check (order_type in ('market', 'limit')),
  quantity numeric(20,4) not null check (quantity > 0),
  limit_price numeric(20,4),
  status text not null check (status in ('pending', 'filled', 'cancelled', 'rejected', 'expired')),
  filled_quantity numeric(20,4) not null default 0,
  filled_avg_price numeric(20,4),
  fee_total numeric(20,4) not null default 0,
  reserved_amount numeric(20,4),     -- 지정가 주문 시 잔고에서 차감한 액수 (취소/체결 시 환원)
  reserved_currency text check (reserved_currency in ('KRW', 'USD')),
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  filled_at timestamptz,
  cancelled_at timestamptz,
  rejection_reason text
);

create index orders_portfolio_idx on public.orders (portfolio_id, created_at desc);
create index orders_pending_idx on public.orders (status, expires_at)
  where status = 'pending';
create index orders_symbol_pending_idx on public.orders (symbol, status)
  where status = 'pending';

-- 지정가 주문은 limit_price 필수
alter table public.orders add constraint orders_limit_has_price check (
  order_type <> 'limit' or limit_price is not null
);

comment on table public.orders is '주문 (시장가/지정가). 매칭 엔진이 펜딩을 1분마다 처리';
```

- [ ] **Step 2: 적용 + 커밋**

```bash
supabase db reset
git add supabase/migrations/20260510020002_orders.sql
git commit -m "feat(db): add orders table with reserved balance tracking"
```

---

## Task 4: Migration — trades 테이블

**Files:**
- Create: `supabase/migrations/20260510020003_trades.sql`

- [ ] **Step 1: 마이그레이션 작성**

Create `supabase/migrations/20260510020003_trades.sql`:

```sql
create table public.trades (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  portfolio_id uuid not null references public.portfolios(id) on delete cascade,
  symbol text not null references public.stocks(symbol),
  side text not null check (side in ('buy', 'sell')),
  quantity numeric(20,4) not null check (quantity > 0),
  price numeric(20,4) not null check (price > 0),
  currency text not null check (currency in ('KRW', 'USD')),
  fee numeric(20,4) not null default 0,
  executed_at timestamptz not null default now()
);

create index trades_portfolio_idx on public.trades (portfolio_id, executed_at desc);
create index trades_order_idx on public.trades (order_id);

comment on table public.trades is '체결 기록 (감사용). 한 주문에 여러 체결 가능 (현재 v1은 1:1)';
```

- [ ] **Step 2: 커밋**

```bash
supabase db reset
git add supabase/migrations/20260510020003_trades.sql
git commit -m "feat(db): add trades table"
```

---

## Task 5: Migration — fx_transactions 테이블

**Files:**
- Create: `supabase/migrations/20260510020004_fx_transactions.sql`

- [ ] **Step 1: 마이그레이션 작성**

Create `supabase/migrations/20260510020004_fx_transactions.sql`:

```sql
create table public.fx_transactions (
  id uuid primary key default gen_random_uuid(),
  portfolio_id uuid not null references public.portfolios(id) on delete cascade,
  from_currency text not null check (from_currency in ('KRW', 'USD')),
  to_currency text not null check (to_currency in ('KRW', 'USD')),
  from_amount numeric(20,4) not null check (from_amount > 0),
  to_amount numeric(20,4) not null check (to_amount > 0),
  rate numeric(20,8) not null check (rate > 0),
  fee_pct numeric(8,4) not null,
  executed_at timestamptz not null default now(),
  check (from_currency <> to_currency)
);

create index fx_transactions_portfolio_idx on public.fx_transactions (portfolio_id, executed_at desc);

comment on table public.fx_transactions is '환전 내역 (KRW↔USD)';
```

- [ ] **Step 2: 커밋**

```bash
supabase db reset
git add supabase/migrations/20260510020004_fx_transactions.sql
git commit -m "feat(db): add fx_transactions table"
```

---

## Task 6: Migration — RLS 정책

**Files:**
- Create: `supabase/migrations/20260510020005_trading_rls.sql`

- [ ] **Step 1: 마이그레이션 작성**

Create `supabase/migrations/20260510020005_trading_rls.sql`:

```sql
-- holdings: 본인 + 같은 방 멤버 읽기 (방 멤버는 Plan #5에서 추가). 쓰기는 서버만.
alter table public.holdings enable row level security;

create policy "holdings: 본인 읽기"
  on public.holdings for select
  to authenticated
  using (
    portfolio_id in (select id from public.portfolios where user_id = auth.uid())
  );

-- orders: 본인만 읽기. INSERT는 PG 함수(security definer)가 처리.
alter table public.orders enable row level security;

create policy "orders: 본인 읽기"
  on public.orders for select
  to authenticated
  using (
    portfolio_id in (select id from public.portfolios where user_id = auth.uid())
  );

-- trades: 본인 + (방 멤버는 Plan #5)
alter table public.trades enable row level security;

create policy "trades: 본인 읽기"
  on public.trades for select
  to authenticated
  using (
    portfolio_id in (select id from public.portfolios where user_id = auth.uid())
  );

-- fx_transactions: 본인만
alter table public.fx_transactions enable row level security;

create policy "fx_transactions: 본인 읽기"
  on public.fx_transactions for select
  to authenticated
  using (
    portfolio_id in (select id from public.portfolios where user_id = auth.uid())
  );
```

- [ ] **Step 2: 커밋**

```bash
supabase db reset
git add supabase/migrations/20260510020005_trading_rls.sql
git commit -m "feat(db): add RLS for holdings/orders/trades/fx_transactions"
```

---

## Task 7: Migration — `place_market_order` 함수

**Files:**
- Create: `supabase/migrations/20260510020006_fn_place_market_order.sql`

이 함수는 시장가 주문을 단일 트랜잭션에서 처리한다:
1. 포트폴리오 소유 검증 (auth.uid()와 일치)
2. 종목 + 가격 조회 (stocks)
3. 가격 stale 체크 (30분 초과면 거부)
4. 통화 매칭 검증
5. 잔고/보유 검증
6. 수수료 계산
7. orders + trades + holdings + portfolios 갱신
8. order_id, filled_avg_price, fee 반환

- [ ] **Step 1: 마이그레이션 작성**

Create `supabase/migrations/20260510020006_fn_place_market_order.sql`:

```sql
-- 시뮬 수수료율 (spec §4.4)
-- KR buy 0.015%, KR sell 0.215%, US buy 0.05%, US sell 0.05%
create or replace function public._calc_fee_rate(
  p_market text, p_side text
) returns numeric
language sql
immutable
as $$
  select case
    when p_market like 'KRX_%' and p_side = 'buy' then 0.00015
    when p_market like 'KRX_%' and p_side = 'sell' then 0.00215
    when p_market in ('NASDAQ', 'NYSE') then 0.0005
    else 0.0005  -- 기본
  end;
$$;

create or replace function public.place_market_order(
  p_portfolio_id uuid,
  p_symbol text,
  p_side text,
  p_quantity numeric
) returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_currency text;
  v_market text;
  v_price numeric;
  v_price_at timestamptz;
  v_balance numeric;
  v_holding numeric;
  v_holding_avg numeric;
  v_fee_rate numeric;
  v_gross numeric;
  v_fee numeric;
  v_net numeric;
  v_order_id uuid;
  v_new_qty numeric;
  v_new_avg numeric;
begin
  -- 1) 포트폴리오 소유권 + 활성 상태
  select user_id into v_user_id
  from portfolios where id = p_portfolio_id and status = 'active'
  for update;
  if v_user_id is null then
    raise exception 'portfolio_not_found_or_ended';
  end if;
  if v_user_id <> auth.uid() then
    raise exception 'unauthorized';
  end if;

  -- 2) 종목 + 가격
  select currency, market, last_price, last_price_at
  into v_currency, v_market, v_price, v_price_at
  from stocks where symbol = p_symbol and is_active;
  if not found then
    raise exception 'stock_not_found';
  end if;
  if v_price is null then
    raise exception 'price_not_available';
  end if;

  -- 3) Stale 체크 (30분 초과)
  if v_price_at < now() - interval '30 minutes' then
    raise exception 'price_stale';
  end if;

  -- 4) 수량/사이드 검증
  if p_side not in ('buy', 'sell') then
    raise exception 'invalid_side';
  end if;
  if p_quantity <= 0 then
    raise exception 'invalid_quantity';
  end if;

  v_fee_rate := _calc_fee_rate(v_market, p_side);
  v_gross := p_quantity * v_price;
  v_fee := v_gross * v_fee_rate;

  if p_side = 'buy' then
    v_net := v_gross + v_fee;
    -- 잔고 체크
    if v_currency = 'KRW' then
      select krw_balance into v_balance from portfolios where id = p_portfolio_id;
    else
      select usd_balance into v_balance from portfolios where id = p_portfolio_id;
    end if;
    if v_balance < v_net then
      raise exception 'insufficient_balance';
    end if;

    -- 잔고 차감
    if v_currency = 'KRW' then
      update portfolios set krw_balance = krw_balance - v_net where id = p_portfolio_id;
    else
      update portfolios set usd_balance = usd_balance - v_net where id = p_portfolio_id;
    end if;

    -- holdings UPSERT (가중평균)
    select quantity, avg_cost into v_holding, v_holding_avg
    from holdings where portfolio_id = p_portfolio_id and symbol = p_symbol
    for update;

    if v_holding is null then
      insert into holdings (portfolio_id, symbol, quantity, avg_cost)
      values (p_portfolio_id, p_symbol, p_quantity, v_price);
    else
      v_new_qty := v_holding + p_quantity;
      v_new_avg := (v_holding * v_holding_avg + p_quantity * v_price) / v_new_qty;
      update holdings
      set quantity = v_new_qty, avg_cost = v_new_avg, updated_at = now()
      where portfolio_id = p_portfolio_id and symbol = p_symbol;
    end if;

  else  -- sell
    v_net := v_gross - v_fee;
    -- 보유 체크
    select quantity into v_holding
    from holdings where portfolio_id = p_portfolio_id and symbol = p_symbol
    for update;
    if v_holding is null or v_holding < p_quantity then
      raise exception 'insufficient_holdings';
    end if;

    -- holdings 감소 또는 삭제
    if v_holding = p_quantity then
      delete from holdings where portfolio_id = p_portfolio_id and symbol = p_symbol;
    else
      update holdings
      set quantity = quantity - p_quantity, updated_at = now()
      where portfolio_id = p_portfolio_id and symbol = p_symbol;
    end if;

    -- 잔고 증가
    if v_currency = 'KRW' then
      update portfolios set krw_balance = krw_balance + v_net where id = p_portfolio_id;
    else
      update portfolios set usd_balance = usd_balance + v_net where id = p_portfolio_id;
    end if;
  end if;

  -- 5) orders + trades INSERT
  insert into orders (
    portfolio_id, symbol, side, order_type, quantity,
    status, filled_quantity, filled_avg_price, fee_total, filled_at
  ) values (
    p_portfolio_id, p_symbol, p_side, 'market', p_quantity,
    'filled', p_quantity, v_price, v_fee, now()
  ) returning id into v_order_id;

  insert into trades (
    order_id, portfolio_id, symbol, side, quantity, price, currency, fee
  ) values (
    v_order_id, p_portfolio_id, p_symbol, p_side, p_quantity, v_price, v_currency, v_fee
  );

  return json_build_object(
    'order_id', v_order_id,
    'filled_avg_price', v_price,
    'fee', v_fee,
    'currency', v_currency
  );
end;
$$;

revoke all on function place_market_order(uuid, text, text, numeric) from public;
grant execute on function place_market_order(uuid, text, text, numeric) to authenticated;
```

- [ ] **Step 2: 커밋**

```bash
supabase db reset
git add supabase/migrations/20260510020006_fn_place_market_order.sql
git commit -m "feat(db): add place_market_order function (atomic + auth check + fee)"
```

---

## Task 8: Migration — `place_limit_order` 함수

**Files:**
- Create: `supabase/migrations/20260510020007_fn_place_limit_order.sql`

지정가 주문은:
1. 잔고 즉시 차감 (예약, reserved_amount + reserved_currency 기록)
2. 매도면 보유 자체는 그대로 (체결 시 차감 — 또는 즉시 잠금? v1은 단순화로 체결 시 차감)
3. orders 행 status='pending', expires_at = now + 30d
4. 매칭은 워커가 처리

- [ ] **Step 1: 마이그레이션 작성**

Create `supabase/migrations/20260510020007_fn_place_limit_order.sql`:

```sql
create or replace function public.place_limit_order(
  p_portfolio_id uuid,
  p_symbol text,
  p_side text,
  p_quantity numeric,
  p_limit_price numeric
) returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_currency text;
  v_market text;
  v_balance numeric;
  v_holding numeric;
  v_fee_rate numeric;
  v_reserved numeric;
  v_order_id uuid;
begin
  -- 1) 권한
  select user_id into v_user_id
  from portfolios where id = p_portfolio_id and status = 'active'
  for update;
  if v_user_id is null then
    raise exception 'portfolio_not_found_or_ended';
  end if;
  if v_user_id <> auth.uid() then
    raise exception 'unauthorized';
  end if;

  -- 2) 종목
  select currency, market into v_currency, v_market
  from stocks where symbol = p_symbol and is_active;
  if not found then
    raise exception 'stock_not_found';
  end if;

  -- 3) 검증
  if p_side not in ('buy', 'sell') then
    raise exception 'invalid_side';
  end if;
  if p_quantity <= 0 or p_limit_price <= 0 then
    raise exception 'invalid_input';
  end if;

  v_fee_rate := _calc_fee_rate(v_market, p_side);

  if p_side = 'buy' then
    -- 매수 예약: limit_price 기준 + 최대 수수료를 잔고에서 차감
    v_reserved := p_quantity * p_limit_price * (1 + v_fee_rate);
    if v_currency = 'KRW' then
      select krw_balance into v_balance from portfolios where id = p_portfolio_id;
      if v_balance < v_reserved then
        raise exception 'insufficient_balance';
      end if;
      update portfolios set krw_balance = krw_balance - v_reserved where id = p_portfolio_id;
    else
      select usd_balance into v_balance from portfolios where id = p_portfolio_id;
      if v_balance < v_reserved then
        raise exception 'insufficient_balance';
      end if;
      update portfolios set usd_balance = usd_balance - v_reserved where id = p_portfolio_id;
    end if;
  else
    -- 매도 예약: 보유 충분한지 확인 (실제 차감은 체결 시 — 단, 동시 주문 보호 위해 체크만)
    select quantity into v_holding
    from holdings where portfolio_id = p_portfolio_id and symbol = p_symbol
    for update;
    if v_holding is null then
      raise exception 'insufficient_holdings';
    end if;

    -- 같은 심볼의 펜딩 매도 주문 수량 합 + 이번 주문 수량 ≤ 보유량
    -- for update: 동일 portfolio+symbol에 동시 매도 주문이 들어와도 안전
    declare
      v_pending_sell numeric;
    begin
      select coalesce(sum(quantity), 0) into v_pending_sell
      from orders
      where portfolio_id = p_portfolio_id and symbol = p_symbol
        and side = 'sell' and order_type = 'limit' and status = 'pending'
      for update;
      if v_holding < v_pending_sell + p_quantity then
        raise exception 'insufficient_holdings';
      end if;
    end;
    v_reserved := 0;  -- 매도는 잔고 차감 X
  end if;

  -- 4) orders INSERT (pending)
  insert into orders (
    portfolio_id, symbol, side, order_type, quantity, limit_price,
    status, reserved_amount, reserved_currency, expires_at
  ) values (
    p_portfolio_id, p_symbol, p_side, 'limit', p_quantity, p_limit_price,
    'pending',
    case when p_side = 'buy' then v_reserved else null end,
    case when p_side = 'buy' then v_currency else null end,
    now() + interval '30 days'
  ) returning id into v_order_id;

  return json_build_object(
    'order_id', v_order_id,
    'reserved_amount', v_reserved,
    'reserved_currency', case when p_side = 'buy' then v_currency else null end
  );
end;
$$;

revoke all on function place_limit_order(uuid, text, text, numeric, numeric) from public;
grant execute on function place_limit_order(uuid, text, text, numeric, numeric) to authenticated;
```

- [ ] **Step 2: 커밋**

```bash
supabase db reset
git add supabase/migrations/20260510020007_fn_place_limit_order.sql
git commit -m "feat(db): add place_limit_order function with balance reservation"
```

---

## Task 9: Migration — `cancel_order` 함수

**Files:**
- Create: `supabase/migrations/20260510020008_fn_cancel_order.sql`

펜딩 지정가 주문을 취소하고 매수면 예약된 잔고를 환원.

- [ ] **Step 1: 마이그레이션 작성**

Create `supabase/migrations/20260510020008_fn_cancel_order.sql`:

```sql
create or replace function public.cancel_order(p_order_id uuid)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_portfolio_id uuid;
  v_status text;
  v_side text;
  v_reserved numeric;
  v_reserved_ccy text;
begin
  select o.portfolio_id, o.status, o.side, o.reserved_amount, o.reserved_currency, p.user_id
  into v_portfolio_id, v_status, v_side, v_reserved, v_reserved_ccy, v_user_id
  from orders o
  join portfolios p on p.id = o.portfolio_id
  where o.id = p_order_id
  for update;

  if not found then
    raise exception 'order_not_found';
  end if;
  if v_user_id <> auth.uid() then
    raise exception 'unauthorized';
  end if;
  if v_status <> 'pending' then
    raise exception 'order_not_pending';
  end if;

  -- 잔고 환원 (매수만)
  if v_side = 'buy' and v_reserved is not null and v_reserved > 0 then
    if v_reserved_ccy = 'KRW' then
      update portfolios set krw_balance = krw_balance + v_reserved
      where id = v_portfolio_id;
    else
      update portfolios set usd_balance = usd_balance + v_reserved
      where id = v_portfolio_id;
    end if;
  end if;

  update orders
  set status = 'cancelled', cancelled_at = now()
  where id = p_order_id;

  return json_build_object('order_id', p_order_id, 'restored_amount', coalesce(v_reserved, 0));
end;
$$;

revoke all on function cancel_order(uuid) from public;
grant execute on function cancel_order(uuid) to authenticated;
```

- [ ] **Step 2: 커밋**

```bash
supabase db reset
git add supabase/migrations/20260510020008_fn_cancel_order.sql
git commit -m "feat(db): add cancel_order function with balance restoration"
```

---

## Task 10: Migration — `match_limit_order` 함수

**Files:**
- Create: `supabase/migrations/20260510020009_fn_match_limit_order.sql`

워커가 호출. service_role로 실행됨 (auth 검증 안 함).

- [ ] **Step 1: 마이그레이션 작성**

Create `supabase/migrations/20260510020009_fn_match_limit_order.sql`:

```sql
create or replace function public.match_limit_order(p_order_id uuid)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_portfolio_id uuid;
  v_symbol text;
  v_side text;
  v_quantity numeric;
  v_limit_price numeric;
  v_reserved numeric;
  v_reserved_ccy text;
  v_status text;
  v_currency text;
  v_market text;
  v_current_price numeric;
  v_price_at timestamptz;
  v_should_fill boolean := false;
  v_fee_rate numeric;
  v_gross numeric;
  v_fee numeric;
  v_net numeric;
  v_holding numeric;
  v_holding_avg numeric;
  v_new_qty numeric;
  v_new_avg numeric;
  v_refund numeric;
begin
  -- 1) 주문 잠금
  select portfolio_id, symbol, side, quantity, limit_price, reserved_amount,
         reserved_currency, status
  into v_portfolio_id, v_symbol, v_side, v_quantity, v_limit_price, v_reserved,
       v_reserved_ccy, v_status
  from orders where id = p_order_id for update;

  if not found or v_status <> 'pending' then
    return json_build_object('matched', false, 'reason', 'not_pending');
  end if;

  -- 2) 가격 조회 + stale 체크
  select currency, market, last_price, last_price_at
  into v_currency, v_market, v_current_price, v_price_at
  from stocks where symbol = v_symbol;
  if v_current_price is null then
    return json_build_object('matched', false, 'reason', 'no_price');
  end if;
  if v_price_at < now() - interval '30 minutes' then
    return json_build_object('matched', false, 'reason', 'price_stale');
  end if;

  -- 3) 체결 조건 (보수적: limit_price로 체결)
  if v_side = 'buy' and v_current_price <= v_limit_price then
    v_should_fill := true;
  elsif v_side = 'sell' and v_current_price >= v_limit_price then
    v_should_fill := true;
  end if;

  if not v_should_fill then
    return json_build_object('matched', false, 'reason', 'price_not_reached');
  end if;

  -- 4) 체결 처리 (체결가 = limit_price, 보수적)
  v_fee_rate := _calc_fee_rate(v_market, v_side);
  v_gross := v_quantity * v_limit_price;
  v_fee := v_gross * v_fee_rate;

  if v_side = 'buy' then
    -- 잔고는 이미 차감됨 (place_limit_order에서). 차이 환원.
    v_net := v_gross + v_fee;
    v_refund := coalesce(v_reserved, 0) - v_net;
    if v_refund > 0 then
      if v_reserved_ccy = 'KRW' then
        update portfolios set krw_balance = krw_balance + v_refund
        where id = v_portfolio_id;
      else
        update portfolios set usd_balance = usd_balance + v_refund
        where id = v_portfolio_id;
      end if;
    end if;

    -- holdings UPSERT
    select quantity, avg_cost into v_holding, v_holding_avg
    from holdings where portfolio_id = v_portfolio_id and symbol = v_symbol for update;
    if v_holding is null then
      insert into holdings (portfolio_id, symbol, quantity, avg_cost)
      values (v_portfolio_id, v_symbol, v_quantity, v_limit_price);
    else
      v_new_qty := v_holding + v_quantity;
      v_new_avg := (v_holding * v_holding_avg + v_quantity * v_limit_price) / v_new_qty;
      update holdings
      set quantity = v_new_qty, avg_cost = v_new_avg, updated_at = now()
      where portfolio_id = v_portfolio_id and symbol = v_symbol;
    end if;
  else  -- sell
    v_net := v_gross - v_fee;
    -- 보유 차감
    select quantity into v_holding
    from holdings where portfolio_id = v_portfolio_id and symbol = v_symbol for update;
    if v_holding is null or v_holding < v_quantity then
      -- 분할/매도로 보유가 줄어든 케이스. expire 대신 reject.
      update orders set status = 'rejected', rejection_reason = 'insufficient_holdings_at_match'
      where id = p_order_id;
      return json_build_object('matched', false, 'reason', 'insufficient_holdings');
    end if;
    if v_holding = v_quantity then
      delete from holdings where portfolio_id = v_portfolio_id and symbol = v_symbol;
    else
      update holdings set quantity = quantity - v_quantity, updated_at = now()
      where portfolio_id = v_portfolio_id and symbol = v_symbol;
    end if;
    -- 잔고 증가
    if v_currency = 'KRW' then
      update portfolios set krw_balance = krw_balance + v_net where id = v_portfolio_id;
    else
      update portfolios set usd_balance = usd_balance + v_net where id = v_portfolio_id;
    end if;
  end if;

  -- 5) orders 갱신
  update orders set
    status = 'filled',
    filled_quantity = v_quantity,
    filled_avg_price = v_limit_price,
    fee_total = v_fee,
    filled_at = now()
  where id = p_order_id;

  insert into trades (order_id, portfolio_id, symbol, side, quantity, price, currency, fee)
  values (p_order_id, v_portfolio_id, v_symbol, v_side, v_quantity, v_limit_price, v_currency, v_fee);

  return json_build_object('matched', true, 'price', v_limit_price, 'fee', v_fee);
end;
$$;

-- service_role만 호출 (워커)
revoke all on function match_limit_order(uuid) from public;
grant execute on function match_limit_order(uuid) to service_role;
```

- [ ] **Step 2: 커밋**

```bash
supabase db reset
git add supabase/migrations/20260510020009_fn_match_limit_order.sql
git commit -m "feat(db): add match_limit_order function (worker-only)"
```

---

## Task 11: Migration — `exchange_currency` 함수

**Files:**
- Create: `supabase/migrations/20260510020010_fn_exchange_currency.sql`

KRW↔USD 환전. 0.5% 스프레드.

- [ ] **Step 1: 마이그레이션 작성**

Create `supabase/migrations/20260510020010_fn_exchange_currency.sql`:

```sql
create or replace function public.exchange_currency(
  p_portfolio_id uuid,
  p_from_currency text,
  p_to_currency text,
  p_from_amount numeric
) returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_balance numeric;
  v_rate numeric;
  v_fee_pct numeric := 0.005;  -- 0.5% 스프레드
  v_to_amount numeric;
begin
  -- 1) 권한
  select user_id into v_user_id
  from portfolios where id = p_portfolio_id and status = 'active' for update;
  if v_user_id is null then
    raise exception 'portfolio_not_found_or_ended';
  end if;
  if v_user_id <> auth.uid() then
    raise exception 'unauthorized';
  end if;

  -- 2) 통화 검증
  if p_from_currency not in ('KRW', 'USD') or p_to_currency not in ('KRW', 'USD') then
    raise exception 'invalid_currency';
  end if;
  if p_from_currency = p_to_currency then
    raise exception 'same_currency';
  end if;
  if p_from_amount <= 0 then
    raise exception 'invalid_amount';
  end if;

  -- 3) 최신 환율 (USD/KRW)
  select rate into v_rate
  from fx_rates where base = 'USD' and quote = 'KRW'
  order by ts desc limit 1;
  if v_rate is null then
    raise exception 'fx_rate_unavailable';
  end if;

  -- 4) 잔고 검증
  if p_from_currency = 'KRW' then
    select krw_balance into v_balance from portfolios where id = p_portfolio_id;
    -- KRW → USD: usd_amount = krw / rate / (1 + fee_pct)
    v_to_amount := p_from_amount / v_rate / (1 + v_fee_pct);
  else
    select usd_balance into v_balance from portfolios where id = p_portfolio_id;
    -- USD → KRW: krw_amount = usd * rate * (1 - fee_pct)
    v_to_amount := p_from_amount * v_rate * (1 - v_fee_pct);
  end if;
  if v_balance < p_from_amount then
    raise exception 'insufficient_balance';
  end if;

  -- 5) 잔고 갱신
  if p_from_currency = 'KRW' then
    update portfolios
    set krw_balance = krw_balance - p_from_amount,
        usd_balance = usd_balance + v_to_amount
    where id = p_portfolio_id;
  else
    update portfolios
    set usd_balance = usd_balance - p_from_amount,
        krw_balance = krw_balance + v_to_amount
    where id = p_portfolio_id;
  end if;

  -- 6) 내역 기록
  insert into fx_transactions (
    portfolio_id, from_currency, to_currency, from_amount, to_amount, rate, fee_pct
  ) values (
    p_portfolio_id, p_from_currency, p_to_currency, p_from_amount, v_to_amount, v_rate, v_fee_pct
  );

  return json_build_object(
    'from_amount', p_from_amount,
    'to_amount', v_to_amount,
    'rate', v_rate,
    'fee_pct', v_fee_pct
  );
end;
$$;

revoke all on function exchange_currency(uuid, text, text, numeric) from public;
grant execute on function exchange_currency(uuid, text, text, numeric) to authenticated;
```

- [ ] **Step 2: 커밋**

```bash
supabase db reset
git add supabase/migrations/20260510020010_fn_exchange_currency.sql
git commit -m "feat(db): add exchange_currency function (KRW↔USD with 0.5% spread)"
```

---

## Task 11.5: Migration — `expire_pending_order` 함수

**Files:**
- Create: `supabase/migrations/20260510020011_fn_expire_pending_order.sql`

워커가 호출. 만료된 펜딩 주문을 expired 상태로 전환 + 매수면 reserved 환원. service_role 전용.

- [ ] **Step 1: 마이그레이션 작성**

Create `supabase/migrations/20260510020011_fn_expire_pending_order.sql`:

```sql
create or replace function public.expire_pending_order(p_order_id uuid)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_portfolio_id uuid;
  v_status text;
  v_side text;
  v_reserved numeric;
  v_reserved_ccy text;
  v_expires_at timestamptz;
begin
  select portfolio_id, status, side, reserved_amount, reserved_currency, expires_at
  into v_portfolio_id, v_status, v_side, v_reserved, v_reserved_ccy, v_expires_at
  from orders where id = p_order_id for update;

  if not found then
    raise exception 'order_not_found';
  end if;
  if v_status <> 'pending' then
    return json_build_object('expired', false, 'reason', 'not_pending');
  end if;
  if v_expires_at is null or v_expires_at >= now() then
    return json_build_object('expired', false, 'reason', 'not_yet_expired');
  end if;

  -- 잔고 환원 (매수만)
  if v_side = 'buy' and v_reserved is not null and v_reserved > 0 then
    if v_reserved_ccy = 'KRW' then
      update portfolios set krw_balance = krw_balance + v_reserved
      where id = v_portfolio_id;
    else
      update portfolios set usd_balance = usd_balance + v_reserved
      where id = v_portfolio_id;
    end if;
  end if;

  update orders set status = 'expired' where id = p_order_id;
  return json_build_object('expired', true, 'restored_amount', coalesce(v_reserved, 0));
end;
$$;

revoke all on function expire_pending_order(uuid) from public;
grant execute on function expire_pending_order(uuid) to service_role;
```

- [ ] **Step 2: 커밋**

```bash
supabase db reset
git add supabase/migrations/20260510020011_fn_expire_pending_order.sql
git commit -m "feat(db): add expire_pending_order function (worker-only, restores reserved)"
```

---

## Task 12: Worker — matching_engine 잡 (TDD)

**Files:**
- Create: `apps/worker/src/ygworker/jobs/matching_engine.py`
- Create: `apps/worker/tests/test_jobs_matching_engine.py`

- [ ] **Step 1: 실패 테스트 작성**

Create `apps/worker/tests/test_jobs_matching_engine.py`:

```python
from unittest.mock import MagicMock

from ygworker.jobs.matching_engine import run_matching_engine


def _pending_order(id_: str, symbol: str = "AAPL"):
    return {"id": id_, "symbol": symbol}


def test_matching_engine_calls_match_for_each_pending():
    fake = MagicMock()
    fake.table.return_value.select.return_value.eq.return_value.execute.return_value.data = [
        _pending_order("o1", "AAPL"),
        _pending_order("o2", "005930.KS"),
    ]
    fake.rpc.return_value.execute.side_effect = [
        MagicMock(data={"matched": True, "price": 158.5}),
        MagicMock(data={"matched": False, "reason": "price_not_reached"}),
    ]
    logger = MagicMock()

    run_matching_engine(fake, logger)

    rpc_calls = fake.rpc.call_args_list
    assert len(rpc_calls) == 2
    # 각 호출이 match_limit_order에 order_id 전달
    payload = rpc_calls[0].args[1] if len(rpc_calls[0].args) > 1 else rpc_calls[0].kwargs
    assert payload == {"p_order_id": "o1"}


def test_matching_engine_handles_no_pending():
    fake = MagicMock()
    fake.table.return_value.select.return_value.eq.return_value.execute.return_value.data = []
    logger = MagicMock()

    run_matching_engine(fake, logger)

    fake.rpc.assert_not_called()
    logger.info.assert_called_with("matching_engine.skip", reason="no_pending")


def test_matching_engine_continues_on_rpc_error():
    fake = MagicMock()
    fake.table.return_value.select.return_value.eq.return_value.execute.return_value.data = [
        _pending_order("o1"),
        _pending_order("o2"),
    ]
    fake.rpc.return_value.execute.side_effect = [
        RuntimeError("DB connection lost"),
        MagicMock(data={"matched": True}),
    ]
    logger = MagicMock()

    run_matching_engine(fake, logger)

    # 두 번째 주문은 호출됨 (예외에 멈추지 않음)
    assert fake.rpc.call_count == 2
    logger.error.assert_called()
```

- [ ] **Step 2: 실패 확인 + 구현**

Create `apps/worker/src/ygworker/jobs/matching_engine.py`:

```python
from datetime import UTC, datetime
from typing import Any


def run_matching_engine(supabase: Any, logger: Any) -> None:
    """Pending 지정가 주문을 한 번씩 match_limit_order로 처리 + 만료 주문 정리.

    1) expires_at < now() 인 pending 주문 → cancel_order(service_role)로 만료 처리
    2) 남은 pending 주문에 match_limit_order 호출 — 가격 도달 시 체결
    """
    now_iso = datetime.now(UTC).isoformat()

    # 1) 만료된 주문 자동 취소 (잔고 환원)
    expired = (
        supabase.table("orders")
        .select("id")
        .eq("status", "pending")
        .lt("expires_at", now_iso)
        .execute()
        .data
    )
    expired_count = 0
    for row in expired or []:
        try:
            # service_role로 cancel_order 호출 — auth.uid() 체크 우회되지만
            # PG 함수가 owner 검증 ok? 안전하게 직접 SQL update + 환원하는 별도 함수가
            # 더 적합하나, v1은 cancel_order를 service_role로 호출하면
            # auth.uid()가 NULL이라 unauthorized로 실패. 대신 raw update + reserved 환원
            # 을 별도 PG 함수로 처리하거나, service_role 전용 expire 함수를 호출.
            # 단순화: status만 'expired'로 표시하고 reserved 환원은 별도 처리.
            supabase.rpc("expire_pending_order", {"p_order_id": row["id"]}).execute()
            expired_count += 1
        except Exception as exc:
            logger.error(
                "matching_engine.expire_failed", order_id=row["id"], error=str(exc)
            )

    # 2) 매칭 시도
    rows = (
        supabase.table("orders")
        .select("id, symbol")
        .eq("status", "pending")
        .execute()
        .data
    )
    if not rows:
        if expired_count == 0:
            logger.info("matching_engine.skip", reason="no_pending")
        else:
            logger.info("matching_engine.done", matched=0, skipped=0, errored=0, expired=expired_count)
        return

    logger.info("matching_engine.start", count=len(rows), expired=expired_count)
    matched, skipped, errored = 0, 0, 0

    for row in rows:
        order_id = row["id"]
        try:
            result = (
                supabase.rpc("match_limit_order", {"p_order_id": order_id}).execute()
            )
            data = result.data if hasattr(result, "data") else result
            if data and data.get("matched"):
                matched += 1
            else:
                skipped += 1
        except Exception as exc:
            errored += 1
            logger.error(
                "matching_engine.rpc_failed", order_id=order_id, error=str(exc)
            )

    logger.info(
        "matching_engine.done",
        matched=matched, skipped=skipped, errored=errored, expired=expired_count
    )
```

**추가**: `expire_pending_order`는 service_role 전용 PG 함수로, 다음 Task 12.5에서 정의.

- [ ] **Step 3: 테스트 통과 + 커밋**

```bash
cd apps/worker && uv run pytest tests/test_jobs_matching_engine.py -v
git add apps/worker/src/ygworker/jobs/matching_engine.py apps/worker/tests/test_jobs_matching_engine.py
git commit -m "feat(worker): add matching_engine job (calls match_limit_order RPC)"
```

---

## Task 13: Worker main.py — matching_engine 스케줄

**Files:**
- Modify: `apps/worker/src/ygworker/main.py`

- [ ] **Step 1: 스케줄러에 매칭 잡 추가**

Edit `apps/worker/src/ygworker/main.py`. Imports 영역에 추가:

```python
from ygworker.jobs.matching_engine import run_matching_engine
```

`scheduler.add_job(...)` 묶음 끝에 추가:

```python
    scheduler.add_job(
        _wrap_in_thread(run_matching_engine, supabase, logger),
        trigger="interval",
        seconds=60,
        id="matching_engine",
        replace_existing=True,
    )
```

- [ ] **Step 2: 빌드 검증 (워커 부팅)**

```bash
cd apps/worker
PYTHONPATH=src PYTHONUTF8=1 uv run python -m ygworker.main
```

기대 로그: `worker.scheduler_started` 후 1분 안에 `matching_engine.skip reason=no_pending` 출력. Ctrl+C.

- [ ] **Step 3: 커밋**

```bash
git add apps/worker/src/ygworker/main.py
git commit -m "feat(worker): integrate matching_engine into AsyncIOScheduler"
```

---

## Task 14: PG 함수 통합 테스트 (트레이딩 시나리오)

**Files:**
- Create: `apps/worker/tests/test_trading_functions.py`

Plan #1의 `test_signup_trigger.py`처럼 **로컬 Supabase에 실제 호출**하는 통합 테스트.

- [ ] **Step 1: 테스트 작성**

Create `apps/worker/tests/test_trading_functions.py`:

```python
"""Plan #3 PG 함수 통합 테스트. 로컬 Supabase 가동 중이어야 통과."""

import os
import uuid
from datetime import UTC, datetime, timedelta

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
def cleanup_user(admin):
    user_ids: list[str] = []
    yield user_ids
    for uid in user_ids:
        try:
            admin.auth.admin.delete_user(uid)
        except Exception:
            pass


def _make_user_with_portfolio(admin, cleanup_user) -> tuple[str, str, str]:
    """가입 → 자동 생성된 글로벌 portfolio_id 반환. (user_id, email, portfolio_id)"""
    email = f"trade-{uuid.uuid4()}@test.com"
    res = admin.auth.admin.create_user(
        {"email": email, "password": "TestPass123!", "email_confirm": True}
    )
    user_id = res.user.id
    cleanup_user.append(user_id)
    portfolio = (
        admin.table("portfolios")
        .select("id")
        .eq("user_id", user_id)
        .is_("room_id", "null")
        .single()
        .execute()
        .data
    )
    return user_id, email, portfolio["id"]


def _ensure_stock(admin, symbol: str, currency: str = "USD", market: str = "NASDAQ", price: float = 100.0):
    """테스트용 종목을 stocks에 upsert. last_price_at은 현재 시각."""
    now = datetime.now(UTC).isoformat()
    admin.table("stocks").upsert(
        {
            "symbol": symbol,
            "market": market,
            "currency": currency,
            "name": f"{symbol} Test",
            "last_price": price,
            "last_price_at": now,
            "is_active": True,
        },
        on_conflict="symbol",
    ).execute()


def _user_client(admin, email: str):
    """user JWT로 호출하는 client. password_authentication."""
    url = os.environ["SUPABASE_URL"]
    anon_key = os.environ["SUPABASE_ANON_KEY"]
    user_client = create_client(url, anon_key)
    user_client.auth.sign_in_with_password({"email": email, "password": "TestPass123!"})
    return user_client


def test_market_buy_updates_balance_and_holdings(admin, cleanup_user):
    user_id, email, pid = _make_user_with_portfolio(admin, cleanup_user)
    _ensure_stock(admin, "TEST_AAPL", currency="USD", price=100.0)
    # USD 잔고 채우기 (트리거가 0으로 두므로 직접 조정)
    admin.table("portfolios").update({"usd_balance": 10000}).eq("id", pid).execute()

    user_client = _user_client(admin, email)
    res = user_client.rpc(
        "place_market_order",
        {
            "p_portfolio_id": pid,
            "p_symbol": "TEST_AAPL",
            "p_side": "buy",
            "p_quantity": 10,
        },
    ).execute()
    body = res.data
    assert body["filled_avg_price"] == 100.0
    expected_fee = 10 * 100.0 * 0.0005  # 0.05% US buy
    assert abs(body["fee"] - expected_fee) < 0.01

    portfolio = admin.table("portfolios").select("*").eq("id", pid).single().execute().data
    assert float(portfolio["usd_balance"]) == 10000 - 1000 - expected_fee

    holding = (
        admin.table("holdings")
        .select("*")
        .eq("portfolio_id", pid)
        .eq("symbol", "TEST_AAPL")
        .single()
        .execute()
        .data
    )
    assert float(holding["quantity"]) == 10
    assert float(holding["avg_cost"]) == 100.0


def test_market_buy_rejects_insufficient_balance(admin, cleanup_user):
    _, email, pid = _make_user_with_portfolio(admin, cleanup_user)
    _ensure_stock(admin, "TEST_RICH", currency="USD", price=1_000_000)

    user_client = _user_client(admin, email)
    with pytest.raises(APIError) as exc:
        user_client.rpc(
            "place_market_order",
            {"p_portfolio_id": pid, "p_symbol": "TEST_RICH", "p_side": "buy", "p_quantity": 1},
        ).execute()
    assert "insufficient_balance" in str(exc.value)


def test_market_sell_after_buy_returns_balance(admin, cleanup_user):
    _, email, pid = _make_user_with_portfolio(admin, cleanup_user)
    _ensure_stock(admin, "TEST_SELL", currency="USD", price=50.0)
    admin.table("portfolios").update({"usd_balance": 1000}).eq("id", pid).execute()
    uc = _user_client(admin, email)
    uc.rpc(
        "place_market_order",
        {"p_portfolio_id": pid, "p_symbol": "TEST_SELL", "p_side": "buy", "p_quantity": 5},
    ).execute()

    # Sell 5 at 50 => +250 - 0.05% fee
    uc.rpc(
        "place_market_order",
        {"p_portfolio_id": pid, "p_symbol": "TEST_SELL", "p_side": "sell", "p_quantity": 5},
    ).execute()

    p = admin.table("portfolios").select("*").eq("id", pid).single().execute().data
    # 1000 - 250 - 0.125(buy fee) + 250 - 0.125(sell fee) = 999.75
    assert abs(float(p["usd_balance"]) - 999.75) < 0.01

    holding = (
        admin.table("holdings")
        .select("*")
        .eq("portfolio_id", pid)
        .eq("symbol", "TEST_SELL")
        .execute()
        .data
    )
    assert holding == []


def test_limit_buy_reserves_balance(admin, cleanup_user):
    _, email, pid = _make_user_with_portfolio(admin, cleanup_user)
    _ensure_stock(admin, "TEST_LIM", currency="USD", price=100.0)
    admin.table("portfolios").update({"usd_balance": 10000}).eq("id", pid).execute()

    uc = _user_client(admin, email)
    res = uc.rpc(
        "place_limit_order",
        {
            "p_portfolio_id": pid,
            "p_symbol": "TEST_LIM",
            "p_side": "buy",
            "p_quantity": 10,
            "p_limit_price": 90,
        },
    ).execute()
    reserved = float(res.data["reserved_amount"])
    # 10 * 90 * 1.0005 = 900.45
    assert abs(reserved - 900.45) < 0.01

    p = admin.table("portfolios").select("*").eq("id", pid).single().execute().data
    assert abs(float(p["usd_balance"]) - (10000 - 900.45)) < 0.01

    order = (
        admin.table("orders")
        .select("*")
        .eq("id", res.data["order_id"])
        .single()
        .execute()
        .data
    )
    assert order["status"] == "pending"


def test_cancel_pending_restores_balance(admin, cleanup_user):
    _, email, pid = _make_user_with_portfolio(admin, cleanup_user)
    _ensure_stock(admin, "TEST_CXL", currency="USD", price=100.0)
    admin.table("portfolios").update({"usd_balance": 10000}).eq("id", pid).execute()

    uc = _user_client(admin, email)
    order_id = (
        uc.rpc(
            "place_limit_order",
            {"p_portfolio_id": pid, "p_symbol": "TEST_CXL", "p_side": "buy", "p_quantity": 10, "p_limit_price": 90},
        )
        .execute()
        .data["order_id"]
    )
    uc.rpc("cancel_order", {"p_order_id": order_id}).execute()

    p = admin.table("portfolios").select("*").eq("id", pid).single().execute().data
    assert abs(float(p["usd_balance"]) - 10000) < 0.01
    o = admin.table("orders").select("*").eq("id", order_id).single().execute().data
    assert o["status"] == "cancelled"


def test_match_limit_order_fills_when_price_reaches(admin, cleanup_user):
    _, email, pid = _make_user_with_portfolio(admin, cleanup_user)
    _ensure_stock(admin, "TEST_MATCH", currency="USD", price=100.0)
    admin.table("portfolios").update({"usd_balance": 10000}).eq("id", pid).execute()

    uc = _user_client(admin, email)
    order_id = (
        uc.rpc(
            "place_limit_order",
            {"p_portfolio_id": pid, "p_symbol": "TEST_MATCH", "p_side": "buy", "p_quantity": 10, "p_limit_price": 110},
        )
        .execute()
        .data["order_id"]
    )

    # 현재가 100 ≤ limit 110 → 체결되어야 함
    res = admin.rpc("match_limit_order", {"p_order_id": order_id}).execute()
    assert res.data["matched"] is True

    o = admin.table("orders").select("*").eq("id", order_id).single().execute().data
    assert o["status"] == "filled"


def test_exchange_krw_to_usd(admin, cleanup_user):
    _, email, pid = _make_user_with_portfolio(admin, cleanup_user)
    # FX rate 시드
    admin.table("fx_rates").insert(
        {"base": "USD", "quote": "KRW", "rate": 1400, "ts": datetime.now(UTC).isoformat()}
    ).execute()

    uc = _user_client(admin, email)
    res = uc.rpc(
        "exchange_currency",
        {"p_portfolio_id": pid, "p_from_currency": "KRW", "p_to_currency": "USD", "p_from_amount": 1_400_000},
    ).execute()
    body = res.data
    # 1,400,000 / 1400 / 1.005 = 994.03...
    assert abs(float(body["to_amount"]) - 994.03) < 0.5

    p = admin.table("portfolios").select("*").eq("id", pid).single().execute().data
    assert abs(float(p["krw_balance"]) - (100_000_000 - 1_400_000)) < 0.01
    assert float(p["usd_balance"]) > 990
```

- [ ] **Step 2: ANON_KEY 환경변수 추가**

`apps/worker/.env.example`에 추가:
```
# 통합 테스트용. supabase status의 "Publishable" 또는 (구버전 CLI에서) "anon key" 값.
# 신버전 CLI: sb_publishable_xxx... / 구버전: eyJhbGc... (JWT)
# 둘 다 동일한 anon role 권한이라 supabase-py에서 호환.
SUPABASE_ANON_KEY=<from `supabase status` line "Publishable" or "anon key">
```

`apps/worker/.env`에도 실제 값 추가:
```bash
supabase status   # Publishable 라인 복사
```

- [ ] **Step 3: 테스트 실행**

```bash
cd apps/worker && uv run pytest tests/test_trading_functions.py -v
```
Expected: 7 PASS

⚠️ 모든 마이그레이션이 적용된 상태여야 함 (`supabase db reset` 후).

- [ ] **Step 4: 커밋**

```bash
git add apps/worker/tests/test_trading_functions.py apps/worker/.env.example
git commit -m "test(db): integration tests for 5 trading PG functions (7 scenarios)"
```

---

## Task 15: Web — market_hours 클라이언트 유틸

**Files:**
- Create: `apps/web/lib/market-hours.ts`

서버측에서도 사용하므로 의존성 없는 순수 TS.

- [ ] **Step 1: 작성**

Create `apps/web/lib/market-hours.ts`:

```typescript
// KR/US 장 운영 시간 판정. spec §6.3 기준.
// 휴장일 정확도는 워커의 pandas-market-calendars가 더 정확하지만
// 클라이언트/서버 즉시 판정이 필요해 간단한 요일 기반 체크.

export type MarketEnum = "KRX_KS" | "KRX_KQ" | "NASDAQ" | "NYSE";

const KR_OPEN_HOUR = 9;
const KR_CLOSE_HOUR = 15;
const KR_CLOSE_MIN = 30;

export function isKrOpenAt(date: Date): boolean {
  // KST = UTC+9
  const kst = new Date(date.getTime() + 9 * 60 * 60 * 1000);
  const day = kst.getUTCDay(); // 0=일, 6=토
  if (day === 0 || day === 6) return false;
  const h = kst.getUTCHours();
  const m = kst.getUTCMinutes();
  if (h < KR_OPEN_HOUR) return false;
  if (h > KR_CLOSE_HOUR) return false;
  if (h === KR_CLOSE_HOUR && m > KR_CLOSE_MIN) return false;
  return true;
}

export function isUsOpenAt(date: Date): boolean {
  // US ET = UTC-5(표준시) 또는 UTC-4(서머타임). 단순화: 한 해 대부분이 서머타임이므로 -4 근사.
  // 정확도 필요 시 Intl.DateTimeFormat with timeZone='America/New_York' 사용 가능.
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
  // 09:30 ≤ time ≤ 15:59 (16:00 close)
  const total = hour * 60 + minute;
  return total >= 9 * 60 + 30 && total < 16 * 60;
}

export function isMarketOpenForSymbol(market: MarketEnum, when: Date = new Date()): boolean {
  if (market === "KRX_KS" || market === "KRX_KQ") return isKrOpenAt(when);
  if (market === "NASDAQ" || market === "NYSE") return isUsOpenAt(when);
  return false;
}
```

- [ ] **Step 2: 커밋**

```bash
git add apps/web/lib/market-hours.ts
git commit -m "feat(web): add market-hours utility (KR + US, no deps)"
```

---

## Task 16: Web — POST /api/orders + GET /api/orders

**Files:**
- Create: `apps/web/app/api/orders/route.ts`

- [ ] **Step 1: 작성**

Create `apps/web/app/api/orders/route.ts`:

```typescript
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isMarketOpenForSymbol, type MarketEnum } from "@/lib/market-hours";

type OrderBody = {
  portfolio_id: string;
  symbol: string;
  side: "buy" | "sell";
  type: "market" | "limit";
  quantity: number;
  limit_price?: number;
};

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  const body = (await request.json().catch(() => ({}))) as Partial<OrderBody>;
  const { portfolio_id, symbol, side, type, quantity, limit_price } = body;
  if (!portfolio_id || !symbol || !side || !type || !quantity) {
    return NextResponse.json({ error: "invalid_input" }, { status: 400 });
  }
  if (type === "limit" && (limit_price == null || limit_price <= 0)) {
    return NextResponse.json({ error: "limit_price_required" }, { status: 400 });
  }

  // 시장가는 장중에만
  if (type === "market") {
    const { data: stock } = await supabase
      .from("stocks")
      .select("market")
      .eq("symbol", symbol)
      .single();
    if (!stock) return NextResponse.json({ error: "stock_not_found" }, { status: 404 });
    if (!isMarketOpenForSymbol(stock.market as MarketEnum)) {
      return NextResponse.json({ error: "market_closed" }, { status: 422 });
    }
  }

  const fnName = type === "market" ? "place_market_order" : "place_limit_order";
  const params: Record<string, unknown> = {
    p_portfolio_id: portfolio_id,
    p_symbol: symbol,
    p_side: side,
    p_quantity: quantity,
  };
  if (type === "limit") params.p_limit_price = limit_price;

  const { data, error } = await supabase.rpc(fnName, params);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: mapErrorStatus(error.message) });
  }
  return NextResponse.json(data);
}

export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const portfolio_id = searchParams.get("portfolio_id");
  const status = searchParams.get("status");

  let query = supabase.from("orders").select("*").order("created_at", { ascending: false }).limit(100);
  if (portfolio_id) query = query.eq("portfolio_id", portfolio_id);
  if (status) query = query.eq("status", status);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ orders: data });
}

function mapErrorStatus(msg: string): number {
  if (msg.includes("unauthorized") || msg.includes("unauthenticated")) return 401;
  if (msg.includes("not_found")) return 404;
  // spec §10.1: 503으로 매핑하여 사용자에게 "재시도" 토스트 안내
  if (msg.includes("price_stale")) return 503;
  if (
    msg.includes("insufficient") ||
    msg.includes("invalid_") ||
    msg.includes("market_closed")
  )
    return 422;
  return 500;
}
```

- [ ] **Step 2: 커밋**

```bash
git add apps/web/app/api/orders/route.ts
git commit -m "feat(web): POST/GET /api/orders (market+limit dispatch, market hours guard)"
```

---

## Task 17: Web — DELETE /api/orders/:id

**Files:**
- Create: `apps/web/app/api/orders/[id]/route.ts`

- [ ] **Step 1: 작성**

Create `apps/web/app/api/orders/[id]/route.ts`:

```typescript
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  const { data, error } = await supabase.rpc("cancel_order", { p_order_id: id });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 422 });
  }
  return NextResponse.json(data);
}
```

- [ ] **Step 2: 커밋**

```bash
git add apps/web/app/api/orders/[id]/route.ts
git commit -m "feat(web): DELETE /api/orders/:id (cancel pending limit)"
```

---

## Task 18: Web — POST /api/fx/exchange + GET /api/fx/transactions

**Files:**
- Create: `apps/web/app/api/fx/exchange/route.ts`
- Create: `apps/web/app/api/fx/transactions/route.ts`

- [ ] **Step 1: 환전 라우트**

Create `apps/web/app/api/fx/exchange/route.ts`:

```typescript
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const { portfolio_id, from_currency, to_currency, from_amount } = body;
  if (!portfolio_id || !from_currency || !to_currency || !from_amount) {
    return NextResponse.json({ error: "invalid_input" }, { status: 400 });
  }

  const { data, error } = await supabase.rpc("exchange_currency", {
    p_portfolio_id: portfolio_id,
    p_from_currency: from_currency,
    p_to_currency: to_currency,
    p_from_amount: from_amount,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 422 });
  return NextResponse.json(data);
}
```

- [ ] **Step 2: 내역 라우트**

Create `apps/web/app/api/fx/transactions/route.ts`:

```typescript
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const portfolio_id = searchParams.get("portfolio_id");
  let q = supabase.from("fx_transactions").select("*").order("executed_at", { ascending: false }).limit(50);
  if (portfolio_id) q = q.eq("portfolio_id", portfolio_id);

  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ transactions: data });
}
```

- [ ] **Step 3: 커밋**

```bash
git add apps/web/app/api/fx/
git commit -m "feat(web): POST /api/fx/exchange + GET /api/fx/transactions"
```

---

## Task 19: Web — GET /api/holdings + GET /api/trades

**Files:**
- Create: `apps/web/app/api/holdings/route.ts`
- Create: `apps/web/app/api/trades/route.ts`

- [ ] **Step 1: holdings**

Create `apps/web/app/api/holdings/route.ts`:

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
    .from("holdings")
    .select("portfolio_id, symbol, quantity, avg_cost, updated_at, stocks(name, name_ko, currency, market, last_price)");
  if (portfolio_id) q = q.eq("portfolio_id", portfolio_id);

  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ holdings: data });
}
```

- [ ] **Step 2: trades**

Create `apps/web/app/api/trades/route.ts`:

```typescript
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const portfolio_id = searchParams.get("portfolio_id");
  let q = supabase.from("trades").select("*").order("executed_at", { ascending: false }).limit(100);
  if (portfolio_id) q = q.eq("portfolio_id", portfolio_id);

  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ trades: data });
}
```

- [ ] **Step 3: 커밋**

```bash
git add apps/web/app/api/holdings apps/web/app/api/trades
git commit -m "feat(web): GET /api/holdings + GET /api/trades"
```

---

## Task 20: Web — order-form 컴포넌트 + 종목 상세 통합

**Files:**
- Create: `apps/web/components/order-form.tsx`
- Modify: `apps/web/app/app/trade/[symbol]/page.tsx`

- [ ] **Step 1: order-form**

Create `apps/web/components/order-form.tsx`:

```tsx
"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";

type Props = {
  portfolioId: string;
  symbol: string;
  currency: string;
  lastPrice: number | null;
};

export function OrderForm({ portfolioId, symbol, currency, lastPrice }: Props) {
  const [side, setSide] = useState<"buy" | "sell">("buy");
  const [type, setType] = useState<"market" | "limit">("market");
  const [quantity, setQuantity] = useState<string>("1");
  const [limitPrice, setLimitPrice] = useState<string>(lastPrice ? String(lastPrice) : "");
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);
    setSubmitting(true);
    const body: Record<string, unknown> = {
      portfolio_id: portfolioId,
      symbol,
      side,
      type,
      quantity: Number(quantity),
    };
    if (type === "limit") body.limit_price = Number(limitPrice);
    const res = await fetch("/api/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    setSubmitting(false);
    if (res.ok) {
      const data = await res.json();
      setMessage({ kind: "ok", text: type === "market" ? `체결됨: ${data.filled_avg_price}` : "주문 접수됨 (대기)" });
    } else {
      const err = await res.json().catch(() => ({}));
      setMessage({ kind: "err", text: err.error ?? "오류 발생" });
    }
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <div className="flex gap-2">
        <Button
          type="button"
          variant={side === "buy" ? "default" : "outline"}
          onClick={() => setSide("buy")}
        >
          매수
        </Button>
        <Button
          type="button"
          variant={side === "sell" ? "default" : "outline"}
          onClick={() => setSide("sell")}
        >
          매도
        </Button>
      </div>
      <div className="flex gap-2">
        <Button
          type="button"
          variant={type === "market" ? "default" : "outline"}
          onClick={() => setType("market")}
        >
          시장가
        </Button>
        <Button
          type="button"
          variant={type === "limit" ? "default" : "outline"}
          onClick={() => setType("limit")}
        >
          지정가
        </Button>
      </div>
      <div className="space-y-1">
        <Label>수량</Label>
        <Input type="number" min="1" step="1" value={quantity} onChange={(e) => setQuantity(e.target.value)} required />
      </div>
      {type === "limit" && (
        <div className="space-y-1">
          <Label>지정가 ({currency})</Label>
          <Input
            type="number"
            min="0.0001"
            step="any"
            value={limitPrice}
            onChange={(e) => setLimitPrice(e.target.value)}
            required
          />
        </div>
      )}
      {message && (
        <Alert variant={message.kind === "ok" ? "default" : "destructive"}>
          <AlertDescription>{message.text}</AlertDescription>
        </Alert>
      )}
      <Button type="submit" disabled={submitting} className="w-full">
        {side === "buy" ? "매수" : "매도"} {type === "market" ? "(시장가)" : "(지정가)"}
      </Button>
    </form>
  );
}
```

- [ ] **Step 2: 종목 상세 페이지에 OrderForm + 글로벌 portfolio 조회 통합**

Edit `apps/web/app/app/trade/[symbol]/page.tsx`. 기존 "거래" 카드를 OrderForm으로 교체:

```tsx
import { redirect } from "next/navigation";
import { OrderForm } from "@/components/order-form";
// ... 기존 imports

export default async function StockDetail({ params }: { params: Promise<{ symbol: string }> }) {
  const { symbol } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const { data: stock } = await supabase
    .from("stocks")
    .select("*")
    .eq("symbol", decodeURIComponent(symbol))
    .single();
  if (!stock) notFound();

  // 글로벌 포트폴리오 조회
  const { data: portfolio } = await supabase
    .from("portfolios")
    .select("id, krw_balance, usd_balance")
    .eq("user_id", user.id)
    .is("room_id", null)
    .single();

  const fmt = stock.currency === "KRW" ? KRW : USD;
  // ... 기존 카드들 위에:
  // (현재가 / 기본정보 카드는 그대로)
  // 거래 카드만 갱신:

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-4">
      {/* ... heading + 현재가 + 기본정보 카드 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">거래</CardTitle>
        </CardHeader>
        <CardContent>
          {portfolio ? (
            <OrderForm
              portfolioId={portfolio.id}
              symbol={stock.symbol}
              currency={stock.currency}
              lastPrice={stock.last_price ? Number(stock.last_price) : null}
            />
          ) : (
            <div className="text-sm text-muted-foreground">포트폴리오 로딩 실패</div>
          )}
          <div className="text-xs text-muted-foreground mt-3">
            잔고: {portfolio?.krw_balance ? KRW.format(Number(portfolio.krw_balance)) : "—"} ·
            {portfolio?.usd_balance ? ` ${USD.format(Number(portfolio.usd_balance))}` : " $0"}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
```

(주의: 기존 코드의 `<Card>거래</Card>` 부분만 OrderForm 포함하도록 갱신. 다른 카드는 유지.)

- [ ] **Step 3: 빌드 확인 + 커밋**

```bash
cd apps/web && npm run build
git add apps/web/components/order-form.tsx apps/web/app/app/trade/[symbol]/page.tsx
git commit -m "feat(web): add OrderForm + integrate buy/sell into stock detail page"
```

---

## Task 21: Web — 포트폴리오 페이지들 (orders, holdings, transactions)

**Files:**
- Create: `apps/web/app/app/portfolio/page.tsx`
- Create: `apps/web/app/app/portfolio/orders/page.tsx`
- Create: `apps/web/app/app/portfolio/holdings/page.tsx`
- Create: `apps/web/app/app/portfolio/transactions/page.tsx`
- Create: `apps/web/components/cancel-order-button.tsx`

- [ ] **Step 1: portfolio index → orders 리다이렉트**

Create `apps/web/app/app/portfolio/page.tsx`:

```tsx
import { redirect } from "next/navigation";
export default function Portfolio() {
  redirect("/app/portfolio/holdings");
}
```

- [ ] **Step 2: cancel-order-button 컴포넌트**

Create `apps/web/components/cancel-order-button.tsx`:

```tsx
"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";

export function CancelOrderButton({ orderId }: { orderId: string }) {
  const [loading, setLoading] = useState(false);
  async function cancel() {
    if (!confirm("이 주문을 취소하시겠습니까?")) return;
    setLoading(true);
    const res = await fetch(`/api/orders/${orderId}`, { method: "DELETE" });
    setLoading(false);
    if (res.ok) {
      location.reload();
    } else {
      const err = await res.json().catch(() => ({}));
      alert(err.error ?? "취소 실패");
    }
  }
  return (
    <Button size="sm" variant="outline" onClick={cancel} disabled={loading}>
      취소
    </Button>
  );
}
```

- [ ] **Step 3: orders 페이지**

Create `apps/web/app/app/portfolio/orders/page.tsx`:

```tsx
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CancelOrderButton } from "@/components/cancel-order-button";

export default async function OrdersPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const { data: orders } = await supabase
    .from("orders")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(100);

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-4">
      <h1 className="text-2xl font-bold">주문 내역</h1>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">최근 100건</CardTitle>
        </CardHeader>
        <CardContent>
          {!orders || orders.length === 0 ? (
            <div className="text-sm text-muted-foreground">주문 없음</div>
          ) : (
            <ul className="space-y-2">
              {orders.map((o) => (
                <li key={o.id} className="text-sm flex items-center justify-between border-b pb-2">
                  <div>
                    <div className="font-medium">
                      {o.symbol} · {o.side} {o.order_type} · {o.quantity}주
                      {o.limit_price ? ` @ ${o.limit_price}` : ""}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      상태: {o.status} · {new Date(o.created_at).toLocaleString("ko-KR")}
                      {o.filled_avg_price ? ` · 체결가 ${o.filled_avg_price}` : ""}
                    </div>
                  </div>
                  {o.status === "pending" && <CancelOrderButton orderId={o.id} />}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
```

- [ ] **Step 4: holdings 페이지**

Create `apps/web/app/app/portfolio/holdings/page.tsx`:

```tsx
import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const KRW = new Intl.NumberFormat("ko-KR", { style: "currency", currency: "KRW", maximumFractionDigits: 0 });
const USD = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });

export default async function HoldingsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const { data: holdings } = await supabase
    .from("holdings")
    .select("portfolio_id, symbol, quantity, avg_cost, updated_at, stocks(name, name_ko, currency, market, last_price)");

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-4">
      <h1 className="text-2xl font-bold">보유 종목</h1>
      <Card>
        <CardContent className="pt-6">
          {!holdings || holdings.length === 0 ? (
            <div className="text-sm text-muted-foreground">보유 없음</div>
          ) : (
            <ul className="space-y-3">
              {holdings.map((h) => {
                const stock = Array.isArray(h.stocks) ? h.stocks[0] : h.stocks;
                const fmt = stock?.currency === "KRW" ? KRW : USD;
                const cost = Number(h.avg_cost) * Number(h.quantity);
                const value = stock?.last_price ? Number(stock.last_price) * Number(h.quantity) : null;
                const pl = value !== null ? value - cost : null;
                return (
                  <li key={h.symbol} className="border-b pb-2">
                    <Link href={`/app/trade/${encodeURIComponent(h.symbol)}`} className="block hover:bg-muted/30 p-2 rounded">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="font-medium">{stock?.name_ko ?? stock?.name ?? h.symbol}</div>
                          <div className="text-xs text-muted-foreground">{h.symbol} · {h.quantity}주</div>
                        </div>
                        <div className="text-right">
                          <div className="font-mono text-sm">평단 {fmt.format(Number(h.avg_cost))}</div>
                          {value !== null && (
                            <div className={`text-sm ${pl! >= 0 ? "text-green-500" : "text-red-500"}`}>
                              {fmt.format(value)} ({pl! >= 0 ? "+" : ""}{fmt.format(pl!)})
                            </div>
                          )}
                        </div>
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

- [ ] **Step 5: transactions 페이지 (체결 + 환전 통합)**

Create `apps/web/app/app/portfolio/transactions/page.tsx`:

```tsx
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default async function TransactionsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const [trades, fx] = await Promise.all([
    supabase.from("trades").select("*").order("executed_at", { ascending: false }).limit(50),
    supabase.from("fx_transactions").select("*").order("executed_at", { ascending: false }).limit(50),
  ]);

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-4">
      <h1 className="text-2xl font-bold">체결 · 환전 내역</h1>
      <Card>
        <CardHeader><CardTitle className="text-base">체결</CardTitle></CardHeader>
        <CardContent>
          {!trades.data?.length ? (
            <div className="text-sm text-muted-foreground">없음</div>
          ) : (
            <ul className="text-sm space-y-1">
              {trades.data.map((t) => (
                <li key={t.id}>
                  {t.symbol} · {t.side} {t.quantity}주 @ {t.price} {t.currency} · 수수료 {t.fee} ·{" "}
                  {new Date(t.executed_at).toLocaleString("ko-KR")}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle className="text-base">환전</CardTitle></CardHeader>
        <CardContent>
          {!fx.data?.length ? (
            <div className="text-sm text-muted-foreground">없음</div>
          ) : (
            <ul className="text-sm space-y-1">
              {fx.data.map((f) => (
                <li key={f.id}>
                  {f.from_amount} {f.from_currency} → {f.to_amount} {f.to_currency} ·
                  rate {f.rate} · {new Date(f.executed_at).toLocaleString("ko-KR")}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
```

- [ ] **Step 6: 빌드 + 커밋**

```bash
cd apps/web && npm run build
git add apps/web/app/app/portfolio/ apps/web/components/cancel-order-button.tsx
git commit -m "feat(web): portfolio pages — holdings, orders, transactions"
```

---

## Task 22: Web — FX 환전 페이지 + 폼

**Files:**
- Create: `apps/web/components/fx-exchange-form.tsx`
- Create: `apps/web/app/app/fx/page.tsx`

- [ ] **Step 1: fx-exchange-form**

Create `apps/web/components/fx-exchange-form.tsx`:

```tsx
"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";

export function FxExchangeForm({
  portfolioId,
  krwBalance,
  usdBalance,
  rate,
}: {
  portfolioId: string;
  krwBalance: number;
  usdBalance: number;
  rate: number | null;
}) {
  const [direction, setDirection] = useState<"KRW_TO_USD" | "USD_TO_KRW">("KRW_TO_USD");
  const [amount, setAmount] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);
    setSubmitting(true);
    const [from_currency, to_currency] = direction === "KRW_TO_USD" ? ["KRW", "USD"] : ["USD", "KRW"];
    const res = await fetch("/api/fx/exchange", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        portfolio_id: portfolioId,
        from_currency,
        to_currency,
        from_amount: Number(amount),
      }),
    });
    setSubmitting(false);
    if (res.ok) {
      const data = await res.json();
      setMessage({ kind: "ok", text: `완료: ${data.to_amount} ${to_currency} (rate ${data.rate})` });
      setTimeout(() => location.reload(), 1500);
    } else {
      const err = await res.json().catch(() => ({}));
      setMessage({ kind: "err", text: err.error ?? "오류" });
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="flex gap-2">
        <Button
          type="button"
          variant={direction === "KRW_TO_USD" ? "default" : "outline"}
          onClick={() => setDirection("KRW_TO_USD")}
        >
          KRW → USD
        </Button>
        <Button
          type="button"
          variant={direction === "USD_TO_KRW" ? "default" : "outline"}
          onClick={() => setDirection("USD_TO_KRW")}
        >
          USD → KRW
        </Button>
      </div>
      <div className="text-sm text-muted-foreground">
        잔고: ₩{krwBalance.toLocaleString("ko-KR")} · ${usdBalance.toFixed(2)}
        {rate && <> · 현재 환율 1 USD = ₩{rate}</>}
      </div>
      <div className="space-y-1">
        <Label>금액 ({direction === "KRW_TO_USD" ? "KRW" : "USD"})</Label>
        <Input type="number" step="any" min="0" value={amount} onChange={(e) => setAmount(e.target.value)} required />
      </div>
      {message && (
        <Alert variant={message.kind === "ok" ? "default" : "destructive"}>
          <AlertDescription>{message.text}</AlertDescription>
        </Alert>
      )}
      <Button type="submit" disabled={submitting || !amount} className="w-full">
        환전 (수수료 0.5%)
      </Button>
    </form>
  );
}
```

- [ ] **Step 2: fx 페이지**

Create `apps/web/app/app/fx/page.tsx`:

```tsx
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FxExchangeForm } from "@/components/fx-exchange-form";

export default async function FxPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const { data: portfolio } = await supabase
    .from("portfolios")
    .select("id, krw_balance, usd_balance")
    .eq("user_id", user.id)
    .is("room_id", null)
    .single();

  const { data: fx } = await supabase
    .from("fx_rates")
    .select("rate")
    .eq("base", "USD")
    .eq("quote", "KRW")
    .order("ts", { ascending: false })
    .limit(1)
    .maybeSingle();

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-4">
      <h1 className="text-2xl font-bold">환전</h1>
      <Card>
        <CardHeader><CardTitle className="text-base">KRW ↔ USD</CardTitle></CardHeader>
        <CardContent>
          {portfolio ? (
            <FxExchangeForm
              portfolioId={portfolio.id}
              krwBalance={Number(portfolio.krw_balance)}
              usdBalance={Number(portfolio.usd_balance)}
              rate={fx?.rate ? Number(fx.rate) : null}
            />
          ) : (
            <div className="text-sm text-muted-foreground">포트폴리오 없음</div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
```

- [ ] **Step 3: 커밋**

```bash
cd apps/web && npm run build
git add apps/web/components/fx-exchange-form.tsx apps/web/app/app/fx/
git commit -m "feat(web): FX exchange page + form (KRW↔USD with 0.5% spread)"
```

---

## Task 23: Web — 대시보드 링크 갱신

**Files:**
- Modify: `apps/web/app/app/dashboard/page.tsx`

- [ ] **Step 1: 곧 추가될 기능 카드 갱신**

Edit `apps/web/app/app/dashboard/page.tsx`. 곧 추가될 기능 카드의 CardContent를 다음으로:

```tsx
<CardContent className="text-sm text-muted-foreground space-y-2">
  <div>
    <Link href="/app/trade/search" className="text-foreground underline">
      → 종목 검색
    </Link>
  </div>
  <div>
    <Link href="/app/portfolio/holdings" className="text-foreground underline">
      → 보유 종목
    </Link>
  </div>
  <div>
    <Link href="/app/portfolio/orders" className="text-foreground underline">
      → 주문 내역
    </Link>
  </div>
  <div>
    <Link href="/app/portfolio/transactions" className="text-foreground underline">
      → 체결·환전 내역
    </Link>
  </div>
  <div>
    <Link href="/app/fx" className="text-foreground underline">
      → 환전 (KRW ↔ USD)
    </Link>
  </div>
  <div className="pt-2 border-t">· 종목 차트 + 지표 (Plan #4)</div>
  <div>· 친구방 + 리더보드 (Plan #5)</div>
</CardContent>
```

- [ ] **Step 2: 커밋**

```bash
git add apps/web/app/app/dashboard/page.tsx
git commit -m "feat(web): dashboard links to portfolio/orders/fx pages"
```

---

## Task 24: E2E — 시장가 매수

**Files:**
- Create: `apps/web/tests/e2e/trading-market-order.spec.ts`

- [ ] **Step 1: 테스트 작성**

Create `apps/web/tests/e2e/trading-market-order.spec.ts`:

```typescript
import { test, expect, type Page } from "@playwright/test";

async function signupAndGoToTrade(page: Page, symbol: string) {
  const email = `trade-${Date.now()}@test.com`;
  await page.goto("/auth/login");
  await page.getByRole("button", { name: /가입하기/i }).click();
  await page.getByLabel("이메일").fill(email);
  await page.getByLabel("비밀번호").fill("TestPass123!");
  await page.getByRole("button", { name: /^가입$/i }).click();
  await expect(page).toHaveURL(/\/app\/dashboard/, { timeout: 15_000 });
  await page.goto(`/app/trade/${encodeURIComponent(symbol)}`);
}

test.describe("Trading — market order", () => {
  test("KR 종목 시장가 매수 → 보유 + 잔고 갱신", async ({ page }) => {
    // 005930.KS (삼성전자)는 KR 장중에만 시장가 가능. 테스트는 장중일 때만.
    // 환경에 따라 skip되도록 처리
    const now = new Date();
    // KR 장: 평일 09:00–15:30 KST = UTC 00:00–06:30
    const day = now.getUTCDay();
    const hour = now.getUTCHours();
    const minute = now.getUTCMinutes();
    const totalMin = hour * 60 + minute;
    const isKrOpen = day >= 1 && day <= 5 && totalMin >= 0 && totalMin <= 6 * 60 + 30;
    test.skip(!isKrOpen, "KR 장 마감 시간이라 스킵");

    await signupAndGoToTrade(page, "005930.KS");
    await expect(page.getByRole("heading", { name: /삼성전자/ })).toBeVisible();

    // 시장가 매수 1주
    await page.getByRole("button", { name: "시장가" }).first().click();
    await page.getByLabel("수량").fill("1");
    await page.getByRole("button", { name: /^매수.*시장가/ }).click();

    await expect(page.getByText(/체결됨/)).toBeVisible({ timeout: 10_000 });

    // 보유 페이지 가서 1주 표시
    await page.goto("/app/portfolio/holdings");
    await expect(page.getByText(/삼성전자/)).toBeVisible();
    await expect(page.getByText(/1주/)).toBeVisible();
  });

  test("매수 후 매도 — 잔고 복구", async ({ page }) => {
    const now = new Date();
    // KR 장: 평일 09:00–15:30 KST = UTC 00:00–06:30
    const day = now.getUTCDay();
    const hour = now.getUTCHours();
    const minute = now.getUTCMinutes();
    const totalMin = hour * 60 + minute;
    const isKrOpen = day >= 1 && day <= 5 && totalMin >= 0 && totalMin <= 6 * 60 + 30;
    test.skip(!isKrOpen, "KR 장 마감 시간이라 스킵");

    await signupAndGoToTrade(page, "005930.KS");
    await page.getByLabel("수량").fill("1");
    await page.getByRole("button", { name: /^매수.*시장가/ }).click();
    await expect(page.getByText(/체결됨/)).toBeVisible({ timeout: 10_000 });

    // 매도
    await page.getByRole("button", { name: "매도" }).first().click();
    await page.getByLabel("수량").fill("1");
    await page.getByRole("button", { name: /^매도.*시장가/ }).click();
    await expect(page.getByText(/체결됨/)).toBeVisible({ timeout: 10_000 });

    await page.goto("/app/portfolio/holdings");
    await expect(page.getByText(/보유 없음/)).toBeVisible();
  });
});
```

- [ ] **Step 2: 실행 (장중 한정)**

```bash
cd apps/web && npx playwright test tests/e2e/trading-market-order.spec.ts -v
```

KR 장 마감 시간이면 자동 skip. 장중이면 PASS.

- [ ] **Step 3: 커밋**

```bash
git add apps/web/tests/e2e/trading-market-order.spec.ts
git commit -m "test(web): E2E for KR market order (skip outside market hours)"
```

---

## Task 25: E2E — 지정가 + 취소

**Files:**
- Create: `apps/web/tests/e2e/trading-limit-cancel.spec.ts`

장 마감 후에도 동작하는 지정가는 **24/7 가능**. 좋은 회귀 테스트.

- [ ] **Step 1: 테스트 작성**

Create `apps/web/tests/e2e/trading-limit-cancel.spec.ts`:

```typescript
import { test, expect, type Page } from "@playwright/test";

async function signupAndGoToTrade(page: Page, symbol: string) {
  const email = `lim-${Date.now()}@test.com`;
  await page.goto("/auth/login");
  await page.getByRole("button", { name: /가입하기/i }).click();
  await page.getByLabel("이메일").fill(email);
  await page.getByLabel("비밀번호").fill("TestPass123!");
  await page.getByRole("button", { name: /^가입$/i }).click();
  await expect(page).toHaveURL(/\/app\/dashboard/, { timeout: 15_000 });
  await page.goto(`/app/trade/${encodeURIComponent(symbol)}`);
}

test.describe("Trading — limit + cancel", () => {
  test("USD: 지정가 매수 (가격 미도달) → 펜딩 → 취소", async ({ page }) => {
    // USD 잔고 0이라 매수 안 됨 → 환전 후 매수
    await signupAndGoToTrade(page, "AAPL");
    await page.goto("/app/fx");
    // KRW → USD 1,400,000 (대략 $1000)
    await page.getByLabel(/금액/).fill("1400000");
    await page.getByRole("button", { name: /^환전/ }).click();
    await expect(page.getByText(/완료/)).toBeVisible({ timeout: 5_000 });
    await page.waitForTimeout(2000);  // reload 후 잔고 반영 대기

    await page.goto("/app/trade/AAPL");
    await page.getByRole("button", { name: "지정가" }).first().click();
    await page.getByLabel("수량").fill("1");
    await page.getByLabel(/지정가/).fill("50");  // 의도적으로 낮게 — 도달 X
    await page.getByRole("button", { name: /^매수.*지정가/ }).click();

    await expect(page.getByText(/주문 접수됨/)).toBeVisible({ timeout: 10_000 });

    // 주문 페이지에서 펜딩 + 취소 버튼
    await page.goto("/app/portfolio/orders");
    await expect(page.getByText("AAPL")).toBeVisible();
    await expect(page.getByText("pending")).toBeVisible();

    page.on("dialog", (d) => d.accept());
    await page.getByRole("button", { name: "취소" }).first().click();
    await page.waitForLoadState("networkidle");
    await expect(page.getByText("cancelled")).toBeVisible({ timeout: 5_000 });
  });
});
```

- [ ] **Step 2: 실행**

```bash
cd apps/web && npx playwright test tests/e2e/trading-limit-cancel.spec.ts -v
```

- [ ] **Step 3: 커밋**

```bash
git add apps/web/tests/e2e/trading-limit-cancel.spec.ts
git commit -m "test(web): E2E for FX exchange + limit order + cancel (24/7 path)"
```

---

## Task 26: README 갱신

**Files:**
- Modify: `README.md`

- [ ] **Step 1: 진행 상태 갱신**

Edit `README.md`. Plan #2 다음에 추가:

```markdown
### Plan #3 — Trading Core ✅ 완료

- [x] DB: holdings, orders, trades, fx_transactions + RLS
- [x] PG 함수 5개 (atomic + auth + 잠금): place_market_order, place_limit_order, cancel_order, match_limit_order, exchange_currency
- [x] Worker: matching_engine 잡 (1분 주기, 펜딩 주문 매칭)
- [x] Web API: /api/orders (POST/GET, market+limit), /api/orders/[id] (DELETE), /api/fx/{exchange,transactions}, /api/holdings, /api/trades
- [x] Web 페이지: 종목 상세에 매수/매도 폼, /app/portfolio/{holdings,orders,transactions}, /app/fx
- [x] 시뮬 수수료: KR buy 0.015%, KR sell 0.215%, US 0.05%, FX 0.5%
- [x] 테스트: 워커 단위/통합 47 + Web E2E 7 = **누적 54/54 PASS**

다음 (Plan #4): 종목 상세 차트 (Lightweight Charts), 매수/매도 BottomSheet, 종목 정보 풀스펙 (뉴스/재무).
```

- [ ] **Step 2: 디버깅 팁 추가**

```markdown
- **시장가 주문 거부 (`market_closed`)**: 한국 장(평일 09:00–15:30 KST) 또는 미국 장(평일 22:30–05:00 KST 서머타임) 시간대인지 확인. 지정가는 24/7 가능.
- **지정가 매칭 안 됨**: 워커 로그에서 `matching_engine` 출력 확인. 가격이 limit 도달 안 했으면 정상. 30분 stale 가격은 매칭 스킵.
- **환전 `fx_rate_unavailable`**: 워커가 `fetch_fx`를 한 번 이상 실행해야 fx_rates에 행이 들어감. 워커 부팅 시 즉시 실행됨.
```

- [ ] **Step 3: 커밋**

```bash
git add README.md
git commit -m "docs: Plan #3 (Trading Core) completion + debugging tips"
```

---

## 마무리 검증 체크리스트

- [ ] **DB**: 마이그레이션 10개 모두 적용 (`supabase db reset` clean), 5개 PG 함수 존재
- [ ] **단위 테스트**: `cd apps/worker && uv run pytest` → 모두 PASS (이전 39 + matching_engine 3 + trading 7 = 49)
- [ ] **Lint/typecheck**: `npm run lint && npx tsc --noEmit && uv run ruff check .` clean
- [ ] **빌드**: `cd apps/web && npm run build` 성공
- [ ] **로컬 수동**: 가입 → 환전 → AAPL 지정가 매수 → 주문 페이지에서 취소 → 잔고 복원
- [ ] **로컬 수동**: 장중에 KR 종목 시장가 매수 → 보유 페이지에서 1주 표시
- [ ] **워커**: `matching_engine.skip reason=no_pending` 또는 `matching_engine.done` 1분마다 출력

---

## Plan #3에 포함되지 않은 것

| 항목 | Plan |
|------|------|
| Lightweight Charts (캔들 + 지표) | #4 |
| 매수/매도 BottomSheet (모바일 친화) | #4 |
| 종목 뉴스/재무제표 표시 | #4 |
| 관심종목 (watchlists) | #4 |
| 부분 체결 (현재 v1은 전량 단일 체결) | v1.5 |
| 호가창 (orderbook) | v2 |
| Stop Loss / Take Profit 자동 주문 | v2 |
| 공매도/마진 | v2 |
| 친구방 (room_id 있는 portfolio) | #5 |

---

## 디버깅 팁

- **`portfolio_not_found_or_ended`**: 글로벌 portfolio가 트리거에서 자동 생성되었는지 확인. `auth.uid()`가 portfolios.user_id와 일치하는지.
- **`price_stale`**: stocks.last_price_at이 30분 이상 오래됨. 워커 fetch_prices가 도는지 또는 장 마감 후라 안 도는지 확인. 시장가는 어차피 장중에만이므로 보통 stale 아님.
- **취소 후 잔고가 정확히 안 맞음**: 매수 지정가의 `reserved_amount`는 `quantity × limit_price × (1 + fee_rate)`로 계산됨. 체결 시 `(quantity × limit_price × (1 + fee_rate)) - (quantity × limit_price + fee)` 만큼 환원. 차이는 매수 수수료 추정의 보수적 계산에서 옴.
- **`security definer` 함수 호출 시 RLS bypass**: PG 함수 안에서 `auth.uid()` 체크로 권한 강제. service_role은 우회 가능 (워커용).
