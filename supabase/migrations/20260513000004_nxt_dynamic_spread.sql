-- Plan #12.5 (NXT Phase B+): dynamic spread by liquidity tier
-- 유동성 티어 (market_cap KRW 기준):
--   Tier 1 (≥ 10조원):  5 bps  (top-cap KOSPI — Samsung, SK Hynix, …)
--   Tier 2 (1~10조원): 10 bps  (mid-cap KOSPI/KOSDAQ)
--   Tier 3 (< 1조원):  20 bps  (small-cap)
--   unknown:           15 bps  (안전 fallback)

create or replace function public._kr_spread_bps(p_market_cap numeric)
returns numeric
language sql
immutable
as $$
  select case
    when p_market_cap is null then 15
    when p_market_cap >= 10000000000000 then 5    -- 10조원
    when p_market_cap >= 1000000000000 then 10   -- 1조원
    else 20
  end;
$$;

revoke all on function _kr_spread_bps(numeric) from public;
grant execute on function _kr_spread_bps(numeric) to authenticated, service_role;

comment on function _kr_spread_bps(numeric) is
  'NXT spread basis points by liquidity tier (Plan #12.5)';

-- =========================================================================
-- place_market_order — 동적 spread 적용
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
  v_market_cap numeric;
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
  v_spread_bps numeric;
  v_spread_factor numeric;
begin
  select user_id into v_user_id
  from portfolios where id = p_portfolio_id and status = 'active'
  for update;
  if v_user_id is null then raise exception 'portfolio_not_found_or_ended'; end if;
  if v_user_id <> auth.uid() then raise exception 'unauthorized'; end if;

  select currency, market, market_cap, last_price, last_price_at
  into v_currency, v_market, v_market_cap, v_price, v_price_at
  from stocks where symbol = p_symbol and is_active
  for share;
  if not found then raise exception 'stock_not_found'; end if;
  if v_price is null then raise exception 'price_not_available'; end if;
  if v_price_at < now() - interval '30 minutes' then raise exception 'price_stale'; end if;

  if p_side not in ('buy', 'sell') then raise exception 'invalid_side'; end if;
  if p_quantity <= 0 then raise exception 'invalid_quantity'; end if;

  -- 동적 spread: NXT pre/after에만, market_cap 티어별
  v_exec_price := v_price;
  if v_market like 'KRX_%' then
    v_session := _kr_nxt_session(now());
    if v_session in ('pre', 'after') then
      v_spread_bps := _kr_spread_bps(v_market_cap);
      v_spread_factor := v_spread_bps / 10000.0;  -- bps → fraction
      if p_side = 'buy' then
        v_exec_price := round(v_price * (1 + v_spread_factor), 4);
      else
        v_exec_price := round(v_price * (1 - v_spread_factor), 4);
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
    if v_balance < v_net then raise exception 'insufficient_balance'; end if;
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
    if v_holding is null or v_holding < p_quantity then raise exception 'insufficient_holdings'; end if;
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
  '시장가 + Plan #12.5 NXT 동적 spread (티어별 5/10/20 bps)';
