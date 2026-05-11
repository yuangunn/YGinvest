-- 단일 dividend_events row를 모든 holders에게 적용.
-- KR 원천징수 15.4%, US 15%.
-- service_role 전용 (워커 cron만 호출).
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
begin
  -- Lock event
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

  -- 세율
  v_tax_rate := case v_event.currency
    when 'KRW' then 0.154   -- 15.4% (15% + 1.4% 지방)
    when 'USD' then 0.15
    else 0
  end;

  -- 각 holder에게 적용
  for v_holder in
    select h.portfolio_id, h.quantity, p.status
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

    v_holders_count := v_holders_count + 1;
    v_total_net := v_total_net + v_net;
  end loop;

  -- 이벤트 applied 마킹
  update dividend_events
  set applied = true, applied_at = now()
  where id = p_event_id;

  return json_build_object(
    'event_id', p_event_id,
    'symbol', v_event.symbol,
    'holders', v_holders_count,
    'total_net', v_total_net,
    'currency', v_event.currency
  );
end;
$$;

revoke all on function apply_dividend(uuid) from public;
grant execute on function apply_dividend(uuid) to service_role;
