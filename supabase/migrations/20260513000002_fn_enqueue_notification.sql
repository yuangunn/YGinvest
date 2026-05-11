-- 알림 큐에 row를 추가하는 헬퍼. 이미 같은 dedup_key가 있으면 조용히 skip.
-- 사용자 settings에서 해당 type이 OFF면 enqueue하지 않음.
create or replace function public.enqueue_notification(
  p_user_id uuid,
  p_type text,
  p_title text,
  p_body text,
  p_url text,
  p_dedup_key text
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_enabled boolean;
begin
  -- 사용자 알림 설정 확인 (해당 type이 OFF면 enqueue 안 함)
  -- notification_settings에 row 없으면 default true 가정 (signup 트리거가 만들어줌)
  select case p_type
    when 'order_filled' then order_filled
    when 'order_expiring_soon' then order_expiring_soon
    when 'room_starting' then room_starting
    when 'room_ending' then room_ending
    when 'dividend_received' then dividend_received
    when 'corporate_action_applied' then corporate_action_applied
    else true
  end into v_enabled
  from notification_settings where user_id = p_user_id;

  if v_enabled is null or not v_enabled then
    return;
  end if;

  insert into notification_queue (user_id, type, title, body, url, dedup_key)
  values (p_user_id, p_type, p_title, p_body, p_url, p_dedup_key)
  on conflict (dedup_key) do nothing;
end;
$$;

revoke all on function enqueue_notification(uuid, text, text, text, text, text) from public;
grant execute on function enqueue_notification(uuid, text, text, text, text, text) to service_role;


-- apply_dividend 갱신: payout 직후 enqueue_notification 호출 추가.
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
  v_currency_symbol text;
begin
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

  v_tax_rate := case v_event.currency
    when 'KRW' then 0.154
    when 'USD' then 0.15
    else 0
  end;
  v_currency_symbol := case v_event.currency when 'KRW' then '₩' else '$' end;

  for v_holder in
    select h.portfolio_id, h.quantity, p.user_id
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

    -- 알림 enqueue (notification_settings.dividend_received가 ON일 때만)
    perform enqueue_notification(
      v_holder.user_id,
      'dividend_received',
      v_event.symbol || ' 배당 입금',
      v_currency_symbol || round(v_net::numeric, 2)::text || ' (세후, ' || v_holder.quantity::text || '주)',
      '/app/portfolio/transactions',
      'dividend:' || v_event.id::text || ':' || v_holder.portfolio_id::text
    );

    v_holders_count := v_holders_count + 1;
    v_total_net := v_total_net + v_net;
  end loop;

  update dividend_events set applied = true, applied_at = now() where id = p_event_id;

  return json_build_object(
    'event_id', p_event_id, 'symbol', v_event.symbol,
    'holders', v_holders_count, 'total_net', v_total_net, 'currency', v_event.currency
  );
end;
$$;


-- apply_corporate_action 갱신: 마지막에 holder별 enqueue 추가
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
  v_user_id uuid;
  v_action_label text;
begin
  select * into v_action from corporate_actions where id = p_action_id for update;
  if not found then raise exception 'action_not_found'; end if;
  if v_action.applied then raise exception 'already_applied'; end if;
  if v_action.ex_date > current_date then raise exception 'ex_date_not_reached'; end if;

  select currency, coalesce(last_price, 0) into v_currency, v_last_price
  from stocks where symbol = v_action.symbol;
  if v_currency is null then raise exception 'stock_not_found'; end if;

  v_action_label := case v_action.action_type
    when 'split' then v_action.ratio::text || ':1 분할'
    else '1:' || (1.0 / v_action.ratio)::text || ' 병합'
  end;

  for v_holder in
    select h.portfolio_id, h.quantity, h.avg_cost, p.user_id
    from holdings h
    join portfolios p on p.id = h.portfolio_id
    where h.symbol = v_action.symbol and p.status = 'active'
    for update
  loop
    v_new_qty := floor(v_holder.quantity * v_action.ratio);
    v_leftover := v_holder.quantity * v_action.ratio - v_new_qty;
    v_leftover_cash := v_leftover * v_last_price;
    v_user_id := v_holder.user_id;

    if v_new_qty > 0 then
      v_new_avg := (v_holder.quantity * v_holder.avg_cost) / v_new_qty;
      update holdings set quantity = v_new_qty, avg_cost = v_new_avg, updated_at = now()
      where portfolio_id = v_holder.portfolio_id and symbol = v_action.symbol;
    else
      delete from holdings
      where portfolio_id = v_holder.portfolio_id and symbol = v_action.symbol;
    end if;

    if v_leftover_cash > 0 then
      if v_currency = 'KRW' then
        update portfolios set krw_balance = krw_balance + v_leftover_cash where id = v_holder.portfolio_id;
      else
        update portfolios set usd_balance = usd_balance + v_leftover_cash where id = v_holder.portfolio_id;
      end if;
    end if;

    -- 알림 enqueue
    perform enqueue_notification(
      v_user_id,
      'corporate_action_applied',
      v_action.symbol || ' ' || v_action_label,
      '보유 ' || v_holder.quantity::text || '주 → ' || v_new_qty::text || '주',
      '/app/portfolio/holdings',
      'corp_action:' || v_action.id::text || ':' || v_holder.portfolio_id::text
    );

    v_holders_count := v_holders_count + 1;
  end loop;

  -- 펜딩 주문 조정 (기존 로직과 동일)
  v_fee_rate := case v_currency when 'KRW' then 0.00215 else 0.0005 end;

  for v_order in
    select o.id, o.portfolio_id, o.side, o.quantity, o.limit_price,
           o.reserved_amount, o.reserved_currency
    from orders o
    join portfolios p on p.id = o.portfolio_id
    where o.symbol = v_action.symbol and o.status = 'pending'
      and o.order_type = 'limit' and p.status = 'active'
    for update
  loop
    v_new_order_qty := floor(v_order.quantity * v_action.ratio);
    v_new_order_limit := v_order.limit_price / v_action.ratio;

    if v_new_order_qty = 0 then
      if v_order.side = 'buy' and v_order.reserved_amount is not null then
        if v_order.reserved_currency = 'KRW' then
          update portfolios set krw_balance = krw_balance + v_order.reserved_amount where id = v_order.portfolio_id;
        else
          update portfolios set usd_balance = usd_balance + v_order.reserved_amount where id = v_order.portfolio_id;
        end if;
      end if;
      update orders set status = 'cancelled', cancelled_at = now() where id = v_order.id;
      v_orders_cancelled := v_orders_cancelled + 1;
    else
      if v_order.side = 'buy' then
        v_new_reserved := v_new_order_qty * v_new_order_limit * (1 + v_fee_rate);
        if v_order.reserved_amount is not null then
          if v_order.reserved_currency = 'KRW' then
            update portfolios set krw_balance = krw_balance + (v_order.reserved_amount - v_new_reserved) where id = v_order.portfolio_id;
          else
            update portfolios set usd_balance = usd_balance + (v_order.reserved_amount - v_new_reserved) where id = v_order.portfolio_id;
          end if;
        end if;
        update orders set quantity = v_new_order_qty, limit_price = v_new_order_limit, reserved_amount = v_new_reserved where id = v_order.id;
      else
        update orders set quantity = v_new_order_qty, limit_price = v_new_order_limit where id = v_order.id;
      end if;
      v_orders_adjusted := v_orders_adjusted + 1;
    end if;
  end loop;

  update corporate_actions set applied = true, applied_at = now() where id = p_action_id;

  return json_build_object(
    'action_id', p_action_id, 'symbol', v_action.symbol, 'ratio', v_action.ratio,
    'holders', v_holders_count, 'orders_adjusted', v_orders_adjusted, 'orders_cancelled', v_orders_cancelled
  );
end;
$$;
