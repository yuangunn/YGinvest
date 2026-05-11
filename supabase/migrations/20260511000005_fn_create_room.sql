-- 6자 영숫자 invite code 생성 헬퍼 (uppercase 알파벳 + 숫자, 0/O/1/I 제외 가독성)
create or replace function public._gen_invite_code()
returns text
language plpgsql
volatile
as $$
declare
  charset text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  result text := '';
  i int;
begin
  for i in 1..6 loop
    result := result || substr(charset, 1 + (random() * (length(charset) - 1))::int, 1);
  end loop;
  return result;
end;
$$;

create or replace function public.create_room(
  p_name text,
  p_starting_krw numeric,
  p_starting_usd numeric,
  p_starts_at timestamptz,
  p_ends_at timestamptz,
  p_max_members int,
  p_late_join_until timestamptz
) returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_room_id uuid;
  v_invite_code text;
  v_attempts int := 0;
  v_active_count int;
begin
  if v_user_id is null then
    raise exception 'unauthenticated';
  end if;
  if p_starting_krw < 0 or p_starting_usd < 0 then
    raise exception 'invalid_starting_amounts';
  end if;
  if p_starts_at < now() - interval '1 day' then
    raise exception 'starts_at_too_old';
  end if;
  if p_ends_at is not null and p_ends_at <= p_starts_at then
    raise exception 'ends_at_before_starts_at';
  end if;
  if p_max_members < 2 or p_max_members > 50 then
    raise exception 'invalid_max_members';
  end if;

  -- 호스트 활성 방 5개 제한
  select count(*) into v_active_count
  from rooms
  where host_id = v_user_id and status in ('open', 'active');
  if v_active_count >= 5 then
    raise exception 'host_room_limit_exceeded';
  end if;

  -- invite_code 중복 회피 (드물지만)
  loop
    v_invite_code := _gen_invite_code();
    v_attempts := v_attempts + 1;
    exit when not exists (
      select 1 from rooms where invite_code = v_invite_code and status <> 'ended'
    );
    if v_attempts >= 10 then
      raise exception 'invite_code_collision';
    end if;
  end loop;

  insert into rooms (
    host_id, name, invite_code, starting_krw, starting_usd,
    starts_at, ends_at, max_members, late_join_until,
    status
  ) values (
    v_user_id, p_name, v_invite_code, p_starting_krw, p_starting_usd,
    p_starts_at, p_ends_at, p_max_members, p_late_join_until,
    case when p_starts_at <= now() then 'active' else 'open' end
  ) returning id into v_room_id;

  return json_build_object(
    'room_id', v_room_id,
    'invite_code', v_invite_code
  );
end;
$$;

revoke all on function _gen_invite_code() from public;
grant execute on function _gen_invite_code() to authenticated, service_role;
revoke all on function create_room(text, numeric, numeric, timestamptz, timestamptz, int, timestamptz) from public;
grant execute on function create_room(text, numeric, numeric, timestamptz, timestamptz, int, timestamptz) to authenticated;
