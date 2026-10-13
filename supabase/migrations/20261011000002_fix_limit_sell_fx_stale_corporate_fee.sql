-- 거래 코어 수정 (코드베이스 진단 2026-10-10, 퀵픽스 #5·#8)
--
-- 1) place_limit_order: 지정가 매도가 100% 실패하던 버그 수정
--    (sum() 과 FOR UPDATE 를 함께 써서 PostgreSQL 이 실행 시점에 거부)
-- 2) exchange_currency: 24시간 넘게 갱신되지 않은 환율로는 환전 거부 (fx_rate_stale)
-- 3) apply_corporate_action: 펜딩 매수 주문 예약금을 매수 수수료율로 재계산하고,
--    잔고가 음수가 될 상황이면 주문을 취소·환원
--
-- 세 함수 모두 기존 정의를 그대로 복사한 뒤 해당 부분만 바꿨다.

-- ═══════════════════════════════════════════════════════════════
-- 1) place_limit_order
-- ═══════════════════════════════════════════════════════════════
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
  if p_quantity <= 0 then
    raise exception 'invalid_quantity';
  end if;
  if p_limit_price <= 0 then
    raise exception 'invalid_limit_price';
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
    -- IMPORTANT: 이 holdings FOR UPDATE 락이 동시 매도 지정가의 직렬화 anchor.
    -- 아래 orders sum 쿼리의 FOR UPDATE는 이미 펜딩이 있을 때만 효력 — 첫 펜딩은 이 락이 보호.
    select quantity into v_holding
    from holdings where portfolio_id = p_portfolio_id and symbol = p_symbol
    for update;
    if v_holding is null then
      raise exception 'insufficient_holdings';
    end if;

    -- 같은 심볼의 펜딩 매도 주문 수량 합 + 이번 주문 수량 ≤ 보유량
    -- 버그 수정: 집계(sum)와 FOR UPDATE 는 함께 쓸 수 없어
    -- ("FOR UPDATE is not allowed with aggregate functions") 모든 지정가 매도가
    -- 예외로 끝났다. 동시 매도 주문의 직렬화는 위 holdings FOR UPDATE 락이 맡으므로
    -- 합계는 잠금 없이 읽어도 안전하다.
    declare
      v_pending_sell numeric;
    begin
      select coalesce(sum(quantity), 0) into v_pending_sell
      from orders
      where portfolio_id = p_portfolio_id and symbol = p_symbol
        and side = 'sell' and order_type = 'limit' and status = 'pending';
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

revoke all on function place_limit_order(uuid, text, text, numeric, numeric) from public, anon;
grant execute on function place_limit_order(uuid, text, text, numeric, numeric) to authenticated;

-- ═══════════════════════════════════════════════════════════════
-- 2) exchange_currency — 환율 신선도 가드
-- ═══════════════════════════════════════════════════════════════
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
  v_rate_ts timestamptz;
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
  select rate, ts into v_rate, v_rate_ts
  from fx_rates where base = 'USD' and quote = 'KRW'
  order by ts desc limit 1;
  if v_rate is null then
    raise exception 'fx_rate_unavailable';
  end if;
  -- 신선도 가드: 워커(30분 간격)가 멈춰 환율이 24시간 넘게 갱신되지 않았으면
  -- 며칠 전 환율로 환전되는 것을 막는다.
  if v_rate_ts < now() - interval '24 hours' then
    raise exception 'fx_rate_stale';
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

  if v_to_amount <= 0 then
    raise exception 'amount_too_small';
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

revoke all on function exchange_currency(uuid, text, text, numeric) from public, anon;
grant execute on function exchange_currency(uuid, text, text, numeric) to authenticated;

-- ═══════════════════════════════════════════════════════════════
-- 3) apply_corporate_action — 매수 수수료율 + 잔고 바닥 검사
-- ═══════════════════════════════════════════════════════════════
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
  v_market text;
  v_reserve_delta numeric;
  v_balance numeric;
begin
  select * into v_action from corporate_actions where id = p_action_id for update;
  if not found then raise exception 'action_not_found'; end if;
  if v_action.applied then raise exception 'already_applied'; end if;
  if v_action.ex_date > current_date then raise exception 'ex_date_not_reached'; end if;

  select currency, market, coalesce(last_price, 0) into v_currency, v_market, v_last_price
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

  -- 펜딩 주문 조정
  -- 버그 수정: 매수 예약금은 place_limit_order 와 같은 매수 수수료율로 재계산한다.
  -- 예전에는 매도 수수료율(KR 0.215%)을 써서 새 예약금이 원래 예약금(0.015%)보다
  -- 커졌고, 그 차액을 검사 없이 잔고에서 빼 잔고가 음수가 될 수 있었다.
  v_fee_rate := _calc_fee_rate(v_market, 'buy');

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
        -- 예약금 차액 (양수 = 환원, 음수 = 추가 차감)
        v_reserve_delta := coalesce(v_order.reserved_amount, v_new_reserved) - v_new_reserved;
        if v_reserve_delta < 0 then
          -- 잔고 바닥 검사: 추가 차감으로 잔고가 음수가 되면 주문을 취소하고 예약금 환원
          if v_order.reserved_currency = 'KRW' then
            select krw_balance into v_balance from portfolios where id = v_order.portfolio_id;
          else
            select usd_balance into v_balance from portfolios where id = v_order.portfolio_id;
          end if;
          if v_balance + v_reserve_delta < 0 then
            if v_order.reserved_amount is not null then
              if v_order.reserved_currency = 'KRW' then
                update portfolios set krw_balance = krw_balance + v_order.reserved_amount where id = v_order.portfolio_id;
              else
                update portfolios set usd_balance = usd_balance + v_order.reserved_amount where id = v_order.portfolio_id;
              end if;
            end if;
            update orders set status = 'cancelled', cancelled_at = now(),
              rejection_reason = 'corporate_action_insufficient_balance'
            where id = v_order.id;
            v_orders_cancelled := v_orders_cancelled + 1;
            continue;
          end if;
        end if;
        if v_order.reserved_amount is not null then
          if v_order.reserved_currency = 'KRW' then
            update portfolios set krw_balance = krw_balance + v_reserve_delta where id = v_order.portfolio_id;
          else
            update portfolios set usd_balance = usd_balance + v_reserve_delta where id = v_order.portfolio_id;
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

revoke all on function apply_corporate_action(uuid) from public, anon, authenticated;
grant execute on function apply_corporate_action(uuid) to service_role;
