-- Plan #12 (NXT Phase B): synthetic spread + midpoint orders
-- spec §4.7, §6.3
-- - place_market_order: NXT pre/after에 spread 적용 (매수=ask, 매도=bid, ±10 bps)
-- - place_midpoint_order: NXT pre/after 전용, midpoint(=last_price)로 즉시 체결

-- =========================================================================
-- 1) KR session helper — mirrors lib/market-hours.ts::getKrSession
--    stable (depends on now()), KST-normalized
-- =========================================================================
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

comment on function _kr_nxt_session(timestamptz) is
  'KR/NXT session (pre/regular/after/closed). Plan #12.';

-- =========================================================================
-- 2) orders.order_type — allow 'midpoint' (dynamic constraint name lookup)
-- =========================================================================
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

-- =========================================================================
-- 3) place_market_order — NXT pre/after 시 spread 적용
--    매수 = last_price * 1.001 (ask), 매도 = last_price * 0.999 (bid)
--    round(_, 4)로 모든 downstream column에서 동일 값 보장
-- =========================================================================
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
  -- 1) 포트폴리오
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

comment on function place_market_order(uuid, text, text, numeric) is
  '시장가 주문 + Plan #12 NXT spread (pre/after에 ±10 bps)';

-- =========================================================================
-- 4) place_midpoint_order — NXT pre/after 전용, midpoint(=last_price)로 즉시 체결
-- =========================================================================
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
    select krw_balance into v_balance from portfolios where id = p_portfolio_id;  -- KRX → KRW only
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
