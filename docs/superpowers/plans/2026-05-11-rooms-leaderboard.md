# YGinvest Plan #5 — Rooms & Leaderboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 사용자가 친구방을 만들거나 초대 코드로 가입하면 별도 포트폴리오가 자동 생성되고 그 안에서 매매·환전한다. 글로벌 + 방별 리더보드에 누적 수익률이 표시되며 워커가 5분마다 스냅샷을 기록.

**Architecture:** `rooms` + `room_members` + `portfolio_snapshots` 3개 테이블 추가. PG 함수로 atomic 방 생성/가입 (가입 시 새 portfolio 행 + 시작자금 + FX rate 스냅샷). 워커가 5분 주기로 모든 활성 포트폴리오 가치 계산하여 `portfolio_snapshots`에 기록 + 1분 주기로 방 status 전이(open→active→ended). 클라이언트는 쿠키 기반 포트폴리오 컨텍스트 스위처로 어느 포트폴리오에서 거래/조회 중인지 결정.

**Tech Stack 추가:** 쿠키 기반 portfolio context · Postgres window functions (리더보드 ranking) · materialized views (글로벌 리더보드 캐시는 v2)

---

## 사전 요구사항

- Plan #1-4.5 완료, master 머지됨, 클라우드 배포됨
- Local Supabase + Docker 가동
- 워커 가동 가능

---

## 핵심 설계 결정

### 1. 포트폴리오 컨텍스트 (선택된 portfolio_id)

- 쿠키 이름: `yginvest_portfolio`
- 기본값: 사용자의 글로벌 포트폴리오 (`room_id IS NULL`)
- 모든 거래 페이지는 이 컨텍스트를 따름
- 헤더의 PortfolioSwitcher 드롭다운으로 변경 시 쿠키 set + reload

### 2. 방 라이프사이클

- `open`: 호스트가 만든 직후. starts_at 도달 전. 멤버 가입 가능.
- `active`: starts_at 도달 → 워커가 자동 전이. 거래 가능. 멤버 가입은 late_join_until 까지 허용 (NULL=무제한).
- `ended`: ends_at 도달 (NULL이면 자동 안 됨, 호스트 수동 종료 v1.5) → 워커가 자동 전이. 거래 잠금. 모든 멤버 portfolio.status='ended' 일괄.

v1에선 호스트의 수동 end는 미지원, 자동 ends_at만. 무제한 방은 v1에서 호스트가 종료 안 시키면 영원히 active.

### 3. 가입 시 portfolio 자동 생성

`join_room(invite_code)` PG 함수가:
1. 방 검증 (open 또는 active이면서 late_join_until 안 지남)
2. portfolios 행 INSERT (user_id, room_id, starting_krw=room.starting_krw, starting_usd=room.starting_usd, fx_rate_at_start=현재 USD→KRW)
3. room_members 행 INSERT
4. notification_settings는 글로벌 가입 트리거에서 이미 처리되어 있음 (v1)

### 4. 리더보드 계산

각 portfolio의 최신 snapshot에서 total_value_krw + return_pct 추출 →
- 글로벌: portfolios where room_id IS NULL
- 방별: portfolios where room_id = X

ORDER BY return_pct DESC, LIMIT N.

### 5. 스냅샷 계산식

```
total_value_krw =
    krw_balance
  + usd_balance * current_fx
  + Σ(KR 보유: quantity × stocks.last_price)
  + Σ(US 보유: quantity × stocks.last_price × current_fx)

starting_krw_eq = starting_krw + starting_usd * fx_rate_at_start

return_pct = (total_value_krw - starting_krw_eq) / starting_krw_eq * 100
```

워커가 5분 주기로 모든 active portfolios 대상으로 PG 함수 호출.

---

## 파일 구조 (이 plan에서 추가/수정)

```
supabase/migrations/
  20260511000001_rooms.sql                          (NEW)
  20260511000002_room_members.sql                   (NEW)
  20260511000003_portfolio_snapshots.sql            (NEW)
  20260511000004_room_rls_extensions.sql            (NEW: portfolios+holdings RLS 멤버 가시성)
  20260511000005_fn_create_room.sql                 (NEW)
  20260511000006_fn_join_room.sql                   (NEW)
  20260511000007_fn_transition_room_lifecycle.sql   (NEW: worker-only)
  20260511000008_fn_compute_portfolio_value.sql     (NEW)

apps/worker/src/ygworker/
  jobs/
    portfolio_snapshot.py                            (NEW)
    room_lifecycle.py                                (NEW)
  main.py                                            (MODIFY: 새 잡 2개 추가)
  tests/
    test_jobs_portfolio_snapshot.py                  (NEW)
    test_jobs_room_lifecycle.py                      (NEW)
    test_room_functions.py                           (NEW: 통합 테스트)

apps/web/
  app/api/
    rooms/route.ts                                   (NEW: POST 생성, GET 내 방 목록)
    rooms/[id]/route.ts                              (NEW: GET 상세)
    rooms/join/route.ts                              (NEW: POST invite code 가입)
    leaderboard/global/route.ts                      (NEW: GET)
    leaderboard/rooms/[id]/route.ts                  (NEW: GET)
  app/app/
    rooms/page.tsx                                   (NEW: 내 방 목록 + 만들기/가입 버튼)
    rooms/new/page.tsx                               (NEW: 방 생성 폼)
    rooms/join/page.tsx                              (NEW: invite code 입력)
    rooms/[id]/page.tsx                              (NEW: 방 상세 + 리더보드)
    leaderboard/page.tsx                             (NEW: 글로벌 리더보드)
    layout.tsx                                       (MODIFY: PortfolioSwitcher 헤더 추가)
    dashboard/page.tsx                               (MODIFY: 방 + 리더보드 링크)
    trade/[symbol]/page.tsx                          (MODIFY: 선택된 portfolio 사용)
    portfolio/overview/page.tsx                      (MODIFY: 선택된 portfolio)
    portfolio/holdings/page.tsx                      (MODIFY)
    portfolio/orders/page.tsx                        (MODIFY)
    portfolio/transactions/page.tsx                  (MODIFY)
    fx/page.tsx                                      (MODIFY: 선택된 portfolio)
    watchlist/page.tsx                               (MODIFY)
  components/
    portfolio-switcher.tsx                           (NEW: 헤더 드롭다운)
    room-create-form.tsx                             (NEW)
    room-join-form.tsx                               (NEW)
    leaderboard-table.tsx                            (NEW: 공용 테이블)
    invite-code-display.tsx                          (NEW: 복사 버튼 포함)
  lib/
    portfolio-context.ts                             (NEW: 쿠키 기반 선택된 portfolio_id)
  tests/e2e/
    rooms-flow.spec.ts                               (NEW: 2-계정 방 플로우)

README.md                                            (MODIFY)
```

---

## 사전 정리

기존 `app/(app)/layout.tsx`에는 PortfolioSwitcher 자리가 없으므로 추가해야 함. 거래 페이지 7개 (trade detail, portfolio×3, fx, watchlist, dashboard portfolio 카드)는 모두 `eq("user_id", user.id).is("room_id", null)` 패턴으로 글로벌 포트폴리오를 직접 조회 중. 이걸 헬퍼 `getSelectedPortfolioId(supabase)`로 통합.

---

## Task 1: 환경 점검

- [ ] **Step 1: 브랜치 + Supabase + 워커 확인**

```bash
git branch --show-current   # plan-5-rooms-leaderboard
supabase status
cd apps/worker && PYTHONPATH=src PYTHONUTF8=1 uv run python -m ygworker.main &
curl -s http://localhost:8080/health
```

---

## Task 2: Migration — rooms 테이블

**Files:**
- Create: `supabase/migrations/20260511000001_rooms.sql`

- [ ] **Step 1: 마이그레이션**

```sql
create table public.rooms (
  id uuid primary key default gen_random_uuid(),
  host_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  invite_code text not null unique,
  starting_krw numeric(20,4) not null check (starting_krw >= 0),
  starting_usd numeric(20,4) not null default 0 check (starting_usd >= 0),
  starts_at timestamptz not null default now(),
  ends_at timestamptz,                              -- NULL = 무제한
  late_join_until timestamptz,                      -- NULL = 무기한 가입 허용
  max_members int not null default 10 check (max_members >= 2 and max_members <= 50),
  status text not null default 'open' check (status in ('open', 'active', 'ended')),
  created_at timestamptz not null default now()
);

create index rooms_host_idx on public.rooms (host_id, created_at desc);
create index rooms_invite_code_idx on public.rooms (invite_code) where status <> 'ended';
create index rooms_status_idx on public.rooms (status, starts_at, ends_at);

comment on table public.rooms is '친구방. 호스트가 starting_krw/usd, starts_at, ends_at 자유 설정';
```

- [ ] **Step 2: 적용 + 커밋**

```bash
supabase db reset
git add supabase/migrations/20260511000001_rooms.sql
git commit -m "feat(db): add rooms table"
```

---

## Task 3: Migration — room_members + portfolio_snapshots

**Files:**
- Create: `supabase/migrations/20260511000002_room_members.sql`
- Create: `supabase/migrations/20260511000003_portfolio_snapshots.sql`

- [ ] **Step 1: room_members**

```sql
-- supabase/migrations/20260511000002_room_members.sql
create table public.room_members (
  room_id uuid not null references public.rooms(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  portfolio_id uuid not null references public.portfolios(id) on delete cascade unique,
  joined_at timestamptz not null default now(),
  primary key (room_id, user_id)
);

create index room_members_user_idx on public.room_members (user_id, joined_at desc);
create index room_members_room_idx on public.room_members (room_id, joined_at);

comment on table public.room_members is '방 멤버십. portfolio_id는 사용자의 방별 포트폴리오';
```

- [ ] **Step 2: portfolio_snapshots**

```sql
-- supabase/migrations/20260511000003_portfolio_snapshots.sql
create table public.portfolio_snapshots (
  portfolio_id uuid not null references public.portfolios(id) on delete cascade,
  ts timestamptz not null,
  total_value_krw numeric(20,4) not null,
  return_pct numeric(10,4) not null,
  primary key (portfolio_id, ts)
);

create index portfolio_snapshots_latest_idx
  on public.portfolio_snapshots (portfolio_id, ts desc);

alter table public.portfolio_snapshots enable row level security;

create policy "snapshots: 본인 + 방 멤버 읽기"
  on public.portfolio_snapshots for select
  to authenticated
  using (
    portfolio_id in (
      select id from public.portfolios where user_id = auth.uid()
    )
    or portfolio_id in (
      select rm.portfolio_id
      from public.room_members rm
      where rm.room_id in (
        select room_id from public.room_members where user_id = auth.uid()
      )
    )
  );

comment on table public.portfolio_snapshots is '5분 주기 포트폴리오 가치 시계열. 리더보드 + 차트용';
```

- [ ] **Step 3: 적용 + 커밋**

```bash
supabase db reset
git add supabase/migrations/20260511000002_room_members.sql supabase/migrations/20260511000003_portfolio_snapshots.sql
git commit -m "feat(db): add room_members + portfolio_snapshots tables"
```

---

## Task 4: Migration — RLS extensions for room visibility

기존 RLS는 portfolios/holdings를 본인만 SELECT 가능. 방 멤버 가시성 추가.

**Files:**
- Create: `supabase/migrations/20260511000004_room_rls_extensions.sql`

- [ ] **Step 1: 마이그레이션**

```sql
-- rooms RLS
alter table public.rooms enable row level security;

create policy "rooms: 멤버 읽기"
  on public.rooms for select
  to authenticated
  using (
    host_id = auth.uid()
    or id in (select room_id from public.room_members where user_id = auth.uid())
  );

-- room_members RLS
alter table public.room_members enable row level security;

create policy "room_members: 같은 방 멤버 읽기"
  on public.room_members for select
  to authenticated
  using (
    user_id = auth.uid()
    or room_id in (select room_id from public.room_members where user_id = auth.uid())
  );

-- portfolios SELECT 정책 확장: 같은 방 멤버 가시성
-- 기존 정책 "portfolios: 본인 읽기" 그대로 두고 추가 정책 OR로 결합
create policy "portfolios: 같은 방 멤버 읽기"
  on public.portfolios for select
  to authenticated
  using (
    room_id is not null
    and room_id in (select room_id from public.room_members where user_id = auth.uid())
  );

-- holdings SELECT 정책 확장: 같은 방 멤버 가시성
create policy "holdings: 같은 방 멤버 읽기"
  on public.holdings for select
  to authenticated
  using (
    portfolio_id in (
      select id from public.portfolios
      where room_id is not null
        and room_id in (select room_id from public.room_members where user_id = auth.uid())
    )
  );
```

- [ ] **Step 2: 적용 + 커밋**

```bash
supabase db reset
git add supabase/migrations/20260511000004_room_rls_extensions.sql
git commit -m "feat(db): RLS — room members can see each others' portfolios + holdings"
```

---

## Task 5: PG function — create_room

**Files:**
- Create: `supabase/migrations/20260511000005_fn_create_room.sql`

- [ ] **Step 1: 마이그레이션**

```sql
-- 6자 영숫자 invite code 생성 헬퍼 (uppercase 알파벳 + 숫자, 0/O/1/I 제외 가독성)
create or replace function public._gen_invite_code()
returns text
language plpgsql
volatile
as $$
declare
  charset text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  result text := '';
  i int;
begin
  for i in 1..6 loop
    result := result || substr(charset, 1 + (random() * (length(charset) - 1))::int, 1);
  end loop;
  return result;
end;
$$;

create or replace function public.create_room(
  p_name text,
  p_starting_krw numeric,
  p_starting_usd numeric,
  p_starts_at timestamptz,
  p_ends_at timestamptz,
  p_max_members int,
  p_late_join_until timestamptz
) returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_room_id uuid;
  v_invite_code text;
  v_attempts int := 0;
  v_active_count int;
begin
  if v_user_id is null then
    raise exception 'unauthenticated';
  end if;
  if p_starting_krw < 0 or p_starting_usd < 0 then
    raise exception 'invalid_starting_amounts';
  end if;
  if p_starts_at < now() - interval '1 day' then
    raise exception 'starts_at_too_old';
  end if;
  if p_ends_at is not null and p_ends_at <= p_starts_at then
    raise exception 'ends_at_before_starts_at';
  end if;
  if p_max_members < 2 or p_max_members > 50 then
    raise exception 'invalid_max_members';
  end if;

  -- 호스트 활성 방 5개 제한
  select count(*) into v_active_count
  from rooms
  where host_id = v_user_id and status in ('open', 'active');
  if v_active_count >= 5 then
    raise exception 'host_room_limit_exceeded';
  end if;

  -- invite_code 중복 회피 (드물지만)
  loop
    v_invite_code := _gen_invite_code();
    v_attempts := v_attempts + 1;
    exit when not exists (select 1 from rooms where invite_code = v_invite_code and status <> 'ended');
    if v_attempts >= 10 then
      raise exception 'invite_code_collision';
    end if;
  end loop;

  insert into rooms (
    host_id, name, invite_code, starting_krw, starting_usd,
    starts_at, ends_at, max_members, late_join_until,
    status
  ) values (
    v_user_id, p_name, v_invite_code, p_starting_krw, p_starting_usd,
    p_starts_at, p_ends_at, p_max_members, p_late_join_until,
    case when p_starts_at <= now() then 'active' else 'open' end
  ) returning id into v_room_id;

  return json_build_object(
    'room_id', v_room_id,
    'invite_code', v_invite_code
  );
end;
$$;

revoke all on function _gen_invite_code() from public;
grant execute on function _gen_invite_code() to authenticated, service_role;
revoke all on function create_room(text, numeric, numeric, timestamptz, timestamptz, int, timestamptz) from public;
grant execute on function create_room(text, numeric, numeric, timestamptz, timestamptz, int, timestamptz) to authenticated;
```

- [ ] **Step 2: 적용 + 커밋**

```bash
supabase db reset
git add supabase/migrations/20260511000005_fn_create_room.sql
git commit -m "feat(db): create_room PG function with invite code + host limit (5)"
```

---

## Task 6: PG function — join_room

**Files:**
- Create: `supabase/migrations/20260511000006_fn_join_room.sql`

- [ ] **Step 1: 마이그레이션**

```sql
create or replace function public.join_room(p_invite_code text)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_room rooms%rowtype;
  v_member_count int;
  v_existing_member_count int;
  v_active_room_count int;
  v_fx_rate numeric;
  v_portfolio_id uuid;
begin
  if v_user_id is null then
    raise exception 'unauthenticated';
  end if;

  -- 방 잠금 + 검증
  select * into v_room
  from rooms
  where invite_code = p_invite_code and status <> 'ended'
  for update;
  if not found then
    raise exception 'room_not_found_or_ended';
  end if;
  if v_room.late_join_until is not null and v_room.late_join_until < now() then
    raise exception 'late_join_closed';
  end if;

  -- 이미 멤버?
  select count(*) into v_existing_member_count
  from room_members
  where room_id = v_room.id and user_id = v_user_id;
  if v_existing_member_count > 0 then
    raise exception 'already_member';
  end if;

  -- max_members 체크
  select count(*) into v_member_count
  from room_members
  where room_id = v_room.id;
  if v_member_count >= v_room.max_members then
    raise exception 'room_full';
  end if;

  -- 사용자 동시 가입 방 10개 제한
  select count(*) into v_active_room_count
  from room_members rm
  join rooms r on r.id = rm.room_id
  where rm.user_id = v_user_id and r.status <> 'ended';
  if v_active_room_count >= 10 then
    raise exception 'user_room_limit_exceeded';
  end if;

  -- 현재 USD/KRW
  select rate into v_fx_rate
  from fx_rates where base = 'USD' and quote = 'KRW'
  order by ts desc limit 1;
  if v_fx_rate is null then
    v_fx_rate := 1395;  -- 폴백
  end if;

  -- portfolio 생성
  insert into portfolios (
    user_id, room_id, starting_krw, starting_usd, fx_rate_at_start,
    krw_balance, usd_balance, status
  ) values (
    v_user_id, v_room.id, v_room.starting_krw, v_room.starting_usd, v_fx_rate,
    v_room.starting_krw, v_room.starting_usd, 'active'
  ) returning id into v_portfolio_id;

  -- room_members 추가
  insert into room_members (room_id, user_id, portfolio_id)
  values (v_room.id, v_user_id, v_portfolio_id);

  return json_build_object(
    'room_id', v_room.id,
    'portfolio_id', v_portfolio_id,
    'starting_krw', v_room.starting_krw,
    'starting_usd', v_room.starting_usd,
    'fx_rate_at_start', v_fx_rate
  );
end;
$$;

revoke all on function join_room(text) from public;
grant execute on function join_room(text) to authenticated;
```

NOTE: 호스트도 본인 방에 join_room 호출하면 자동으로 멤버 + portfolio 가짐. 방 만들고 따로 join 해야 함 (단순화).

- [ ] **Step 2: 적용 + 커밋**

```bash
supabase db reset
git add supabase/migrations/20260511000006_fn_join_room.sql
git commit -m "feat(db): join_room PG function (creates portfolio + member row + FX snapshot)"
```

---

## Task 7: PG function — transition_room_lifecycle (worker-only)

**Files:**
- Create: `supabase/migrations/20260511000007_fn_transition_room_lifecycle.sql`

- [ ] **Step 1: 마이그레이션**

```sql
-- worker-only function: opens scheduled rooms, ends expired rooms.
-- For ended rooms: cascades portfolios to 'ended', refunds reserved BUY balances,
-- then cancels pending orders. The refund preserves leaderboard accuracy
-- because total_value_krw includes krw_balance + usd_balance.
create or replace function public.transition_room_lifecycle()
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_opened int := 0;
  v_ended int := 0;
  v_ended_room_ids uuid[];
begin
  -- 1) open → active (starts_at 도달한 방 활성화)
  update rooms set status = 'active'
  where status = 'open' and starts_at <= now();
  get diagnostics v_opened = row_count;

  -- 2) active → ended (ends_at 도달한 방 종료) — CTE + array_agg로 IDs 수집
  --    plpgsql `RETURNING ... INTO var`는 단일 행만 받으므로 CTE로 감싸 array_agg 필요.
  with ended as (
    update rooms set status = 'ended'
    where status = 'active' and ends_at is not null and ends_at <= now()
    returning id
  )
  select coalesce(array_agg(id), array[]::uuid[]) into v_ended_room_ids from ended;

  v_ended := coalesce(array_length(v_ended_room_ids, 1), 0);

  if v_ended > 0 then
    -- 3) 종료된 방의 모든 멤버 portfolio: status='ended', ended_at=now()
    update portfolios
    set status = 'ended', ended_at = now()
    where room_id = any(v_ended_room_ids) and status = 'active';

    -- 4) 펜딩 BUY 주문의 reserved_amount 환원 (정합성 — 리더보드 최종 순위에 반영)
    --    SELL은 reserved_amount IS NULL이라 cash 환원 불필요.
    --    cancel_order는 auth.uid()를 요구하므로 service_role에서 못 씀 → raw update.
    update portfolios p
    set
      krw_balance = p.krw_balance + sub.refund_krw,
      usd_balance = p.usd_balance + sub.refund_usd
    from (
      select
        o.portfolio_id,
        coalesce(sum(case when o.reserved_currency = 'KRW' then o.reserved_amount else 0 end), 0) as refund_krw,
        coalesce(sum(case when o.reserved_currency = 'USD' then o.reserved_amount else 0 end), 0) as refund_usd
      from orders o
      where o.status = 'pending'
        and o.reserved_amount is not null
        and o.portfolio_id in (
          select id from portfolios where room_id = any(v_ended_room_ids)
        )
      group by o.portfolio_id
    ) sub
    where p.id = sub.portfolio_id;

    -- 5) 펜딩 주문 일괄 cancelled
    update orders
    set status = 'cancelled', cancelled_at = now()
    where status = 'pending'
      and portfolio_id in (
        select id from portfolios where room_id = any(v_ended_room_ids)
      );
  end if;

  return json_build_object(
    'opened', v_opened,
    'ended', v_ended
  );
end;
$$;

-- service_role 전용 (워커 cron만 호출)
revoke all on function transition_room_lifecycle() from public;
grant execute on function transition_room_lifecycle() to service_role;
```

NOTE: 환원은 portfolios.status='ended' 직전 시점에 수행되므로 최종 portfolio_snapshot이 정확한 잔고로 기록됨 (리더보드 순위 정합성 ↑).

- [ ] **Step 2: 적용 + 커밋**

```bash
supabase db reset
git add supabase/migrations/20260511000007_fn_transition_room_lifecycle.sql
git commit -m "feat(db): transition_room_lifecycle (worker-only, open→active→ended cascade)"
```

---

## Task 8: PG function — compute_portfolio_value

**Files:**
- Create: `supabase/migrations/20260511000008_fn_compute_portfolio_value.sql`

- [ ] **Step 1: 마이그레이션**

```sql
create or replace function public.compute_portfolio_value(p_portfolio_id uuid)
returns json
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_p portfolios%rowtype;
  v_fx numeric;
  v_holdings_value_krw numeric := 0;
  v_total_value_krw numeric;
  v_starting_krw_eq numeric;
  v_return_pct numeric;
begin
  select * into v_p from portfolios where id = p_portfolio_id;
  if not found then
    raise exception 'portfolio_not_found';
  end if;

  -- 현재 USD/KRW
  select rate into v_fx
  from fx_rates where base = 'USD' and quote = 'KRW'
  order by ts desc limit 1;
  if v_fx is null then
    v_fx := v_p.fx_rate_at_start;  -- 폴백
  end if;

  -- 보유 평가금 (KRW 환산)
  select coalesce(sum(
    case
      when s.currency = 'KRW' then h.quantity * coalesce(s.last_price, 0)
      else h.quantity * coalesce(s.last_price, 0) * v_fx
    end
  ), 0) into v_holdings_value_krw
  from holdings h
  join stocks s on s.symbol = h.symbol
  where h.portfolio_id = p_portfolio_id;

  v_total_value_krw :=
    v_p.krw_balance + v_p.usd_balance * v_fx + v_holdings_value_krw;

  v_starting_krw_eq :=
    v_p.starting_krw + v_p.starting_usd * v_p.fx_rate_at_start;

  v_return_pct := case
    when v_starting_krw_eq > 0 then
      (v_total_value_krw - v_starting_krw_eq) / v_starting_krw_eq * 100
    else 0
  end;

  return json_build_object(
    'portfolio_id', p_portfolio_id,
    'total_value_krw', v_total_value_krw,
    'return_pct', v_return_pct,
    'fx_rate', v_fx
  );
end;
$$;

-- service_role 전용: 클라이언트는 portfolio_snapshots 테이블을 직접 SELECT (RLS로 멤버 가시성 보호).
-- 실시간 재계산은 워커의 5분 snapshot 잡에서만 호출. 임의 사용자가 임의 portfolio 평가금을
-- 조회하지 못하도록 authenticated 권한은 부여하지 않음.
revoke all on function compute_portfolio_value(uuid) from public;
grant execute on function compute_portfolio_value(uuid) to service_role;
```

- [ ] **Step 2: 적용 + 커밋**

```bash
supabase db reset
git add supabase/migrations/20260511000008_fn_compute_portfolio_value.sql
git commit -m "feat(db): compute_portfolio_value (KRW total + return %)"
```

---

## Task 9: Worker — portfolio_snapshot 잡 (TDD)

**Files:**
- Create: `apps/worker/src/ygworker/jobs/portfolio_snapshot.py`
- Create: `apps/worker/tests/test_jobs_portfolio_snapshot.py`

- [ ] **Step 1: 실패 테스트**

```python
from datetime import UTC, datetime
from unittest.mock import MagicMock

from ygworker.jobs.portfolio_snapshot import run_portfolio_snapshot


def test_snapshot_records_for_each_active_portfolio():
    fake = MagicMock()
    portfolios_data = [
        {"id": "p1"},
        {"id": "p2"},
    ]
    fake.table.return_value.select.return_value.eq.return_value.execute.return_value.data = portfolios_data
    fake.rpc.return_value.execute.side_effect = [
        MagicMock(data={"total_value_krw": 100_000_000.0, "return_pct": 0.0}),
        MagicMock(data={"total_value_krw": 120_000_000.0, "return_pct": 20.0}),
    ]
    logger = MagicMock()

    run_portfolio_snapshot(fake, logger)

    insert_call = fake.table.return_value.insert.call_args
    rows = insert_call.args[0] if insert_call.args else []
    assert len(rows) == 2
    assert rows[0]["portfolio_id"] == "p1"
    assert float(rows[0]["total_value_krw"]) == 100_000_000.0
    assert float(rows[1]["return_pct"]) == 20.0


def test_snapshot_skips_when_no_active():
    fake = MagicMock()
    fake.table.return_value.select.return_value.eq.return_value.execute.return_value.data = []
    logger = MagicMock()

    run_portfolio_snapshot(fake, logger)

    fake.rpc.assert_not_called()
    logger.info.assert_called_with("portfolio_snapshot.skip", reason="no_active_portfolios")


def test_snapshot_continues_on_compute_error():
    fake = MagicMock()
    fake.table.return_value.select.return_value.eq.return_value.execute.return_value.data = [
        {"id": "p1"},
        {"id": "p2"},
    ]
    fake.rpc.return_value.execute.side_effect = [
        MagicMock(data={"total_value_krw": 100.0, "return_pct": 0.0}),
        RuntimeError("compute failed"),
    ]
    logger = MagicMock()

    run_portfolio_snapshot(fake, logger)

    insert_call = fake.table.return_value.insert.call_args
    rows = insert_call.args[0] if insert_call.args else []
    assert len(rows) == 1
    assert rows[0]["portfolio_id"] == "p1"
    logger.error.assert_called()
```

- [ ] **Step 2: 구현**

```python
from datetime import UTC, datetime
from typing import Any


def run_portfolio_snapshot(supabase: Any, logger: Any) -> None:
    """5분 주기. 모든 active portfolio의 가치 계산 + portfolio_snapshots에 기록."""
    portfolios = (
        supabase.table("portfolios")
        .select("id")
        .eq("status", "active")
        .execute()
        .data
    )
    if not portfolios:
        logger.info("portfolio_snapshot.skip", reason="no_active_portfolios")
        return

    logger.info("portfolio_snapshot.start", count=len(portfolios))
    now_iso = datetime.now(UTC).isoformat()
    rows: list[dict] = []
    failed = 0

    for p in portfolios:
        try:
            result = supabase.rpc("compute_portfolio_value", {"p_portfolio_id": p["id"]}).execute()
            data = result.data if hasattr(result, "data") else result
            rows.append({
                "portfolio_id": p["id"],
                "ts": now_iso,
                "total_value_krw": data["total_value_krw"],
                "return_pct": data["return_pct"],
            })
        except Exception as exc:
            failed += 1
            logger.error("portfolio_snapshot.compute_failed", portfolio_id=p["id"], error=str(exc))

    if rows:
        try:
            supabase.table("portfolio_snapshots").insert(rows).execute()
        except Exception as exc:
            logger.error("portfolio_snapshot.insert_failed", error=str(exc))
            return

    logger.info("portfolio_snapshot.done", inserted=len(rows), failed=failed)
```

- [ ] **Step 3: 테스트 통과 + 커밋**

```bash
cd apps/worker && uv run pytest tests/test_jobs_portfolio_snapshot.py -v
git add apps/worker/src/ygworker/jobs/portfolio_snapshot.py apps/worker/tests/test_jobs_portfolio_snapshot.py
git commit -m "feat(worker): portfolio_snapshot job (TDD, 3 tests)"
```

---

## Task 10: Worker — room_lifecycle 잡 (TDD)

**Files:**
- Create: `apps/worker/src/ygworker/jobs/room_lifecycle.py`
- Create: `apps/worker/tests/test_jobs_room_lifecycle.py`

- [ ] **Step 1: 실패 테스트**

```python
from unittest.mock import MagicMock

from ygworker.jobs.room_lifecycle import run_room_lifecycle


def test_room_lifecycle_calls_transition_rpc():
    fake = MagicMock()
    fake.rpc.return_value.execute.return_value = MagicMock(data={"opened": 2, "ended": 1})
    logger = MagicMock()

    run_room_lifecycle(fake, logger)

    fake.rpc.assert_called_with("transition_room_lifecycle", {})
    logger.info.assert_called_with("room_lifecycle.done", opened=2, ended=1)


def test_room_lifecycle_handles_no_changes():
    fake = MagicMock()
    fake.rpc.return_value.execute.return_value = MagicMock(data={"opened": 0, "ended": 0})
    logger = MagicMock()

    run_room_lifecycle(fake, logger)

    logger.info.assert_called_with("room_lifecycle.done", opened=0, ended=0)


def test_room_lifecycle_logs_error_on_failure():
    fake = MagicMock()
    fake.rpc.return_value.execute.side_effect = RuntimeError("DB error")
    logger = MagicMock()

    run_room_lifecycle(fake, logger)

    logger.error.assert_called()
```

- [ ] **Step 2: 구현**

```python
from typing import Any


def run_room_lifecycle(supabase: Any, logger: Any) -> None:
    """1분 주기. open→active, active→ended 전이를 PG 함수로 위임."""
    try:
        result = supabase.rpc("transition_room_lifecycle", {}).execute()
        data = result.data if hasattr(result, "data") else result
        logger.info(
            "room_lifecycle.done",
            opened=data.get("opened", 0),
            ended=data.get("ended", 0),
        )
    except Exception as exc:
        logger.error("room_lifecycle.failed", error=str(exc))
```

- [ ] **Step 3: 테스트 + 커밋**

```bash
cd apps/worker && uv run pytest tests/test_jobs_room_lifecycle.py -v
git add apps/worker/src/ygworker/jobs/room_lifecycle.py apps/worker/tests/test_jobs_room_lifecycle.py
git commit -m "feat(worker): room_lifecycle job (TDD, 3 tests)"
```

---

## Task 11: Worker main.py — 새 잡 2개 통합

**Files:**
- Modify: `apps/worker/src/ygworker/main.py`

- [ ] **Step 1: import + 스케줄 추가**

```python
from ygworker.jobs.portfolio_snapshot import run_portfolio_snapshot
from ygworker.jobs.room_lifecycle import run_room_lifecycle
```

기존 `scheduler.add_job(...)` 묶음에 추가:

```python
    # 5분 주기: 모든 active 포트폴리오 가치 스냅샷
    scheduler.add_job(
        _wrap_in_thread(run_portfolio_snapshot, supabase, logger),
        trigger="interval",
        minutes=5,
        id="portfolio_snapshot",
        replace_existing=True,
    )
    # 1분 주기: 방 status 전이 (open→active, active→ended)
    scheduler.add_job(
        _wrap_in_thread(run_room_lifecycle, supabase, logger),
        trigger="interval",
        minutes=1,
        id="room_lifecycle",
        replace_existing=True,
    )
```

- [ ] **Step 2: 부팅 검증**

```bash
cd apps/worker
PYTHONPATH=src PYTHONUTF8=1 timeout 8 uv run python -m ygworker.main 2>&1 | head -10
```
worker.scheduler_started 확인.

- [ ] **Step 3: 커밋**

```bash
git add apps/worker/src/ygworker/main.py
git commit -m "feat(worker): integrate portfolio_snapshot (5m) + room_lifecycle (1m) jobs"
```

---

## Task 12: 통합 테스트 — room flows

**Files:**
- Create: `apps/worker/tests/test_room_functions.py`

- [ ] **Step 1: 작성**

```python
"""Plan #5 PG 함수 통합 테스트."""

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


def _make_user(admin, cleanup_user) -> tuple[str, str]:
    email = f"room-{uuid.uuid4()}@test.com"
    res = admin.auth.admin.create_user(
        {"email": email, "password": "TestPass123!", "email_confirm": True}
    )
    cleanup_user.append(res.user.id)
    return res.user.id, email


def _user_client(email: str):
    url = os.environ["SUPABASE_URL"]
    anon_key = os.environ["SUPABASE_ANON_KEY"]
    c = create_client(url, anon_key)
    c.auth.sign_in_with_password({"email": email, "password": "TestPass123!"})
    return c


def _seed_fx(admin):
    admin.table("fx_rates").upsert(
        {"base": "USD", "quote": "KRW", "rate": 1400, "ts": datetime.now(UTC).isoformat()},
        on_conflict="base,quote,ts",
    ).execute()


def test_create_room_returns_invite_code(admin, cleanup_user):
    _seed_fx(admin)
    _, email = _make_user(admin, cleanup_user)
    c = _user_client(email)

    res = c.rpc("create_room", {
        "p_name": "Test Room",
        "p_starting_krw": 100_000_000,
        "p_starting_usd": 0,
        "p_starts_at": (datetime.now(UTC) + timedelta(hours=1)).isoformat(),
        "p_ends_at": (datetime.now(UTC) + timedelta(days=30)).isoformat(),
        "p_max_members": 10,
        "p_late_join_until": None,
    }).execute()
    body = res.data
    assert "room_id" in body
    assert "invite_code" in body
    assert len(body["invite_code"]) == 6


def test_join_room_creates_portfolio(admin, cleanup_user):
    _seed_fx(admin)
    _, host_email = _make_user(admin, cleanup_user)
    _, member_email = _make_user(admin, cleanup_user)

    host_c = _user_client(host_email)
    create = host_c.rpc("create_room", {
        "p_name": "Join Test",
        "p_starting_krw": 50_000_000,
        "p_starting_usd": 1000,
        "p_starts_at": datetime.now(UTC).isoformat(),
        "p_ends_at": None,
        "p_max_members": 5,
        "p_late_join_until": None,
    }).execute()
    invite_code = create.data["invite_code"]

    member_c = _user_client(member_email)
    join_res = member_c.rpc("join_room", {"p_invite_code": invite_code}).execute()
    body = join_res.data
    assert "portfolio_id" in body
    assert float(body["starting_krw"]) == 50_000_000
    assert float(body["starting_usd"]) == 1000

    # member의 room portfolio 검증
    member_user_id = admin.auth.get_user(member_c.auth.get_session().access_token).user.id
    room_pfl = (
        admin.table("portfolios")
        .select("*")
        .eq("user_id", member_user_id)
        .eq("id", body["portfolio_id"])
        .single()
        .execute()
        .data
    )
    assert room_pfl["status"] == "active"
    assert float(room_pfl["krw_balance"]) == 50_000_000


def test_join_room_invalid_code(admin, cleanup_user):
    _, email = _make_user(admin, cleanup_user)
    c = _user_client(email)
    with pytest.raises(APIError) as exc:
        c.rpc("join_room", {"p_invite_code": "ZZZZZZ"}).execute()
    assert "room_not_found" in str(exc.value)


def test_join_room_twice_rejects(admin, cleanup_user):
    _seed_fx(admin)
    _, host_email = _make_user(admin, cleanup_user)
    host_c = _user_client(host_email)
    create = host_c.rpc("create_room", {
        "p_name": "Dup",
        "p_starting_krw": 100,
        "p_starting_usd": 0,
        "p_starts_at": datetime.now(UTC).isoformat(),
        "p_ends_at": None,
        "p_max_members": 5,
        "p_late_join_until": None,
    }).execute()
    code = create.data["invite_code"]

    _, member_email = _make_user(admin, cleanup_user)
    member_c = _user_client(member_email)
    member_c.rpc("join_room", {"p_invite_code": code}).execute()
    with pytest.raises(APIError) as exc:
        member_c.rpc("join_room", {"p_invite_code": code}).execute()
    assert "already_member" in str(exc.value)


def test_compute_portfolio_value_returns_krw_and_pct(admin, cleanup_user):
    _seed_fx(admin)
    user_id, _ = _make_user(admin, cleanup_user)
    pfl = (
        admin.table("portfolios")
        .select("id")
        .eq("user_id", user_id)
        .is_("room_id", "null")
        .single()
        .execute()
        .data
    )
    res = admin.rpc("compute_portfolio_value", {"p_portfolio_id": pfl["id"]}).execute()
    body = res.data
    # 갓 가입한 글로벌 포트폴리오: KRW 1억, USD 0
    assert abs(float(body["total_value_krw"]) - 100_000_000) < 1
    assert abs(float(body["return_pct"])) < 0.01


def test_transition_room_lifecycle_opens_active_room(admin, cleanup_user):
    _seed_fx(admin)
    _, email = _make_user(admin, cleanup_user)
    c = _user_client(email)
    # starts_at 과거로 → status='active'로 바로 입력됨 (create_room이 즉시 active로)
    create = c.rpc("create_room", {
        "p_name": "Lifecycle Past",
        "p_starting_krw": 100,
        "p_starting_usd": 0,
        "p_starts_at": (datetime.now(UTC) - timedelta(minutes=5)).isoformat(),
        "p_ends_at": None,
        "p_max_members": 5,
        "p_late_join_until": None,
    }).execute()
    room_id = create.data["room_id"]
    row = admin.table("rooms").select("status").eq("id", room_id).single().execute().data
    assert row["status"] == "active"

    # 호출해도 active인 채로 유지 (open이 없으므로 opened=0)
    res = admin.rpc("transition_room_lifecycle", {}).execute()
    assert res.data["opened"] == 0
```

- [ ] **Step 2: 실행**

```bash
cd apps/worker && uv run pytest tests/test_room_functions.py -v
# Expected: 6 PASS
```

- [ ] **Step 3: 커밋**

```bash
git add apps/worker/tests/test_room_functions.py
git commit -m "test(db): integration tests for create_room/join_room/lifecycle/compute (6 scenarios)"
```

---

## Task 13: Web — lib/portfolio-context.ts

**Files:**
- Create: `apps/web/lib/portfolio-context.ts`

- [ ] **Step 1: 작성**

```typescript
import { cookies } from "next/headers";
import type { SupabaseClient } from "@supabase/supabase-js";

const COOKIE_NAME = "yginvest_portfolio";

/**
 * 사용자가 선택한 포트폴리오 ID 조회.
 * 우선순위:
 *   1. 쿠키에 있고 사용자의 포트폴리오 중 하나라면 그 값
 *   2. 없거나 검증 실패 → 글로벌 포트폴리오 (room_id IS NULL)
 *   3. 글로벌도 없음 → null
 */
export async function getSelectedPortfolioId(
  supabase: SupabaseClient,
  userId: string
): Promise<string | null> {
  const cookieStore = await cookies();
  const cookieVal = cookieStore.get(COOKIE_NAME)?.value;

  if (cookieVal) {
    // 쿠키 값 검증 — 사용자의 포트폴리오 중 하나여야
    const { data } = await supabase
      .from("portfolios")
      .select("id")
      .eq("id", cookieVal)
      .eq("user_id", userId)
      .maybeSingle();
    if (data) return data.id;
  }

  // 폴백: 글로벌
  const { data: global } = await supabase
    .from("portfolios")
    .select("id")
    .eq("user_id", userId)
    .is("room_id", null)
    .maybeSingle();
  return global?.id ?? null;
}

/**
 * 사용자의 모든 활성 포트폴리오 목록 (스위처용).
 */
export async function listUserPortfolios(supabase: SupabaseClient, userId: string) {
  const { data } = await supabase
    .from("portfolios")
    .select("id, room_id, status, rooms(name)")
    .eq("user_id", userId)
    .order("started_at", { ascending: true });
  return data ?? [];
}

export const PORTFOLIO_COOKIE_NAME = COOKIE_NAME;
```

- [ ] **Step 2: 커밋**

```bash
git add apps/web/lib/portfolio-context.ts
git commit -m "feat(web): portfolio-context lib (cookie-based selected portfolio)"
```

---

## Task 14: Web — PortfolioSwitcher 컴포넌트 + API

**Files:**
- Create: `apps/web/components/portfolio-switcher.tsx`
- Create: `apps/web/app/api/portfolio/select/route.ts`

- [ ] **Step 1: API 라우트 (쿠키 set)**

```typescript
// apps/web/app/api/portfolio/select/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { PORTFOLIO_COOKIE_NAME } from "@/lib/portfolio-context";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const portfolioId = body.portfolio_id;
  if (!portfolioId) return NextResponse.json({ error: "missing_portfolio_id" }, { status: 400 });

  // 검증: 사용자 본인의 포트폴리오인지
  const { data } = await supabase
    .from("portfolios")
    .select("id")
    .eq("id", portfolioId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!data) return NextResponse.json({ error: "portfolio_not_found" }, { status: 404 });

  const res = NextResponse.json({ ok: true, portfolio_id: portfolioId });
  res.cookies.set(PORTFOLIO_COOKIE_NAME, portfolioId, {
    path: "/",
    httpOnly: false,  // 클라이언트 JS에서도 읽을 일은 없지만 server에서만 사용
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 365,
  });
  return res;
}
```

- [ ] **Step 2: 컴포넌트**

```tsx
// apps/web/components/portfolio-switcher.tsx
"use client";

import { useTransition } from "react";

type Portfolio = {
  id: string;
  room_id: string | null;
  rooms: { name: string } | { name: string }[] | null;
};

type Props = {
  portfolios: Portfolio[];
  selectedId: string | null;
};

export function PortfolioSwitcher({ portfolios, selectedId }: Props) {
  const [isPending, startTransition] = useTransition();

  function onChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const portfolio_id = e.target.value;
    startTransition(async () => {
      const res = await fetch("/api/portfolio/select", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ portfolio_id }),
      });
      if (res.ok) {
        location.reload();
      }
    });
  }

  if (portfolios.length === 0) return null;

  return (
    <select
      className="bg-background border border-border rounded px-2 py-1 text-sm"
      value={selectedId ?? ""}
      onChange={onChange}
      disabled={isPending}
    >
      {portfolios.map((p) => {
        const room = Array.isArray(p.rooms) ? p.rooms[0] : p.rooms;
        const label = p.room_id ? `방: ${room?.name ?? p.room_id.slice(0, 6)}` : "글로벌";
        return (
          <option key={p.id} value={p.id}>
            {label}
          </option>
        );
      })}
    </select>
  );
}
```

- [ ] **Step 3: 커밋**

```bash
cd apps/web && npm run build && npx tsc --noEmit
git add apps/web/components/portfolio-switcher.tsx apps/web/app/api/portfolio/
git commit -m "feat(web): PortfolioSwitcher component + /api/portfolio/select cookie route"
```

---

## Task 15: Web — App shell layout 갱신 (PortfolioSwitcher 헤더)

**Files:**
- Modify: `apps/web/app/app/layout.tsx`

- [ ] **Step 1: PortfolioSwitcher 헤더 통합**

기존 `<header>` 안에 PortfolioSwitcher 추가. layout이 server component이므로 `getSelectedPortfolioId` + `listUserPortfolios`를 await 호출.

```tsx
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { LogoutButton } from "@/components/logout-button";
import { PortfolioSwitcher } from "@/components/portfolio-switcher";
import { getSelectedPortfolioId, listUserPortfolios } from "@/lib/portfolio-context";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name")
    .eq("id", user.id)
    .single();

  const [portfolios, selectedId] = await Promise.all([
    listUserPortfolios(supabase, user.id),
    getSelectedPortfolioId(supabase, user.id),
  ]);

  return (
    <div className="min-h-screen flex flex-col">
      <header className="flex items-center justify-between p-4 border-b border-border">
        <Link href="/app/dashboard" className="text-lg font-bold">YGinvest</Link>
        <div className="flex items-center gap-3">
          <PortfolioSwitcher portfolios={portfolios} selectedId={selectedId} />
          <span className="text-sm text-muted-foreground">{profile?.display_name ?? user.email}</span>
          <LogoutButton />
        </div>
      </header>
      <main className="flex-1">{children}</main>
    </div>
  );
}
```

(기존 layout 구조와 다를 수 있음 — 실제 파일 읽고 변경 부분만 적용. PortfolioSwitcher 추가 + Promise.all로 데이터 fetch가 핵심.)

- [ ] **Step 2: 빌드 + 커밋**

```bash
cd apps/web && npm run build
git add apps/web/app/app/layout.tsx
git commit -m "feat(web): integrate PortfolioSwitcher into app shell header"
```

---

## Task 16: Web — 거래 페이지들 + 워치리스트 API selected portfolio 사용

**Files:**
- Modify: `apps/web/app/app/trade/[symbol]/page.tsx`
- Modify: `apps/web/app/app/portfolio/overview/page.tsx`
- Modify: `apps/web/app/app/portfolio/holdings/page.tsx`
- Modify: `apps/web/app/app/portfolio/orders/page.tsx`
- Modify: `apps/web/app/app/portfolio/transactions/page.tsx`
- Modify: `apps/web/app/app/fx/page.tsx`
- Modify: `apps/web/app/app/watchlist/page.tsx`
- Modify: `apps/web/app/app/dashboard/page.tsx`
- Modify: `apps/web/app/api/watchlist/[symbol]/route.ts` (POST + DELETE: 헬퍼 `getGlobalPortfolioId` 제거하고 `getSelectedPortfolioId` 사용 — 방 컨텍스트에서 워치리스트 추가/삭제 시 방 portfolio에 적용)

NOTE: 다른 API 라우트(`/api/orders`, `/api/fx/exchange`, `/api/holdings`, `/api/trades` 등)는 클라이언트가 `portfolio_id`를 body/query로 명시적으로 전달하므로 변경 불필요. `place_market_order`/`place_limit_order`/`exchange_currency` PG 함수가 `auth.uid()`로 권한 검증함.

각 페이지 패턴:

기존:
```tsx
const { data: portfolio } = await supabase
  .from("portfolios")
  .select("id, ...")
  .eq("user_id", user.id)
  .is("room_id", null)
  .single();
```

변경:
```tsx
import { getSelectedPortfolioId } from "@/lib/portfolio-context";
// ...
const portfolioId = await getSelectedPortfolioId(supabase, user.id);
const { data: portfolio } = portfolioId ? await supabase
  .from("portfolios")
  .select("id, krw_balance, usd_balance, starting_krw, starting_usd, fx_rate_at_start, room_id, status")
  .eq("id", portfolioId)
  .single() : { data: null };
```

각 페이지의 holdings/orders/trades/transactions/watchlist 쿼리도 `portfolioId`로 필터:
```tsx
.eq("portfolio_id", portfolioId)
```

(이전엔 RLS로 own만 보였지만, 같은 사용자의 다른 포트폴리오 다 보였음. 이제 명시적 필터.)

- [ ] **Step 1: 각 페이지 모두 적용**

순서대로 8개 페이지 수정. 한 번에 다 처리.

- [ ] **Step 2: 빌드 + 커밋**

```bash
cd apps/web && npm run build && npx tsc --noEmit && npm run lint
git add apps/web/app/app/
git commit -m "feat(web): all trading pages use selected portfolio from cookie context"
```

---

## Task 17: Web — Web API: Rooms

**Files:**
- Create: `apps/web/app/api/rooms/route.ts`
- Create: `apps/web/app/api/rooms/[id]/route.ts`
- Create: `apps/web/app/api/rooms/join/route.ts`

- [ ] **Step 1: POST /api/rooms (생성) + GET (내 방 목록)**

```typescript
// apps/web/app/api/rooms/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const params = {
    p_name: body.name,
    p_starting_krw: body.starting_krw,
    p_starting_usd: body.starting_usd,
    p_starts_at: body.starts_at,
    p_ends_at: body.ends_at ?? null,
    p_max_members: body.max_members ?? 10,
    p_late_join_until: body.late_join_until ?? null,
  };
  const { data, error } = await supabase.rpc("create_room", params);
  if (error) return NextResponse.json({ error: error.message }, { status: 422 });
  return NextResponse.json(data);
}

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  // 내가 호스트이거나 멤버인 방
  const { data, error } = await supabase
    .from("rooms")
    .select("id, name, host_id, invite_code, starting_krw, starting_usd, starts_at, ends_at, max_members, status, created_at")
    .order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ rooms: data });
}
```

- [ ] **Step 2: GET /api/rooms/[id]**

```typescript
// apps/web/app/api/rooms/[id]/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  const { data: room } = await supabase
    .from("rooms").select("*").eq("id", id).maybeSingle();
  if (!room) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const { data: members } = await supabase
    .from("room_members")
    .select("user_id, portfolio_id, joined_at, profiles(display_name, avatar_url)")
    .eq("room_id", id);

  return NextResponse.json({ room, members: members ?? [] });
}
```

- [ ] **Step 3: POST /api/rooms/join**

```typescript
// apps/web/app/api/rooms/join/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  if (!body.invite_code) return NextResponse.json({ error: "missing_invite_code" }, { status: 400 });

  const { data, error } = await supabase.rpc("join_room", {
    p_invite_code: body.invite_code,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 422 });
  return NextResponse.json(data);
}
```

- [ ] **Step 4: 빌드 + 커밋**

```bash
cd apps/web && npm run build
git add apps/web/app/api/rooms/
git commit -m "feat(web): /api/rooms POST/GET + /api/rooms/[id] GET + /api/rooms/join POST"
```

---

## Task 18: Web API — Leaderboard

**Files:**
- Create: `apps/web/app/api/leaderboard/global/route.ts`
- Create: `apps/web/app/api/leaderboard/rooms/[id]/route.ts`

- [ ] **Step 1: 글로벌**

```typescript
// apps/web/app/api/leaderboard/global/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const limit = Number(searchParams.get("limit") ?? "100");

  // 각 글로벌 portfolio의 최신 snapshot
  // SQL: window function이 필요하지만 supabase-js로 단순 처리:
  // 1) 글로벌 portfolios 가져옴
  // 2) 각 id에 대해 최신 snapshot SELECT (N+1이지만 N≤100)
  // 더 간단: SQL view로 빼는게 정공이지만 v1은 in-app 처리
  const { data: portfolios } = await supabase
    .from("portfolios")
    .select("id, user_id, profiles(display_name, avatar_url)")
    .is("room_id", null)
    .eq("status", "active");
  if (!portfolios) return NextResponse.json({ leaderboard: [] });

  const ids = portfolios.map((p) => p.id);
  const { data: snapshots } = await supabase
    .from("portfolio_snapshots")
    .select("portfolio_id, total_value_krw, return_pct, ts")
    .in("portfolio_id", ids)
    .order("ts", { ascending: false });

  // portfolio별 latest snapshot
  const latest = new Map<string, { total: number; pct: number; ts: string }>();
  for (const s of snapshots ?? []) {
    if (!latest.has(s.portfolio_id)) {
      latest.set(s.portfolio_id, {
        total: Number(s.total_value_krw),
        pct: Number(s.return_pct),
        ts: s.ts,
      });
    }
  }

  const ranked = portfolios
    .map((p) => {
      const profile = Array.isArray(p.profiles) ? p.profiles[0] : p.profiles;
      const snap = latest.get(p.id);
      return {
        portfolio_id: p.id,
        display_name: profile?.display_name ?? "익명",
        avatar_url: profile?.avatar_url ?? null,
        total_value_krw: snap?.total ?? null,
        return_pct: snap?.pct ?? null,
        snapshot_ts: snap?.ts ?? null,
      };
    })
    .filter((r) => r.return_pct !== null)
    .sort((a, b) => (b.return_pct! - a.return_pct!))
    .slice(0, limit);

  return NextResponse.json({ leaderboard: ranked });
}
```

- [ ] **Step 2: 방별**

```typescript
// apps/web/app/api/leaderboard/rooms/[id]/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  // 방 멤버의 portfolio들
  const { data: members } = await supabase
    .from("room_members")
    .select("user_id, portfolio_id, profiles(display_name, avatar_url)")
    .eq("room_id", id);
  if (!members || members.length === 0) {
    return NextResponse.json({ leaderboard: [] });
  }

  const ids = members.map((m) => m.portfolio_id);
  const { data: snapshots } = await supabase
    .from("portfolio_snapshots")
    .select("portfolio_id, total_value_krw, return_pct, ts")
    .in("portfolio_id", ids)
    .order("ts", { ascending: false });

  const latest = new Map<string, { total: number; pct: number; ts: string }>();
  for (const s of snapshots ?? []) {
    if (!latest.has(s.portfolio_id)) {
      latest.set(s.portfolio_id, {
        total: Number(s.total_value_krw),
        pct: Number(s.return_pct),
        ts: s.ts,
      });
    }
  }

  const ranked = members
    .map((m) => {
      const profile = Array.isArray(m.profiles) ? m.profiles[0] : m.profiles;
      const snap = latest.get(m.portfolio_id);
      return {
        portfolio_id: m.portfolio_id,
        display_name: profile?.display_name ?? "익명",
        avatar_url: profile?.avatar_url ?? null,
        total_value_krw: snap?.total ?? null,
        return_pct: snap?.pct ?? null,
        snapshot_ts: snap?.ts ?? null,
      };
    })
    .sort((a, b) => ((b.return_pct ?? -Infinity) - (a.return_pct ?? -Infinity)));

  return NextResponse.json({ leaderboard: ranked });
}
```

- [ ] **Step 3: 빌드 + 커밋**

```bash
cd apps/web && npm run build
git add apps/web/app/api/leaderboard/
git commit -m "feat(web): /api/leaderboard/{global,rooms/[id]} GET (latest snapshot ranking)"
```

---

## Task 19: Web — Room 페이지들

**Files:**
- Create: `apps/web/app/app/rooms/page.tsx`
- Create: `apps/web/app/app/rooms/new/page.tsx`
- Create: `apps/web/app/app/rooms/join/page.tsx`
- Create: `apps/web/app/app/rooms/[id]/page.tsx`
- Create: `apps/web/components/room-create-form.tsx`
- Create: `apps/web/components/room-join-form.tsx`
- Create: `apps/web/components/leaderboard-table.tsx`
- Create: `apps/web/components/invite-code-display.tsx`

- [ ] **Step 1: 컴포넌트들**

`components/leaderboard-table.tsx`:

```tsx
type Entry = {
  portfolio_id: string;
  display_name: string;
  avatar_url: string | null;
  total_value_krw: number | null;
  return_pct: number | null;
  snapshot_ts: string | null;
};

const KRW = new Intl.NumberFormat("ko-KR", { style: "currency", currency: "KRW", maximumFractionDigits: 0 });

export function LeaderboardTable({ entries, currentUserPortfolioId }: { entries: Entry[]; currentUserPortfolioId?: string }) {
  if (entries.length === 0) {
    return <div className="text-sm text-muted-foreground">아직 스냅샷 없음 (워커가 5분 주기로 기록)</div>;
  }
  return (
    <ol className="space-y-2">
      {entries.map((e, i) => (
        <li
          key={e.portfolio_id}
          className={`flex items-center justify-between border-b pb-2 ${e.portfolio_id === currentUserPortfolioId ? "bg-muted/30 px-2 rounded" : ""}`}
        >
          <div className="flex items-center gap-3">
            <span className="font-mono text-sm w-6">{i + 1}</span>
            <span className="font-medium">{e.display_name}</span>
          </div>
          <div className="text-right">
            <div className={`font-mono ${e.return_pct! >= 0 ? "text-green-500" : "text-red-500"}`}>
              {e.return_pct! >= 0 ? "+" : ""}{e.return_pct!.toFixed(2)}%
            </div>
            <div className="text-xs text-muted-foreground">
              {e.total_value_krw ? KRW.format(e.total_value_krw) : "—"}
            </div>
          </div>
        </li>
      ))}
    </ol>
  );
}
```

`components/invite-code-display.tsx`:

```tsx
"use client";
import { Button } from "@/components/ui/button";

export function InviteCodeDisplay({ code }: { code: string }) {
  function copy() {
    navigator.clipboard.writeText(code);
    alert("복사됨!");
  }
  return (
    <div className="flex items-center gap-2">
      <code className="font-mono text-2xl bg-muted px-3 py-1 rounded">{code}</code>
      <Button size="sm" variant="outline" onClick={copy}>복사</Button>
    </div>
  );
}
```

`components/room-create-form.tsx`:

```tsx
"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";

export function RoomCreateForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [krw, setKrw] = useState("100000000");
  const [usd, setUsd] = useState("0");
  const [days, setDays] = useState("30");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    const startsAt = new Date().toISOString();
    const endsAt = days === "0"
      ? null
      : new Date(Date.now() + Number(days) * 24 * 3600 * 1000).toISOString();
    const res = await fetch("/api/rooms", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        starting_krw: Number(krw),
        starting_usd: Number(usd),
        starts_at: startsAt,
        ends_at: endsAt,
        max_members: 10,
      }),
    });
    setSubmitting(false);
    if (res.ok) {
      const data = await res.json();
      router.push(`/app/rooms/${data.room_id}`);
    } else {
      const err = await res.json().catch(() => ({}));
      setError(err.error ?? "오류");
    }
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <div>
        <Label htmlFor="room-name">방 이름</Label>
        <Input id="room-name" required value={name} onChange={(e) => setName(e.target.value)} maxLength={50} />
      </div>
      <div>
        <Label htmlFor="room-krw">시작 KRW</Label>
        <Input id="room-krw" type="number" min="0" required value={krw} onChange={(e) => setKrw(e.target.value)} />
      </div>
      <div>
        <Label htmlFor="room-usd">시작 USD</Label>
        <Input id="room-usd" type="number" min="0" required value={usd} onChange={(e) => setUsd(e.target.value)} />
      </div>
      <div>
        <Label htmlFor="room-days">기간 (일, 0=무제한)</Label>
        <Input id="room-days" type="number" min="0" required value={days} onChange={(e) => setDays(e.target.value)} />
      </div>
      {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
      <Button type="submit" disabled={submitting} className="w-full">방 만들기</Button>
    </form>
  );
}
```

`components/room-join-form.tsx`:

```tsx
"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";

export function RoomJoinForm() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    const res = await fetch("/api/rooms/join", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ invite_code: code.toUpperCase().trim() }),
    });
    setSubmitting(false);
    if (res.ok) {
      const data = await res.json();
      router.push(`/app/rooms/${data.room_id}`);
    } else {
      const err = await res.json().catch(() => ({}));
      setError(err.error ?? "오류");
    }
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <div>
        <Label htmlFor="invite-code">초대 코드 (6자)</Label>
        <Input
          id="invite-code"
          required
          value={code}
          onChange={(e) => setCode(e.target.value)}
          maxLength={6}
          placeholder="예: AB7K9P"
          className="font-mono text-lg"
        />
      </div>
      {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
      <Button type="submit" disabled={submitting || code.length !== 6} className="w-full">가입</Button>
    </form>
  );
}
```

- [ ] **Step 2: 페이지들**

`app/app/rooms/page.tsx` (방 목록):

```tsx
import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default async function RoomsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const { data: rooms } = await supabase
    .from("rooms")
    .select("id, name, host_id, status, starts_at, ends_at, max_members")
    .order("created_at", { ascending: false });

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">친구방</h1>
        <div className="flex gap-2">
          <Link href="/app/rooms/join"><Button variant="outline">가입</Button></Link>
          <Link href="/app/rooms/new"><Button>방 만들기</Button></Link>
        </div>
      </div>
      <Card>
        <CardContent className="pt-6">
          {!rooms || rooms.length === 0 ? (
            <div className="text-sm text-muted-foreground">참여 중인 방 없음</div>
          ) : (
            <ul className="space-y-2">
              {rooms.map((r) => (
                <li key={r.id} className="border-b pb-2">
                  <Link href={`/app/rooms/${r.id}`} className="block hover:bg-muted/30 p-2 rounded">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-medium">{r.name}</div>
                        <div className="text-xs text-muted-foreground">
                          상태: {r.status} · {r.host_id === user.id ? "호스트" : "멤버"}
                        </div>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {r.ends_at ? `~${new Date(r.ends_at).toLocaleDateString("ko-KR")}` : "무제한"}
                      </div>
                    </div>
                  </Link>
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

`app/app/rooms/new/page.tsx`:

```tsx
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RoomCreateForm } from "@/components/room-create-form";

export default function NewRoomPage() {
  return (
    <div className="max-w-md mx-auto p-6 space-y-4">
      <h1 className="text-2xl font-bold">방 만들기</h1>
      <Card>
        <CardContent className="pt-6">
          <RoomCreateForm />
        </CardContent>
      </Card>
    </div>
  );
}
```

`app/app/rooms/join/page.tsx`:

```tsx
import { Card, CardContent } from "@/components/ui/card";
import { RoomJoinForm } from "@/components/room-join-form";

export default function JoinRoomPage() {
  return (
    <div className="max-w-md mx-auto p-6 space-y-4">
      <h1 className="text-2xl font-bold">방 가입</h1>
      <Card>
        <CardContent className="pt-6">
          <RoomJoinForm />
        </CardContent>
      </Card>
    </div>
  );
}
```

`app/app/rooms/[id]/page.tsx` (방 상세 + 리더보드):

```tsx
import { redirect, notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LeaderboardTable } from "@/components/leaderboard-table";
import { InviteCodeDisplay } from "@/components/invite-code-display";

const KRW = new Intl.NumberFormat("ko-KR", { style: "currency", currency: "KRW", maximumFractionDigits: 0 });

export default async function RoomDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const { data: room } = await supabase
    .from("rooms").select("*").eq("id", id).maybeSingle();
  if (!room) notFound();

  const { data: members } = await supabase
    .from("room_members")
    .select("user_id, portfolio_id, profiles(display_name)")
    .eq("room_id", id);

  // 리더보드 데이터: 멤버 portfolio별 최신 snapshot
  const portfolioIds = (members ?? []).map((m) => m.portfolio_id);
  const { data: snapshots } = portfolioIds.length
    ? await supabase
        .from("portfolio_snapshots")
        .select("portfolio_id, total_value_krw, return_pct, ts")
        .in("portfolio_id", portfolioIds)
        .order("ts", { ascending: false })
    : { data: [] };

  const latest = new Map<string, { total: number; pct: number; ts: string }>();
  for (const s of snapshots ?? []) {
    if (!latest.has(s.portfolio_id)) {
      latest.set(s.portfolio_id, {
        total: Number(s.total_value_krw),
        pct: Number(s.return_pct),
        ts: s.ts,
      });
    }
  }

  const entries = (members ?? [])
    .map((m) => {
      const profile = Array.isArray(m.profiles) ? m.profiles[0] : m.profiles;
      const snap = latest.get(m.portfolio_id);
      return {
        portfolio_id: m.portfolio_id,
        display_name: profile?.display_name ?? "익명",
        avatar_url: null,
        total_value_krw: snap?.total ?? null,
        return_pct: snap?.pct ?? null,
        snapshot_ts: snap?.ts ?? null,
      };
    })
    .sort((a, b) => ((b.return_pct ?? -Infinity) - (a.return_pct ?? -Infinity)));

  const myMember = (members ?? []).find((m) => m.user_id === user.id);
  const isHost = room.host_id === user.id;

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-4">
      <div>
        <h1 className="text-2xl font-bold">{room.name}</h1>
        <div className="text-xs text-muted-foreground mt-1">
          상태: {room.status} · 멤버 {(members ?? []).length}/{room.max_members}
          {room.ends_at ? ` · ~${new Date(room.ends_at).toLocaleDateString("ko-KR")}` : " · 무제한"}
        </div>
      </div>

      {(isHost || myMember) && (
        <Card>
          <CardHeader><CardTitle className="text-base">초대 코드</CardTitle></CardHeader>
          <CardContent>
            <InviteCodeDisplay code={room.invite_code} />
            <div className="text-xs text-muted-foreground mt-2">
              친구에게 이 코드를 공유하세요. {room.max_members - (members ?? []).length}자리 남음.
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader><CardTitle className="text-base">방 정보</CardTitle></CardHeader>
        <CardContent className="text-sm space-y-1">
          <div>시작 자금: {KRW.format(Number(room.starting_krw))} + ${Number(room.starting_usd).toFixed(2)}</div>
          <div>시작일: {new Date(room.starts_at).toLocaleString("ko-KR")}</div>
          <div>종료일: {room.ends_at ? new Date(room.ends_at).toLocaleString("ko-KR") : "무제한"}</div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">리더보드</CardTitle></CardHeader>
        <CardContent>
          <LeaderboardTable entries={entries} currentUserPortfolioId={myMember?.portfolio_id} />
        </CardContent>
      </Card>
    </div>
  );
}
```

- [ ] **Step 3: 빌드 + 커밋**

```bash
cd apps/web && npm run build && npx tsc --noEmit
git add apps/web/components/room-create-form.tsx apps/web/components/room-join-form.tsx apps/web/components/leaderboard-table.tsx apps/web/components/invite-code-display.tsx apps/web/app/app/rooms/
git commit -m "feat(web): rooms pages — list, new, join, detail with leaderboard"
```

---

## Task 20: Web — 글로벌 리더보드 페이지

**Files:**
- Create: `apps/web/app/app/leaderboard/page.tsx`

- [ ] **Step 1: 작성**

```tsx
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LeaderboardTable } from "@/components/leaderboard-table";

export default async function GlobalLeaderboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  // 본 페이지는 fetch API 호출 — server component에서 직접 fetch도 가능
  // 단순화: server에서 동일 로직 인라인
  const { data: portfolios } = await supabase
    .from("portfolios")
    .select("id, user_id, profiles(display_name)")
    .is("room_id", null)
    .eq("status", "active");

  const ids = (portfolios ?? []).map((p) => p.id);
  const { data: snapshots } = ids.length
    ? await supabase
        .from("portfolio_snapshots")
        .select("portfolio_id, total_value_krw, return_pct, ts")
        .in("portfolio_id", ids)
        .order("ts", { ascending: false })
    : { data: [] };

  const latest = new Map<string, { total: number; pct: number; ts: string }>();
  for (const s of snapshots ?? []) {
    if (!latest.has(s.portfolio_id)) {
      latest.set(s.portfolio_id, {
        total: Number(s.total_value_krw),
        pct: Number(s.return_pct),
        ts: s.ts,
      });
    }
  }

  const entries = (portfolios ?? [])
    .map((p) => {
      const profile = Array.isArray(p.profiles) ? p.profiles[0] : p.profiles;
      const snap = latest.get(p.id);
      return {
        portfolio_id: p.id,
        display_name: profile?.display_name ?? "익명",
        avatar_url: null,
        total_value_krw: snap?.total ?? null,
        return_pct: snap?.pct ?? null,
        snapshot_ts: snap?.ts ?? null,
      };
    })
    .filter((e) => e.return_pct !== null)
    .sort((a, b) => ((b.return_pct ?? -Infinity) - (a.return_pct ?? -Infinity)))
    .slice(0, 100);

  const myEntry = entries.find((e) => entries.length && (portfolios ?? []).find((p) => p.user_id === user.id && p.id === e.portfolio_id));

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-4">
      <h1 className="text-2xl font-bold">글로벌 리더보드</h1>
      <Card>
        <CardHeader><CardTitle className="text-base">상위 100명 (누적 수익률)</CardTitle></CardHeader>
        <CardContent>
          <LeaderboardTable entries={entries} currentUserPortfolioId={myEntry?.portfolio_id} />
        </CardContent>
      </Card>
    </div>
  );
}
```

- [ ] **Step 2: 커밋**

```bash
cd apps/web && npm run build
git add apps/web/app/app/leaderboard/
git commit -m "feat(web): /app/leaderboard — global leaderboard top 100"
```

---

## Task 21: Web — Dashboard 링크 갱신

**Files:**
- Modify: `apps/web/app/app/dashboard/page.tsx`

- [ ] **Step 1: 친구방 + 리더보드 링크 추가**

기존 "곧 추가될 기능" Card의 링크 묶음에서 "Plan #5" 줄 제거, 다음 추가:

```tsx
<div>
  <Link href="/app/rooms" className="text-foreground underline">
    → 친구방
  </Link>
</div>
<div>
  <Link href="/app/leaderboard" className="text-foreground underline">
    → 글로벌 리더보드
  </Link>
</div>
```

"Plan #6: 배당/분할/Push/추천" 줄을 새로 추가 (다음 단계로 표시).

- [ ] **Step 2: 커밋**

```bash
git add apps/web/app/app/dashboard/page.tsx
git commit -m "feat(web): dashboard links to /app/rooms and /app/leaderboard"
```

---

## Task 22: E2E — 2-account room flow

**Files:**
- Create: `apps/web/tests/e2e/rooms-flow.spec.ts`

- [ ] **Step 1: 작성**

```typescript
import { test, expect, type Page, type BrowserContext } from "@playwright/test";

async function signup(context: BrowserContext, prefix: string): Promise<{ page: Page; email: string }> {
  const page = await context.newPage();
  const email = `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}@test.com`;
  await page.goto("/auth/login");
  await page.getByRole("button", { name: /가입하기/i }).click();
  await page.getByLabel("이메일").fill(email);
  await page.getByLabel("비밀번호").fill("TestPass123!");
  await page.getByRole("button", { name: /^가입$/i }).click();
  await expect(page).toHaveURL(/\/app\/dashboard/, { timeout: 15_000 });
  return { page, email };
}

test.describe("Rooms — 2-account flow", () => {
  test("호스트 방 생성 → 멤버 가입 → 방 상세에서 둘 다 보임", async ({ browser }) => {
    const hostCtx = await browser.newContext();
    const memberCtx = await browser.newContext();
    const { page: hostPage } = await signup(hostCtx, "host");
    const { page: memberPage } = await signup(memberCtx, "mem");

    // 호스트: 방 생성
    await hostPage.goto("/app/rooms/new");
    await hostPage.getByLabel("방 이름").fill("E2E Test Room");
    // 시작 KRW/USD/일수는 기본값 그대로 (1억 KRW, 0 USD, 30일)
    await hostPage.getByRole("button", { name: "방 만들기" }).click();
    // 방 상세로 리다이렉트
    await expect(hostPage).toHaveURL(/\/app\/rooms\/[0-9a-f-]+/, { timeout: 10_000 });

    // 호스트: invite_code 추출
    const inviteCodeText = await hostPage.locator("code").first().textContent();
    expect(inviteCodeText).toMatch(/^[A-Z0-9]{6}$/);
    const inviteCode = inviteCodeText!;

    // 멤버: 가입
    await memberPage.goto("/app/rooms/join");
    await memberPage.getByLabel(/초대 코드/).fill(inviteCode);
    await memberPage.getByRole("button", { name: "가입" }).click();
    await expect(memberPage).toHaveURL(/\/app\/rooms\/[0-9a-f-]+/, { timeout: 10_000 });

    // 멤버 페이지에서 방 정보 보임
    await expect(memberPage.getByText("E2E Test Room")).toBeVisible();
    // 멤버 2/10 (호스트는 자동 멤버 아니지만 방 만든 사람이라 list에 본인 없음 — 그냥 1/10)
    // 현재 v1 설계: create_room은 host_id만 기록, host도 join_room으로 가입해야 멤버. 그래서 멤버 1/10.
    // 호스트 페이지로 다시 가서 멤버 카운트 확인
    await hostPage.reload();
    await expect(hostPage.getByText(/멤버 1\/10/)).toBeVisible();
  });
});
```

NOTE: 호스트는 `create_room` 후 본인이 `join_room`을 따로 호출해야 멤버로 추가됨. 단순화 결정.

만약 호스트도 자동 멤버로 추가하고 싶으면, 별도 플랜에서 join_room을 create_room 안에서 한 번 더 호출하도록 수정. v1은 "방장이 직접 가입"이 명시적.

실제 v1 UX 개선: 방 생성 직후 자동 join 호출하는 페이지 흐름. 단순화 위해 v1은 명시적으로 호스트가 invite_code 자기 입력해야 한다고 가정.

수정: invite code 자동 join을 RoomCreateForm 안에서 처리하면 좋겠다 — 방 만들고 → join_room 호출 → 그제야 redirect. 하지만 v1.5에서. 지금은 E2E에서 그냥 호스트도 join 한 번 더.

테스트를 단순화하기 위해 host도 가입하는 흐름 추가:
```ts
// 호스트가 본인 방에 가입 (UX 개선 필요한 부분)
await hostPage.goto("/app/rooms/join");
await hostPage.getByLabel(/초대 코드/).fill(inviteCode);
await hostPage.getByRole("button", { name: "가입" }).click();
```

→ 그러면 `member 2/10` 검증 가능.

OK 위 테스트의 마지막 검증 부분을 다음으로 교체:

```ts
// 호스트도 자기 방에 가입 (v1: explicit)
await hostPage.goto("/app/rooms/join");
await hostPage.getByLabel(/초대 코드/).fill(inviteCode);
await hostPage.getByRole("button", { name: "가입" }).click();
await expect(hostPage).toHaveURL(/\/app\/rooms\/[0-9a-f-]+/);

// 양쪽에서 멤버 2 명 보임
await hostPage.reload();
await expect(hostPage.getByText(/멤버 2\/10/)).toBeVisible();
await memberPage.reload();
await expect(memberPage.getByText(/멤버 2\/10/)).toBeVisible();
```

- [ ] **Step 2: 실행**

```bash
cd apps/web && npx playwright test tests/e2e/rooms-flow.spec.ts -v
# Expected: 1 PASS
```

- [ ] **Step 3: 커밋**

```bash
git add apps/web/tests/e2e/rooms-flow.spec.ts
git commit -m "test(web): E2E for rooms flow — host create + member join + visibility"
```

---

## Task 23: README 갱신 + 마무리

**Files:**
- Modify: `README.md`

- [ ] **Step 1: 진행 상태**

Plan #4.5 다음에 추가:

```markdown
### Plan #5 — Rooms & Leaderboard ✅ 완료

- [x] DB: rooms, room_members, portfolio_snapshots 테이블 + RLS 멤버 가시성 확장
- [x] PG 함수: create_room, join_room, transition_room_lifecycle, compute_portfolio_value (+_gen_invite_code)
- [x] 워커 잡: portfolio_snapshot (5분), room_lifecycle (1분)
- [x] 쿠키 기반 PortfolioSwitcher — 모든 거래 페이지가 선택된 portfolio 사용
- [x] /app/rooms (목록/만들기/가입/상세), /app/leaderboard (글로벌)
- [x] 6자 영숫자 초대 코드 + 복사 버튼
- [x] 테스트: 워커 +6 (snapshot 3 + lifecycle 3) + 통합 6 + Web E2E +1 = **누적 90+ PASS**

### 다음 (Plan #6, #7, #8)

- Plan #6: 배당 시뮬, 분할/병합 자동 처리, Web Push, 룰 기반 종목 추천
- Plan #7: PWA 인프라, 모바일 UX (BottomTab, BottomSheet), 다크/라이트 토글, Realtime 구독
- Plan #8 (v1.5): Design Polish — 시각 디자인 시스템 업그레이드
```

- [ ] **Step 2: 디버깅 팁**

```markdown
- **방 가입 시 `room_not_found_or_ended`**: invite_code 잘못됐거나 방이 ended. 호스트가 새 방 만들거나 ends_at 확인
- **리더보드가 비어있음**: 워커 부팅 후 5분 대기 (첫 portfolio_snapshot). `select * from portfolio_snapshots limit 5` 확인
- **PortfolioSwitcher 없음**: app/(app)/layout.tsx 갱신 됐는지 확인
- **방 전환 후 잔고 안 바뀜**: 쿠키 set 후 location.reload()이 일어나야 함 — 자동으로 됨. 안 되면 쿠키 직접 확인 (DevTools → Application → Cookies → yginvest_portfolio)
```

- [ ] **Step 3: 커밋**

```bash
git add README.md
git commit -m "docs: Plan #5 (Rooms & Leaderboard) completion"
```

---

## 마무리 검증

- [ ] **DB**: `supabase db reset` 통과, 8 새 마이그레이션 적용 (28+ total)
- [ ] **워커 단위 테스트**: pytest 75+ PASS
- [ ] **통합 테스트**: room functions 6 PASS
- [ ] **빌드/lint/tsc**: clean
- [ ] **E2E**: 9+ PASS, 2 SKIP (KR 시장가)
- [ ] **수동**:
  1. 가입 → 방 만들기 → invite code 복사
  2. 다른 브라우저에서 가입 → 방 가입 → 방 상세 보임
  3. PortfolioSwitcher에서 방 포트폴리오 선택 → 거래 페이지 잔고 변경
  4. 5분 대기 → 리더보드에 본인 표시
  5. /app/leaderboard 글로벌도 동작

---

## Plan #5에 포함되지 않은 것 (defer)

| 항목 | 처리 |
|------|------|
| 호스트 자동 멤버 가입 | v1.5 (UX 폴리시) |
| 호스트 수동 종료 버튼 | v1.5 |
| leave_room (멤버 탈퇴) | v1.5 — 친구 단위라 거의 필요 없음 |
| 멤버 추방 (호스트가 강퇴) | v2 |
| 방 채팅 | v2 |
| 글로벌 리더보드 캐시 (materialized view) | v2 — 사용자 ≥1k 될 때 |
| Top 5 보유 종목 표시 (방 멤버끼리) | v1.5 — 스펙엔 있지만 단순화 |
| 시간대별 리더보드 필터 (24시간/7일/30일) | v1.5 |

---

## 디버깅 팁

- **PG 함수 `create_room` 실패 (invalid_starting_amounts 등)**: API 라우트에서 number 변환 정확한지 확인. body.starting_krw가 string이면 PG numeric에 NaN
- **`already_member` after rejoin**: 방을 다시 만들면 invite_code가 새로 생기지만 멤버 row는 이전 방 거. unique 충돌 방지를 위해 다른 방에는 가입 가능
- **portfolio_snapshots에서 NULL return_pct**: `compute_portfolio_value`가 starting_krw_eq=0 케이스 처리 (현재 0 반환). 신규 방인데 fx_rate_at_start 잘못된 경우 발생 가능
- **PortfolioSwitcher가 빈 드롭다운**: 사용자가 글로벌 포트폴리오 없는 신규 가입 직후일 수 있음 (트리거 미실행 등). `supabase db reset` 후 가입부터 다시
- **Window function이 필요해서 SQL view 만들어야 했나?**: v1에선 in-app dedup으로 충분. 사용자 ≥500이면 materialized view 필요
