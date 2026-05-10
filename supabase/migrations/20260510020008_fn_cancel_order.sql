create or replace function public.cancel_order(p_order_id uuid)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_portfolio_id uuid;
  v_status text;
  v_side text;
  v_reserved numeric;
  v_reserved_ccy text;
begin
  -- Lock portfolios FIRST (consistent with place_market_order/place_limit_order)
  select o.portfolio_id into v_portfolio_id
  from orders o where o.id = p_order_id;
  if v_portfolio_id is null then
    raise exception 'order_not_found';
  end if;

  select user_id into v_user_id
  from portfolios where id = v_portfolio_id
  for update;
  if v_user_id <> auth.uid() then
    raise exception 'unauthorized';
  end if;

  -- Now lock orders
  select status, side, reserved_amount, reserved_currency
  into v_status, v_side, v_reserved, v_reserved_ccy
  from orders where id = p_order_id
  for update;
  if v_status <> 'pending' then
    raise exception 'order_not_pending';
  end if;

  -- 잔고 환원 (매수만)
  if v_side = 'buy' and v_reserved is not null and v_reserved > 0 then
    if v_reserved_ccy = 'KRW' then
      update portfolios set krw_balance = krw_balance + v_reserved
      where id = v_portfolio_id;
    else
      update portfolios set usd_balance = usd_balance + v_reserved
      where id = v_portfolio_id;
    end if;
  end if;

  update orders
  set status = 'cancelled', cancelled_at = now()
  where id = p_order_id;

  return json_build_object('order_id', p_order_id, 'restored_amount', coalesce(v_reserved, 0));
end;
$$;

revoke all on function cancel_order(uuid) from public;
grant execute on function cancel_order(uuid) to authenticated;
