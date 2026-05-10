-- profiles
alter table public.profiles enable row level security;

create policy "profiles: 누구나 읽기"
  on public.profiles for select
  to anon, authenticated  -- spec §4.3: SELECT 누구나
  using (true);

create policy "profiles: 본인 업데이트"
  on public.profiles for update
  to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

create policy "profiles: 본인 삭제"
  on public.profiles for delete
  to authenticated
  using (id = auth.uid());

-- profiles INSERT는 트리거(다음 마이그레이션)가 service_role로 처리하므로 정책 없음

-- portfolios
alter table public.portfolios enable row level security;

create policy "portfolios: 본인 읽기"
  on public.portfolios for select
  to authenticated
  using (user_id = auth.uid());
-- 방 멤버 공개 정책은 Plan #5에서 추가

-- portfolios INSERT/UPDATE/DELETE는 서버(service_role)만. 사용자 직접 X.

-- notification_settings
alter table public.notification_settings enable row level security;

create policy "notification_settings: 본인 읽기"
  on public.notification_settings for select
  to authenticated
  using (user_id = auth.uid());

create policy "notification_settings: 본인 업데이트"
  on public.notification_settings for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
