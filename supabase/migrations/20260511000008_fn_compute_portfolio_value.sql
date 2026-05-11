create or replace function public.compute_portfolio_value(p_portfolio_id uuid)
returns json
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_p portfolios%rowtype;
  v_fx numeric;
  v_holdings_value_krw numeric := 0;
  v_total_value_krw numeric;
  v_starting_krw_eq numeric;
  v_return_pct numeric;
begin
  select * into v_p from portfolios where id = p_portfolio_id;
  if not found then
    raise exception 'portfolio_not_found';
  end if;

  -- 현재 USD/KRW
  select rate into v_fx
  from fx_rates where base = 'USD' and quote = 'KRW'
  order by ts desc limit 1;
  if v_fx is null then
    v_fx := v_p.fx_rate_at_start;  -- 폴백
  end if;

  -- 보유 평가금 (KRW 환산)
  select coalesce(sum(
    case
      when s.currency = 'KRW' then h.quantity * coalesce(s.last_price, 0)
      else h.quantity * coalesce(s.last_price, 0) * v_fx
    end
  ), 0) into v_holdings_value_krw
  from holdings h
  join stocks s on s.symbol = h.symbol
  where h.portfolio_id = p_portfolio_id;

  v_total_value_krw :=
    v_p.krw_balance + v_p.usd_balance * v_fx + v_holdings_value_krw;

  v_starting_krw_eq :=
    v_p.starting_krw + v_p.starting_usd * v_p.fx_rate_at_start;

  v_return_pct := case
    when v_starting_krw_eq > 0 then
      (v_total_value_krw - v_starting_krw_eq) / v_starting_krw_eq * 100
    else 0
  end;

  return json_build_object(
    'portfolio_id', p_portfolio_id,
    'total_value_krw', v_total_value_krw,
    'return_pct', v_return_pct,
    'fx_rate', v_fx
  );
end;
$$;

-- service_role 전용: 클라이언트는 portfolio_snapshots 테이블을 직접 SELECT (RLS로 멤버 가시성 보호).
-- 실시간 재계산은 워커의 5분 snapshot 잡에서만 호출. 임의 사용자가 임의 portfolio 평가금을
-- 조회하지 못하도록 authenticated 권한은 부여하지 않음.
revoke all on function compute_portfolio_value(uuid) from public;
grant execute on function compute_portfolio_value(uuid) to service_role;
