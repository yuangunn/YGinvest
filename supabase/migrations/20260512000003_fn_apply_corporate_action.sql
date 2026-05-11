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
        -- reserved 차이 보정 (old - new ≥ 0, 분할 수학적으로 보존되거나 줄어듦)
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
