-- RLS recursion fix.
--
-- 종전 정책은 `room_members` SELECT 정책 안에서 `room_members`를 다시 SELECT
-- (같은 방 멤버끼리 보이도록). PostgreSQL은 그 자기참조를 무한 재귀로 감지하고
-- ERROR 42P17 ("infinite recursion detected in policy for relation room_members")
-- 반환. `rooms`, `portfolios`, `holdings` 정책도 똑같이 room_members 서브쿼리에
-- 의존하므로 같이 깨짐.
--
-- 해결: `security definer` 헬퍼 `_user_room_ids()`가 RLS를 우회해서 현재 사용자가
-- 가입한 방 IDs를 반환. 정책들은 이 함수를 호출 → 재귀 끊김.

create or replace function public._user_room_ids()
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  select room_id from public.room_members where user_id = auth.uid();
$$;

revoke all on function _user_room_ids() from public;
grant execute on function _user_room_ids() to authenticated, service_role;

-- 기존 정책들 교체

drop policy if exists "rooms: 멤버 읽기" on public.rooms;
create policy "rooms: 멤버 읽기"
  on public.rooms for select
  to authenticated
  using (
    host_id = auth.uid()
    or id in (select public._user_room_ids())
  );

drop policy if exists "room_members: 같은 방 멤버 읽기" on public.room_members;
create policy "room_members: 같은 방 멤버 읽기"
  on public.room_members for select
  to authenticated
  using (
    user_id = auth.uid()
    or room_id in (select public._user_room_ids())
  );

drop policy if exists "portfolios: 같은 방 멤버 읽기" on public.portfolios;
create policy "portfolios: 같은 방 멤버 읽기"
  on public.portfolios for select
  to authenticated
  using (
    room_id is not null
    and room_id in (select public._user_room_ids())
  );

drop policy if exists "holdings: 같은 방 멤버 읽기" on public.holdings;
create policy "holdings: 같은 방 멤버 읽기"
  on public.holdings for select
  to authenticated
  using (
    portfolio_id in (
      select id from public.portfolios
      where room_id is not null
        and room_id in (select public._user_room_ids())
    )
  );

-- portfolio_snapshots 정책도 같은 패턴이 들어있음 — 마찬가지로 재귀 위험
drop policy if exists "snapshots: 본인 + 방 멤버 읽기" on public.portfolio_snapshots;
create policy "snapshots: 본인 + 방 멤버 읽기"
  on public.portfolio_snapshots for select
  to authenticated
  using (
    portfolio_id in (
      select id from public.portfolios where user_id = auth.uid()
    )
    or portfolio_id in (
      select rm.portfolio_id
      from public.room_members rm
      where rm.room_id in (select public._user_room_ids())
    )
  );
