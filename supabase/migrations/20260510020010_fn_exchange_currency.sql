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
  select rate into v_rate
  from fx_rates where base = 'USD' and quote = 'KRW'
  order by ts desc limit 1;
  if v_rate is null then
    raise exception 'fx_rate_unavailable';
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

revoke all on function exchange_currency(uuid, text, text, numeric) from public;
grant execute on function exchange_currency(uuid, text, text, numeric) to authenticated;
