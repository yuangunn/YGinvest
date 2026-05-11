create or replace function public.join_room(p_invite_code text)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_room rooms%rowtype;
  v_member_count int;
  v_existing_member_count int;
  v_active_room_count int;
  v_fx_rate numeric;
  v_portfolio_id uuid;
begin
  if v_user_id is null then
    raise exception 'unauthenticated';
  end if;

  -- 방 잠금 + 검증
  select * into v_room
  from rooms
  where invite_code = p_invite_code and status <> 'ended'
  for update;
  if not found then
    raise exception 'room_not_found_or_ended';
  end if;
  if v_room.late_join_until is not null and v_room.late_join_until < now() then
    raise exception 'late_join_closed';
  end if;

  -- 이미 멤버?
  select count(*) into v_existing_member_count
  from room_members
  where room_id = v_room.id and user_id = v_user_id;
  if v_existing_member_count > 0 then
    raise exception 'already_member';
  end if;

  -- max_members 체크
  select count(*) into v_member_count
  from room_members
  where room_id = v_room.id;
  if v_member_count >= v_room.max_members then
    raise exception 'room_full';
  end if;

  -- 사용자 동시 가입 방 10개 제한
  select count(*) into v_active_room_count
  from room_members rm
  join rooms r on r.id = rm.room_id
  where rm.user_id = v_user_id and r.status <> 'ended';
  if v_active_room_count >= 10 then
    raise exception 'user_room_limit_exceeded';
  end if;

  -- 현재 USD/KRW
  select rate into v_fx_rate
  from fx_rates where base = 'USD' and quote = 'KRW'
  order by ts desc limit 1;
  if v_fx_rate is null then
    v_fx_rate := 1395;  -- 폴백
  end if;

  -- portfolio 생성
  insert into portfolios (
    user_id, room_id, starting_krw, starting_usd, fx_rate_at_start,
    krw_balance, usd_balance, status
  ) values (
    v_user_id, v_room.id, v_room.starting_krw, v_room.starting_usd, v_fx_rate,
    v_room.starting_krw, v_room.starting_usd, 'active'
  ) returning id into v_portfolio_id;

  -- room_members 추가
  insert into room_members (room_id, user_id, portfolio_id)
  values (v_room.id, v_user_id, v_portfolio_id);

  return json_build_object(
    'room_id', v_room.id,
    'portfolio_id', v_portfolio_id,
    'starting_krw', v_room.starting_krw,
    'starting_usd', v_room.starting_usd,
    'fx_rate_at_start', v_fx_rate
  );
end;
$$;

revoke all on function join_room(text) from public;
grant execute on function join_room(text) to authenticated;
