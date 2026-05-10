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
    else 0.0005
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
