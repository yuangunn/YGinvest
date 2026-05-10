create or replace function public.expire_pending_order(p_order_id uuid)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_portfolio_id uuid;
  v_status text;
  v_side text;
  v_reserved numeric;
  v_reserved_ccy text;
  v_expires_at timestamptz;
begin
  select portfolio_id, status, side, reserved_amount, reserved_currency, expires_at
  into v_portfolio_id, v_status, v_side, v_reserved, v_reserved_ccy, v_expires_at
  from orders where id = p_order_id for update;

  if not found then
    raise exception 'order_not_found';
  end if;
  if v_status <> 'pending' then
    return json_build_object('expired', false, 'reason', 'not_pending');
  end if;
  if v_expires_at is null or v_expires_at >= now() then
    return json_build_object('expired', false, 'reason', 'not_yet_expired');
  end if;

  -- Lock portfolios row for balance mutation
  perform 1 from portfolios where id = v_portfolio_id for update;

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

  update orders set status = 'expired' where id = p_order_id;
  return json_build_object('expired', true, 'restored_amount', coalesce(v_reserved, 0));
end;
$$;

revoke all on function expire_pending_order(uuid) from public;
grant execute on function expire_pending_order(uuid) to service_role;
