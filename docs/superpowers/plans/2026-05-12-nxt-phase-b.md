# NXT Phase B (Price Spread + Midpoint Orders) Implementation Plan — Plan #12

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (chosen by user — inline) to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** NXT 시간외 거래(pre 08:00–08:50, after 15:30–20:00 KST)의 가격 모델에 현실감 부여 — synthetic bid/ask spread (±10 bps from `last_price`) + 신규 `midpoint` 주문 타입으로 spread 없이 체결 가능. KRX 정규장(09:00–15:20)은 영향 없음.

**Architecture:** PG의 `place_market_order` 안에서 NXT pre/after session 감지 시 매수=ask, 매도=bid 가격 적용 (정규장은 last_price 유지). 신규 PG 함수 `place_midpoint_order`는 NXT pre/after에만 허용되고 midpoint(=last_price)로 즉시 체결. `orders.order_type` CHECK constraint에 `'midpoint'` 추가. 웹 `/api/orders` 라우트가 `type === "midpoint"` 분기 처리. 트레이드 페이지에 NXT 시간일 때 bid/ask spread 배지 + OrderForm에 "미드포인트" 옵션 표시.

**Tech Stack:** PostgreSQL plpgsql, 기존 `lib/market-hours.ts::getKrSession()`, Tailwind 배지 UI.

---

## Scope (explicit limits)

In scope:
- **DB**: `orders.order_type` CHECK에 `'midpoint'` 추가 (migration)
- **DB**: `_kr_nxt_session()` immutable helper — `now() at time zone 'Asia/Seoul'`로 KR 세션 판정 (pre/regular/after/closed)
- **DB**: `place_market_order` 수정 — NXT pre/after 시 spread 적용 (buy=ask, sell=bid, ±10 bps)
- **DB**: 신규 `place_midpoint_order` — NXT pre/after에만 허용, midpoint(=last_price)로 즉시 체결
- **Spread**: 고정 10 bps (= 0.1%, 1.001 / 0.999 factor). spec §4.7 reference.
- **Web API**: `/api/orders` route — `type === "midpoint"` 분기 RPC 호출
- **Web UI**: `OrderForm`에 `미드포인트` 버튼 (NXT pre/after 세션일 때만 활성)
- **Web UI**: 트레이드 페이지에 `NxtSpreadBadge` 컴포넌트 — NXT 시간에 ₩bid / ₩ask + "spread 10 bps" 표시
- **README**: Plan #12 완료 섹션

Out of scope (defer):
- 동적 spread (유동성 티어별, 시간별)
- 메이커-테이커 수수료 모델
- 스톱지정가, OCO
- 800종목 NXT 화이트리스트 (현재 KR top 100은 전부 NXT 가능 가정)
- 실제 NXT 가격 데이터 소스 (yfinance/FDR 한계 — synthetic이 유일한 옵션)
- 미국 종목 spread (NYSE/NASDAQ은 기존 last_price 유지)

---

## File Structure

### Supabase
- **Create** `supabase/migrations/20260513000003_nxt_phase_b.sql` — `_kr_nxt_session()`, order_type CHECK 갱신, `place_market_order` 재정의, `place_midpoint_order` 신규

### Web — modify
- **Modify** `apps/web/app/api/orders/route.ts` — `type` 화이트리스트에 `midpoint` 추가, RPC 분기
- **Modify** `apps/web/components/order-form.tsx` — `type` state에 `midpoint` 추가, NXT 세션 감지 후 버튼 표시
- **Modify** `apps/web/app/app/trade/[symbol]/page.tsx` — `NxtSpreadBadge` 노출

### Web — new
- **Create** `apps/web/components/nxt-spread-badge.tsx` — server component, last_price + session 기반 표시

### Tests
- **Modify** `apps/web/tests/e2e/trading-market-order.spec.ts` — NXT 시간일 때 spread 적용 확인 (기존 regex `/체결됨/`은 유지)
- **Create** `apps/web/tests/e2e/midpoint-order.spec.ts` — NXT 시간에 midpoint 주문 → 체결 검증

### Docs
- **Modify** `README.md` — Plan #12 완료 섹션 + spread 표

---

## Task 1: 환경 점검 + branch

- [ ] **Step 1: branch 확인**

```bash
cd "C:/Users/Helios_Neo_18/모의 주식"
git checkout -b plan-12-nxt-phase-b
git branch --show-current
```

Expected: `plan-12-nxt-phase-b`

- [ ] **Step 2: Docker / Supabase 가동 확인 — DB 마이그레이션 + E2E 의존**

```bash
supabase status 2>&1 | head -5
```

만약 Docker Desktop 미실행 → 사용자가 시작해야 함. 미실행 상태로는 PG 함수 검증 불가. 본 plan 진행 보류 가능.

DB 변경 있음 (1개 마이그레이션).

---

## Task 2: SQL 마이그레이션 — `_kr_nxt_session` + order_type CHECK

**Files:**
- Create: `supabase/migrations/20260513000003_nxt_phase_b.sql`

- [ ] **Step 1: 마이그레이션 초안 — helper + constraint 갱신 (dynamic 이름 lookup)**

```sql
-- Plan #12 (NXT Phase B): synthetic spread + midpoint orders
-- spec §4.7, §6.3

-- 1) KR session helper (PG-side, mirrors lib/market-hours.ts::getKrSession)
--    stable (not immutable) — depends on now()
create or replace function public._kr_nxt_session(p_when timestamptz default now())
returns text
language sql
stable
as $$
  select case
    when extract(dow from (p_when at time zone 'Asia/Seoul')) in (0, 6) then 'closed'
    when (extract(hour from (p_when at time zone 'Asia/Seoul')) * 60
        + extract(minute from (p_when at time zone 'Asia/Seoul'))) between 480 and 529 then 'pre'      -- 08:00-08:49 inclusive
    when (extract(hour from (p_when at time zone 'Asia/Seoul')) * 60
        + extract(minute from (p_when at time zone 'Asia/Seoul'))) between 540 and 919 then 'regular' -- 09:00-15:19 inclusive
    when (extract(hour from (p_when at time zone 'Asia/Seoul')) * 60
        + extract(minute from (p_when at time zone 'Asia/Seoul'))) between 930 and 1199 then 'after'  -- 15:30-19:59 inclusive
    else 'closed'
  end;
$$;

revoke all on function _kr_nxt_session(timestamptz) from public;
grant execute on function _kr_nxt_session(timestamptz) to authenticated, service_role;

-- 2) orders.order_type — allow 'midpoint'. CHECK constraint name varies by PG auto-naming,
--    so look up dynamically before drop/replace.
do $$
declare
  v_constraint_name text;
begin
  select conname into v_constraint_name
  from pg_constraint
  where conrelid = 'public.orders'::regclass
    and contype = 'c'
    and pg_get_constraintdef(oid) ilike '%order_type%';

  if v_constraint_name is not null then
    execute format('alter table public.orders drop constraint %I', v_constraint_name);
  end if;
end $$;

alter table public.orders add constraint orders_order_type_check
  check (order_type in ('market', 'limit', 'midpoint'));
```

이로써 기존 CHECK가 `orders_order_type_check`, `orders_check_order_type`, 또는 익명이어도 안전하게 교체. 신규 constraint는 명시적으로 `orders_order_type_check`로 명명.

**확인 step**: `lib/market-hours.ts::getKrSession()`의 minute 경계 (`< 8*60+50` = 530)는 SQL의 `between 480 and 529`(=530 미포함)과 일치 — 동일 경계 ✅.

- [ ] **Step 2: place_market_order 재정의 — NXT spread 적용**

같은 마이그레이션 파일에 이어서:
```sql
-- 3) place_market_order — NXT pre/after 시 spread 적용
--    buy = last_price * 1.001 (ask), sell = last_price * 0.999 (bid)
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
  v_session text;
  v_exec_price numeric;
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
  from stocks where symbol = p_symbol and is_active
  for share;
  if not found then
    raise exception 'stock_not_found';
  end if;
  if v_price is null then
    raise exception 'price_not_available';
  end if;
  if v_price_at < now() - interval '30 minutes' then
    raise exception 'price_stale';
  end if;

  if p_side not in ('buy', 'sell') then
    raise exception 'invalid_side';
  end if;
  if p_quantity <= 0 then
    raise exception 'invalid_quantity';
  end if;

  -- 3) NXT spread 적용 (KR 종목 + pre/after 세션일 때만)
  --    round(_, 4)로 모든 downstream (avg_cost, filled_avg_price, trade.price)이 동일 값 보장
  v_exec_price := v_price;  -- default: KRX 정규장, NYSE/NASDAQ, KR closed
  if v_market like 'KRX_%' then
    v_session := _kr_nxt_session(now());
    if v_session in ('pre', 'after') then
      if p_side = 'buy' then
        v_exec_price := round(v_price * 1.001, 4);  -- ask
      else
        v_exec_price := round(v_price * 0.999, 4);  -- bid
      end if;
    end if;
  end if;

  v_fee_rate := _calc_fee_rate(v_market, p_side);
  v_gross := p_quantity * v_exec_price;
  v_fee := v_gross * v_fee_rate;

  if p_side = 'buy' then
    v_net := v_gross + v_fee;
    if v_currency = 'KRW' then
      select krw_balance into v_balance from portfolios where id = p_portfolio_id;
    else
      select usd_balance into v_balance from portfolios where id = p_portfolio_id;
    end if;
    if v_balance < v_net then
      raise exception 'insufficient_balance';
    end if;
    if v_currency = 'KRW' then
      update portfolios set krw_balance = krw_balance - v_net where id = p_portfolio_id;
    else
      update portfolios set usd_balance = usd_balance - v_net where id = p_portfolio_id;
    end if;
    select quantity, avg_cost into v_holding, v_holding_avg
    from holdings where portfolio_id = p_portfolio_id and symbol = p_symbol
    for update;
    if v_holding is null then
      insert into holdings (portfolio_id, symbol, quantity, avg_cost)
      values (p_portfolio_id, p_symbol, p_quantity, v_exec_price);
    else
      v_new_qty := v_holding + p_quantity;
      v_new_avg := (v_holding * v_holding_avg + p_quantity * v_exec_price) / v_new_qty;
      update holdings set quantity = v_new_qty, avg_cost = v_new_avg, updated_at = now()
      where portfolio_id = p_portfolio_id and symbol = p_symbol;
    end if;
  else
    v_net := v_gross - v_fee;
    select quantity into v_holding
    from holdings where portfolio_id = p_portfolio_id and symbol = p_symbol
    for update;
    if v_holding is null or v_holding < p_quantity then
      raise exception 'insufficient_holdings';
    end if;
    if v_holding = p_quantity then
      delete from holdings where portfolio_id = p_portfolio_id and symbol = p_symbol;
    else
      update holdings set quantity = quantity - p_quantity, updated_at = now()
      where portfolio_id = p_portfolio_id and symbol = p_symbol;
    end if;
    if v_currency = 'KRW' then
      update portfolios set krw_balance = krw_balance + v_net where id = p_portfolio_id;
    else
      update portfolios set usd_balance = usd_balance + v_net where id = p_portfolio_id;
    end if;
  end if;

  insert into orders (
    portfolio_id, symbol, side, order_type, quantity,
    status, filled_quantity, filled_avg_price, fee_total, filled_at
  ) values (
    p_portfolio_id, p_symbol, p_side, 'market', p_quantity,
    'filled', p_quantity, v_exec_price, v_fee, now()
  ) returning id into v_order_id;

  insert into trades (
    order_id, portfolio_id, symbol, side, quantity, price, currency, fee
  ) values (
    v_order_id, p_portfolio_id, p_symbol, p_side, p_quantity, v_exec_price, v_currency, v_fee
  );

  return json_build_object(
    'order_id', v_order_id,
    'filled_avg_price', v_exec_price,
    'fee', v_fee,
    'currency', v_currency
  );
end;
$$;

revoke all on function place_market_order(uuid, text, text, numeric) from public;
grant execute on function place_market_order(uuid, text, text, numeric) to authenticated;
```

핵심 변경: `v_exec_price` 변수 도입 — `v_price`(원본 last_price)는 그대로 두고, NXT 시간에만 spread 적용. `holdings.avg_cost`, `orders.filled_avg_price`, `trades.price`는 모두 `v_exec_price`로 통일.

- [ ] **Step 3: place_midpoint_order 신규**

같은 마이그레이션 파일에 이어서:
```sql
-- 4) place_midpoint_order — NXT pre/after 전용, midpoint(=last_price)로 즉시 체결
create or replace function public.place_midpoint_order(
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
  v_session text;
begin
  -- 1) 포트폴리오
  select user_id into v_user_id
  from portfolios where id = p_portfolio_id and status = 'active'
  for update;
  if v_user_id is null then raise exception 'portfolio_not_found_or_ended'; end if;
  if v_user_id <> auth.uid() then raise exception 'unauthorized'; end if;

  -- 2) 종목
  select currency, market, last_price, last_price_at
  into v_currency, v_market, v_price, v_price_at
  from stocks where symbol = p_symbol and is_active
  for share;
  if not found then raise exception 'stock_not_found'; end if;
  if v_price is null then raise exception 'price_not_available'; end if;
  if v_price_at < now() - interval '30 minutes' then raise exception 'price_stale'; end if;

  -- 3) midpoint 주문은 KRX + NXT pre/after만 허용
  if v_market not like 'KRX_%' then
    raise exception 'midpoint_us_not_supported';
  end if;
  v_session := _kr_nxt_session(now());
  if v_session not in ('pre', 'after') then
    raise exception 'midpoint_session_only_nxt';
  end if;

  if p_side not in ('buy', 'sell') then raise exception 'invalid_side'; end if;
  if p_quantity <= 0 then raise exception 'invalid_quantity'; end if;

  -- 4) Midpoint price = last_price (no spread)
  v_fee_rate := _calc_fee_rate(v_market, p_side);
  v_gross := p_quantity * v_price;
  v_fee := v_gross * v_fee_rate;

  if p_side = 'buy' then
    v_net := v_gross + v_fee;
    select krw_balance into v_balance from portfolios where id = p_portfolio_id;  -- KRX → KRW
    if v_balance < v_net then raise exception 'insufficient_balance'; end if;
    update portfolios set krw_balance = krw_balance - v_net where id = p_portfolio_id;
    select quantity, avg_cost into v_holding, v_holding_avg
    from holdings where portfolio_id = p_portfolio_id and symbol = p_symbol
    for update;
    if v_holding is null then
      insert into holdings (portfolio_id, symbol, quantity, avg_cost)
      values (p_portfolio_id, p_symbol, p_quantity, v_price);
    else
      v_new_qty := v_holding + p_quantity;
      v_new_avg := (v_holding * v_holding_avg + p_quantity * v_price) / v_new_qty;
      update holdings set quantity = v_new_qty, avg_cost = v_new_avg, updated_at = now()
      where portfolio_id = p_portfolio_id and symbol = p_symbol;
    end if;
  else
    v_net := v_gross - v_fee;
    select quantity into v_holding
    from holdings where portfolio_id = p_portfolio_id and symbol = p_symbol
    for update;
    if v_holding is null or v_holding < p_quantity then
      raise exception 'insufficient_holdings';
    end if;
    if v_holding = p_quantity then
      delete from holdings where portfolio_id = p_portfolio_id and symbol = p_symbol;
    else
      update holdings set quantity = quantity - p_quantity, updated_at = now()
      where portfolio_id = p_portfolio_id and symbol = p_symbol;
    end if;
    update portfolios set krw_balance = krw_balance + v_net where id = p_portfolio_id;
  end if;

  insert into orders (
    portfolio_id, symbol, side, order_type, quantity,
    status, filled_quantity, filled_avg_price, fee_total, filled_at
  ) values (
    p_portfolio_id, p_symbol, p_side, 'midpoint', p_quantity,
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

revoke all on function place_midpoint_order(uuid, text, text, numeric) from public;
grant execute on function place_midpoint_order(uuid, text, text, numeric) to authenticated;

comment on function place_midpoint_order(uuid, text, text, numeric) is
  'NXT 미드포인트 주문 (Plan #12). pre/after 세션에만 허용. midpoint=last_price (no spread).';
```

- [ ] **Step 4: 마이그레이션 적용**

```bash
cd "C:/Users/Helios_Neo_18/모의 주식"
supabase db reset --no-seed 2>&1 | tail -20
# 또는 prod에 적용 시 supabase db push
```

Expected: 모든 마이그 적용 후 새 함수 두 개 + helper 1개 + CHECK 갱신 완료. 에러 없음.

- [ ] **Step 5: 커밋**

```bash
git add supabase/migrations/20260513000003_nxt_phase_b.sql
git commit -m "feat(db): NXT spread + midpoint order_type + place_midpoint_order (Plan #12)"
```

---

## Task 3: `/api/orders` 라우트 — midpoint 분기

**Files:**
- Modify: `apps/web/app/api/orders/route.ts`

- [ ] **Step 1: type union + RPC fn 분기**

```ts
type OrderType = "market" | "limit" | "midpoint";

type OrderBody = {
  portfolio_id: string;
  symbol: string;
  side: "buy" | "sell";
  type: OrderType;
  quantity: number;
  limit_price?: number;
};
```

POST 핸들러 내부:
- type 검증: `if (!["market","limit","midpoint"].includes(type))` → 400
- `if (type === "limit" && limit_price == null)` 기존 유지
- `if (type !== "limit")` — market과 midpoint 둘 다 장중 검증 필요
- 다만 midpoint은 server-side `_kr_nxt_session()`가 PG 안에서 검증하므로 클라이언트측 가드는 정보 제공용
- RPC 분기:
  ```ts
  const fnName =
    type === "market" ? "place_market_order"
    : type === "limit" ? "place_limit_order"
    : "place_midpoint_order";
  ```
- `mapErrorStatus`에 `midpoint_session_only_nxt` / `midpoint_us_not_supported` 추가 → 422

- [ ] **Step 2: 빌드 + lint**

```bash
cd "C:/Users/Helios_Neo_18/모의 주식/apps/web"
npm run build 2>&1 | tail -5
npm run lint 2>&1 | tail -3
```

Expected: 0 errors.

- [ ] **Step 3: 커밋**

```bash
git add apps/web/app/api/orders/route.ts
git commit -m "feat(api): /api/orders dispatch to place_midpoint_order (Plan #12)"
```

---

## Task 4: OrderForm — "미드포인트" 옵션 + NXT 세션 게이팅

**Files:**
- Modify: `apps/web/components/order-form.tsx`

- [ ] **Step 1: type union 확장 + NXT 세션 감지**

OrderForm을 client component로 유지. `getKrSession()`은 server·client 모두 import 가능 (lib/market-hours.ts는 순수). `market` prop 추가 받아 KR/US 분기.

```tsx
import { getKrSession } from "@/lib/market-hours";

type Props = {
  portfolioId: string;
  symbol: string;
  currency: string;
  market: string;  // KRX_KS | KRX_KQ | NASDAQ | NYSE
  lastPrice: number | null;
  forceSide?: "buy" | "sell";
};

// state: type as "market" | "limit" | "midpoint"
const [type, setType] = useState<"market" | "limit" | "midpoint">("market");

// 미드포인트 가능 여부 (client side, server는 PG가 다시 검증)
const isNxtSession = useMemo(() => {
  if (!market.startsWith("KRX_")) return false;
  const s = getKrSession();
  return s === "pre" || s === "after";
}, [market]);
```

`market` prop은 호출 측 (`/app/trade/[symbol]/page.tsx`)에서 전달.

`<Button type="button" variant={type === "midpoint" ? "default" : "outline"} onClick={() => setType("midpoint")} disabled={!isNxtSession}>미드포인트</Button>` — type 토글 그룹에 추가.

비활성 시 hover 툴팁: "NXT pre/after 시간에만"

- [ ] **Step 2: submit body — midpoint일 때 limit_price 제외**

`if (type === "limit") body.limit_price = Number(limitPrice);` — 이미 type==='limit'만 추가. midpoint는 body에 limit_price 없이 전송. ✅

- [ ] **Step 3: 호출 측 page.tsx에 market prop 전달**

`apps/web/app/app/trade/[symbol]/page.tsx` 안에서 OrderForm 또는 BuySellSheet에 `market={stock.market}` 추가.

(Read 후 수정 — Task 4 시 실제 코드 확인.)

- [ ] **Step 4: 커밋**

```bash
git add apps/web/components/order-form.tsx apps/web/app/app/trade/[symbol]/page.tsx
git commit -m "feat(web): OrderForm midpoint option (NXT pre/after) + market prop (Plan #12)"
```

---

## Task 5: `NxtSpreadBadge` — bid/ask 표시

**Files:**
- Create: `apps/web/components/nxt-spread-badge.tsx`
- Modify: `apps/web/app/app/trade/[symbol]/page.tsx`

- [ ] **Step 1: 배지 컴포넌트 작성 (server-friendly)**

```tsx
// apps/web/components/nxt-spread-badge.tsx
import { getKrSession } from "@/lib/market-hours";

type Props = {
  market: string;
  lastPrice: number | null;
};

const SPREAD_BPS = 10;  // ±10 basis points (0.1%)

const KRW = new Intl.NumberFormat("ko-KR", {
  style: "currency",
  currency: "KRW",
  maximumFractionDigits: 0,
});

export function NxtSpreadBadge({ market, lastPrice }: Props) {
  if (!market.startsWith("KRX_")) return null;
  const session = getKrSession();
  if (session !== "pre" && session !== "after") return null;
  if (lastPrice == null) return null;

  const bid = lastPrice * (1 - SPREAD_BPS / 10_000);
  const ask = lastPrice * (1 + SPREAD_BPS / 10_000);
  const label = session === "pre" ? "프리마켓" : "애프터마켓";

  return (
    <div className="inline-flex items-center gap-2 rounded-md border border-primary/40 bg-primary/5 px-3 py-1.5 text-xs">
      <span className="font-semibold text-primary">{label} (NXT)</span>
      <span className="text-muted-foreground">
        Bid {KRW.format(Math.round(bid))} · Ask {KRW.format(Math.round(ask))}
      </span>
      <span className="text-muted-foreground">spread {SPREAD_BPS} bps</span>
    </div>
  );
}
```

server-side에서 `getKrSession()`을 호출하지만 server time(=container TZ UTC)을 사용. `lib/market-hours.ts`의 함수는 KST로 정규화하므로 안전. (단, server time이 정확히 KST일 필요는 없음 — `new Date()`는 UTC 기준이므로 OK.)

- [ ] **Step 2: page.tsx에 노출**

가격 표시 영역 근처에 `<NxtSpreadBadge market={stock.market} lastPrice={stock.last_price} />` 추가.

- [ ] **Step 3: 커밋**

```bash
git add apps/web/components/nxt-spread-badge.tsx apps/web/app/app/trade/[symbol]/page.tsx
git commit -m "feat(web): NxtSpreadBadge — bid/ask display during NXT session (Plan #12)"
```

---

## Task 6: E2E — 미드포인트 주문

**Files:**
- Create: `apps/web/tests/e2e/midpoint-order.spec.ts`

- [ ] **Step 1: 테스트 작성**

```ts
import { test, expect, type Page } from "@playwright/test";

function isNxtSession(): boolean {
  const now = new Date();
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  const day = kst.getUTCDay();
  if (day === 0 || day === 6) return false;
  const minutes = kst.getUTCHours() * 60 + kst.getUTCMinutes();
  if (minutes >= 480 && minutes < 530) return true;   // pre 08:00-08:50
  if (minutes >= 930 && minutes < 1200) return true;  // after 15:30-20:00
  return false;
}

async function signupAndGoToTrade(page: Page, symbol: string) {
  const email = `mid-${Date.now()}@test.com`;
  await page.goto("/auth/login");
  await page.getByRole("button", { name: /가입하기/i }).click();
  await page.getByLabel("이메일").fill(email);
  await page.getByLabel("비밀번호").fill("TestPass123!");
  await page.getByRole("button", { name: /^가입$/i }).click();
  await expect(page).toHaveURL(/\/app\/dashboard/, { timeout: 15_000 });
  await page.goto(`/app/trade/${encodeURIComponent(symbol)}`);
}

test.describe("Midpoint order (Plan #12)", () => {
  test("NXT pre/after 시간에만 미드포인트 매수 가능", async ({ page }) => {
    test.skip(!isNxtSession(), "NXT pre/after 시간 외 — 미드포인트 비활성");

    await signupAndGoToTrade(page, "005930.KS");
    await expect(page.getByRole("heading", { name: /삼성전자/ })).toBeVisible();

    // 미드포인트 버튼 클릭
    await page.getByRole("button", { name: "미드포인트" }).click();
    await page.getByLabel("수량").fill("1");
    await page.getByRole("button", { name: /^매수/ }).click();

    await expect(page.getByText(/체결됨/)).toBeVisible({ timeout: 10_000 });

    // 보유 페이지 확인
    await page.goto("/app/portfolio/holdings");
    await expect(page.getByText(/삼성전자/)).toBeVisible();
  });

  test("KRX 정규장에는 미드포인트 버튼 비활성", async ({ page }) => {
    test.skip(isNxtSession(), "정규장 시간이 아님 — 본 테스트는 정규장에서만 의미");

    // 정규장: 09:00-15:20 KST에만 실행되도록 일부러 게이팅
    const now = new Date();
    const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
    const minutes = kst.getUTCHours() * 60 + kst.getUTCMinutes();
    const isRegular = minutes >= 540 && minutes < 920;
    test.skip(!isRegular, "정규장이 아님");

    await signupAndGoToTrade(page, "005930.KS");
    await expect(
      page.getByRole("button", { name: "미드포인트" }),
    ).toBeDisabled();
  });
});
```

- [ ] **Step 2: 커밋**

```bash
git add apps/web/tests/e2e/midpoint-order.spec.ts
git commit -m "test(web): E2E midpoint order — NXT session gating (Plan #12)"
```

---

## Task 7: README

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Plan #12 섹션 추가**

```markdown
### Plan #12 — NXT Phase B (가격 spread + 미드포인트 호가) ✅ 완료

- [x] DB: `_kr_nxt_session()` immutable helper — PG에서 KR 세션 판정 (pre/regular/after/closed)
- [x] DB: `orders.order_type` CHECK에 `'midpoint'` 추가
- [x] DB: `place_market_order` 수정 — NXT pre/after 시 spread 적용 (매수=ask, 매도=bid, ±10 bps)
- [x] DB: `place_midpoint_order` 신규 — NXT pre/after 전용, midpoint(=last_price)로 체결
- [x] Web: `/api/orders` route에 `type === "midpoint"` 분기
- [x] Web: `OrderForm`에 "미드포인트" 옵션 (KRX + NXT pre/after에만 활성)
- [x] Web: 트레이드 페이지에 `NxtSpreadBadge` — bid/ask + spread bps 표시 (NXT 시간 한정)
- [x] E2E: 미드포인트 주문 + 정규장 비활성 (시간대 게이팅으로 SKIP 분기)
- [x] 시뮬 spread: 고정 10 bps (= 0.1%). 동적 spread는 v1.5+.

NXT 시간 (Plan #7.5 + #12):
| 세션 | 시각 (KST) | 시장가 | 미드포인트 | spread |
|------|-----------|--------|------------|--------|
| pre | 08:00–08:50 | ✅ (spread 적용) | ✅ | 10 bps |
| regular | 09:00–15:20 | ✅ (no spread) | ❌ | — |
| after | 15:30–20:00 | ✅ (spread 적용) | ✅ | 10 bps |
| closed | 20:00–08:00 | ❌ | ❌ | — |
```

`다음 plans` 섹션에서 "Plan #12: NXT Phase B" 제거.

- [ ] **Step 2: 커밋**

```bash
git add README.md
git commit -m "docs: Plan #12 NXT Phase B — completion section"
```

---

## Task 8: 전체 검증 + 머지 + 배포

- [ ] **Step 1: 빌드 + lint + E2E**

```bash
cd "C:/Users/Helios_Neo_18/모의 주식/apps/web"
rm -rf .next public/sw.js
npm run build 2>&1 | tail -10
npm run lint 2>&1 | tail -3
npx playwright test 2>&1 | tail -20
```

Expected:
- 빌드 OK
- lint clean
- midpoint E2E 2개 SKIP or 1 PASS + 1 SKIP (시간대에 따라)
- 기존 trading-market-order.spec.ts 영향 없음 (regex `/체결됨/`는 spread 적용 후에도 매치)

- [ ] **Step 2: master 머지**

```bash
cd "C:/Users/Helios_Neo_18/모의 주식"
git checkout master
git pull origin master
git merge --no-ff plan-12-nxt-phase-b -m "Merge plan-12-nxt-phase-b: NXT spread + midpoint orders"
git push origin master
```

- [ ] **Step 3: Supabase Cloud 마이그 + Vercel 배포**

```bash
supabase db push 2>&1 | tail -10
cd "C:/Users/Helios_Neo_18/모의 주식/apps/web"
vercel --prod --yes 2>&1 | tail -10
```

- [ ] **Step 4: 프로덕션 수동 검증 (NXT 시간이면)**

- 트레이드 페이지 → 삼성전자 (005930.KS) → "프리마켓 (NXT) · Bid ₩... · Ask ₩... · spread 10 bps" 배지 표시
- OrderForm에 "미드포인트" 버튼 활성
- 정규장 시간 다시 확인 → 미드포인트 비활성

- [ ] **Step 5: 브랜치 정리**

```bash
git branch -d plan-12-nxt-phase-b
```

---

## Risks / Mitigations

| Risk | Mitigation |
|------|------------|
| `orders_order_type_check` constraint 이름 가정 — 실제는 다를 수 있음 | Task 2 Step 1의 DO block이 `pg_constraint`에서 동적 lookup → 이름 무관 안전 교체 |
| `last_price_at > now() - 30min` staleness가 NXT 시간 새벽에 매수 거부할 위험 | Plan #7.5에서 워커 `fetch_prices`가 평일 08:00–20:00 KST 동안 KR last_price를 1분마다 갱신 (KRX 종가를 그대로 fallback). 워커 가동 중이면 staleness 30분 내 유지. 워커 다운 시 일반 `place_market_order`도 거부되므로 본 plan 특이 risk 아님. |
| 매칭 엔진이 `midpoint` 주문을 펜딩 큐에서 다시 처리하려 시도 | midpoint은 PG 함수에서 즉시 `'filled'` 상태로 INSERT — 펜딩 상태가 없음. 워커의 `match_limit_order`는 `where status='pending' and order_type='limit'`로 필터링하므로 영향 없음 (확인 권장: 워커 코드) |
| `numeric(20,4)` 정밀도 — spread 계산 결과 rounding 불일치 | `round(v_price * 1.001, 4)`로 spread 계산 시점에 명시적 반올림 — 모든 downstream column이 동일 값 |
| `place_market_order` 재정의가 기존 매수자 `holdings.avg_cost` 변경 (regression) | 정규장은 spread 0 → `v_exec_price === v_price` → 기존 동작 동일. NXT 시간 매수만 다름 (그것이 의도) |
| E2E가 NXT 시간 외엔 항상 SKIP — CI에서 효용 낮음 | midpoint-order.spec.ts의 두 번째 테스트는 정규장에 동작. 합쳐서 평일 거의 모든 시간 cover |
| client-side getKrSession은 사용자 로컬 TZ 기준 — server와 다를 위험 | `lib/market-hours.ts`가 `new Date().getTime() + 9h`로 강제 KST 정규화. UTC 기준 계산. ✅ |
| PG `_kr_nxt_session(now())` — DB 컨테이너 TZ가 UTC인지 확인 필요 | Supabase Cloud는 UTC 기본. `now()`는 timestamptz 반환이므로 `at time zone 'Asia/Seoul'`로 안전 변환 |
| midpoint USD 종목 시도 시 KRW에서만 차감 — 버그 가능 | `place_midpoint_order`에 `v_market not like 'KRX_%'` 가드 + `midpoint_us_not_supported` 에러 |
| 시뮬 spread 10 bps이 너무 낮거나 높을 수 있음 | 현재는 명목값. v1.5에서 유동성 티어별 동적 spread로 확장 가능 |

---

## Completion Criteria

- ✅ `supabase db reset` 성공 — 마이그 1개 적용 + helper/RPC 생성 확인
- ✅ `/api/orders` route — POST `{type: "midpoint"}` 정상 호출
- ✅ OrderForm — NXT pre/after에 "미드포인트" 활성, 정규장에 비활성
- ✅ `NxtSpreadBadge` — NXT 시간에 표시, 정규장/주말에 숨김
- ✅ build clean + lint clean
- ✅ midpoint E2E SKIP/PASS — 시간대 의존이지만 게이팅 명확
- ✅ master 머지 + Supabase Cloud 마이그 + Vercel 배포
