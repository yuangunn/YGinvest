-- Plan #29.2: profiles RLS 무한재귀 버그 수정.
--
-- 이전 마이그레이션(20260516000001)의 정책은 `profiles` 테이블 정책 안에서
-- `select 1 from public.profiles ...`를 호출해 재귀 발생:
--   "infinite recursion detected in policy for relation \"profiles\""
--
-- 해결: SECURITY DEFINER 함수로 RLS 우회.
--   - public.user_is_admin(uid) 함수는 함수 owner 권한으로 실행 → RLS 우회
--   - 정책에서는 이 함수만 호출 → 재귀 없음.

-- ───── 잘못된 정책 제거 ─────────────────────────────────────
drop policy if exists profiles_admin_update on public.profiles;
drop policy if exists profiles_admin_select_all on public.profiles;

-- ───── SECURITY DEFINER 함수 ────────────────────────────────
-- RLS 우회하여 admin 여부 확인. 정책 안에서 호출해도 재귀 X.
create or replace function public.user_is_admin(uid uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select coalesce(
    (select is_admin from public.profiles where id = uid),
    false
  );
$$;

grant execute on function public.user_is_admin(uuid) to authenticated;

comment on function public.user_is_admin(uuid) is
  'Plan #29.2: SECURITY DEFINER로 RLS 우회. 정책 내에서 admin 여부 확인 시 사용.';

-- ───── 재귀 없는 정책으로 재생성 ─────────────────────────────

create policy profiles_admin_update
  on public.profiles for update
  to authenticated
  using (public.user_is_admin(auth.uid()))
  with check (public.user_is_admin(auth.uid()));

create policy profiles_admin_select_all
  on public.profiles for select
  to authenticated
  using (
    auth.uid() = id  -- 본인은 항상 조회 가능
    or public.user_is_admin(auth.uid())  -- admin은 모두 조회
  );
