-- rooms RLS (이미 enable됨; 정책만 추가)
create policy "rooms: 멤버 읽기"
  on public.rooms for select
  to authenticated
  using (
    host_id = auth.uid()
    or id in (select room_id from public.room_members where user_id = auth.uid())
  );

-- room_members RLS (이미 enable됨)
create policy "room_members: 같은 방 멤버 읽기"
  on public.room_members for select
  to authenticated
  using (
    user_id = auth.uid()
    or room_id in (select room_id from public.room_members where user_id = auth.uid())
  );

-- portfolios SELECT 정책 확장: 같은 방 멤버 가시성
-- 기존 정책 "portfolios: 본인 읽기" 그대로 두고 추가 정책 OR로 결합
create policy "portfolios: 같은 방 멤버 읽기"
  on public.portfolios for select
  to authenticated
  using (
    room_id is not null
    and room_id in (select room_id from public.room_members where user_id = auth.uid())
  );

-- holdings SELECT 정책 확장: 같은 방 멤버 가시성
create policy "holdings: 같은 방 멤버 읽기"
  on public.holdings for select
  to authenticated
  using (
    portfolio_id in (
      select id from public.portfolios
      where room_id is not null
        and room_id in (select room_id from public.room_members where user_id = auth.uid())
    )
  );
