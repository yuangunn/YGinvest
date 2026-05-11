-- worker-only function: opens scheduled rooms, ends expired rooms.
-- For ended rooms: cascades portfolios to 'ended', refunds reserved BUY balances,
-- then cancels pending orders. The refund preserves leaderboard accuracy
-- because total_value_krw includes krw_balance + usd_balance.
create or replace function public.transition_room_lifecycle()
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_opened int := 0;
  v_ended int := 0;
  v_ended_room_ids uuid[];
begin
  -- 1) open → active (starts_at 도달한 방 활성화)
  update rooms set status = 'active'
  where status = 'open' and starts_at <= now();
  get diagnostics v_opened = row_count;

  -- 2) active → ended (ends_at 도달한 방 종료) — CTE + array_agg로 IDs 수집
  --    plpgsql `RETURNING ... INTO var`는 단일 행만 받으므로 CTE로 감싸 array_agg 필요.
  with ended as (
    update rooms set status = 'ended'
    where status = 'active' and ends_at is not null and ends_at <= now()
    returning id
  )
  select coalesce(array_agg(id), array[]::uuid[]) into v_ended_room_ids from ended;

  v_ended := coalesce(array_length(v_ended_room_ids, 1), 0);

  if v_ended > 0 then
    -- 3) 종료된 방의 모든 멤버 portfolio: status='ended', ended_at=now()
    update portfolios
    set status = 'ended', ended_at = now()
    where room_id = any(v_ended_room_ids) and status = 'active';

    -- 4) 펜딩 BUY 주문의 reserved_amount 환원 (정합성 — 리더보드 최종 순위에 반영)
    --    SELL은 reserved_amount IS NULL이라 cash 환원 불필요.
    --    cancel_order는 auth.uid()를 요구하므로 service_role에서 못 씀 → raw update.
    update portfolios p
    set
      krw_balance = p.krw_balance + sub.refund_krw,
      usd_balance = p.usd_balance + sub.refund_usd
    from (
      select
        o.portfolio_id,
        coalesce(sum(case when o.reserved_currency = 'KRW' then o.reserved_amount else 0 end), 0) as refund_krw,
        coalesce(sum(case when o.reserved_currency = 'USD' then o.reserved_amount else 0 end), 0) as refund_usd
      from orders o
      where o.status = 'pending'
        and o.reserved_amount is not null
        and o.portfolio_id in (
          select id from portfolios where room_id = any(v_ended_room_ids)
        )
      group by o.portfolio_id
    ) sub
    where p.id = sub.portfolio_id;

    -- 5) 펜딩 주문 일괄 cancelled
    update orders
    set status = 'cancelled', cancelled_at = now()
    where status = 'pending'
      and portfolio_id in (
        select id from portfolios where room_id = any(v_ended_room_ids)
      );
  end if;

  return json_build_object(
    'opened', v_opened,
    'ended', v_ended
  );
end;
$$;

-- service_role 전용 (워커 cron만 호출)
revoke all on function transition_room_lifecycle() from public;
grant execute on function transition_room_lifecycle() to service_role;
