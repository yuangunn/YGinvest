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
