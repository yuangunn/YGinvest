-- Plan #29: 관리자 권한 (is_admin)
-- 현재 사용자(rms6654@gmail.com)를 첫 관리자로 부트스트랩.

alter table public.profiles
  add column if not exists is_admin boolean not null default false;

comment on column public.profiles.is_admin is
  'Plan #29: 운영자 권한. /app/health, /app/admin 등 admin 전용 페이지 접근.';

-- 부트스트랩: 첫 관리자 자동 부여
update public.profiles
set is_admin = true
where id in (
  select id from auth.users where email = 'rms6654@gmail.com'
);

-- RLS: 본인 profile은 select 가능 (이미 있음). is_admin 변경은 admin만 가능.
-- 새 정책: admin 사용자는 다른 profile 업데이트 가능 (관리자가 다른 유저 promote 위함)

drop policy if exists profiles_admin_update on public.profiles;
create policy profiles_admin_update
  on public.profiles for update
  to authenticated
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and is_admin = true
    )
  )
  with check (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and is_admin = true
    )
  );

-- admin 사용자는 모든 profile 조회 가능 (관리자 페이지에서 사용자 리스트 표시)
drop policy if exists profiles_admin_select_all on public.profiles;
create policy profiles_admin_select_all
  on public.profiles for select
  to authenticated
  using (
    auth.uid() = id  -- 본인은 항상 조회 가능
    or exists (
      select 1 from public.profiles
      where id = auth.uid() and is_admin = true
    )
  );
