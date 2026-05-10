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

  -- 2) 가격 조회 + stale 체크 (for share: 워커가 동시에 stocks.last_price 갱신해도 일관성)
  select currency, market, last_price, last_price_at
  into v_currency, v_market, v_current_price, v_price_at
  from stocks where symbol = v_symbol
  for share;
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
      update orders
      set status = 'rejected',
          rejection_reason = 'insufficient_holdings_at_match'
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
