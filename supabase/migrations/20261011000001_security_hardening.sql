-- 보안 강화 (코드베이스 진단 2026-10-10, S1·S2·S6 / 퀵픽스 #1·#3)
--
-- 1) profiles.is_admin: 일반 사용자가 자기 계정을 관리자로 승격하는 경로 차단
-- 2) 워커 전용 PG 함수: anon·authenticated 의 EXECUTE 회수 + 앞으로 만들
--    함수의 기본 EXECUTE 권한도 회수 (명시적 grant 만 허용)
-- 3) leaderboard_rankings MV: 직접 SELECT 회수, 익명 사용자의 식별자를 제거한
--    뷰(leaderboard_public)로 교체
--
-- 배경: Supabase 는 public 스키마에 함수를 만들면 기본 권한으로
-- anon·authenticated·service_role 에 EXECUTE 를 "직접" 부여한다. 기존
-- 마이그레이션의 `revoke all ... from public` 은 PUBLIC 의사역할만 회수하므로
-- anon·authenticated 의 직접 grant 는 그대로 남아 있었다.

-- ═══════════════════════════════════════════════════════════════
-- 1) profiles.is_admin 보호 트리거
-- ═══════════════════════════════════════════════════════════════
-- RLS 의 "본인 업데이트" 정책은 행 단위라 열을 가리지 못한다. 열 단위 GRANT 는
-- 테이블 단위 UPDATE grant 가 남아 있는 한 효력이 없으므로 트리거로 막는다.
--
-- 허용되는 호출자:
--   - service_role (워커, 서버 사이드 admin 클라이언트)
--   - PostgREST 를 거치지 않은 직접 SQL (마이그레이션, 대시보드 SQL 편집기)
--   - 이미 관리자인 사용자 (/api/admin/users 의 토글)
-- 그 외(일반 사용자가 anon 키 + 본인 JWT 로 PATCH)는 거부.
--
-- game_points · game_rebirth_count 는 아직 웹이 사용자 세션으로 직접 갱신하므로
-- (api/game/unlock, api/game/rebirth) 여기서 막으면 게임이 깨진다. 이 두 열은
-- 게임 쓰기를 SECURITY DEFINER RPC 로 옮기는 S4 작업(M1)에서 함께 보호한다.
create or replace function public.tg_profiles_protect_admin_flag()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_trusted boolean;
begin
  if new.is_admin is distinct from old.is_admin then
    v_trusted := coalesce(auth.role(), '') = 'service_role'
      or session_user in ('postgres', 'supabase_admin');
    if not v_trusted and not public.user_is_admin(auth.uid()) then
      raise exception 'profiles.is_admin can only be changed by an admin'
        using errcode = 'insufficient_privilege';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_protect_admin_flag_trg on public.profiles;
create trigger profiles_protect_admin_flag_trg
  before update of is_admin on public.profiles
  for each row execute function public.tg_profiles_protect_admin_flag();

comment on function public.tg_profiles_protect_admin_flag() is
  '보안 강화: 관리자/service_role 이 아닌 호출자의 profiles.is_admin 변경 거부';

-- ═══════════════════════════════════════════════════════════════
-- 2) 함수 EXECUTE 권한 정리
-- ═══════════════════════════════════════════════════════════════
-- 2-a) 워커(service_role) 전용 — 사용자·익명 호출 전면 차단
revoke execute on function public.apply_dividend(uuid)
  from public, anon, authenticated;
revoke execute on function public.apply_corporate_action(uuid)
  from public, anon, authenticated;
revoke execute on function public.match_limit_order(uuid)
  from public, anon, authenticated;
revoke execute on function public.expire_pending_order(uuid)
  from public, anon, authenticated;
revoke execute on function public.transition_room_lifecycle()
  from public, anon, authenticated;
revoke execute on function public.compute_portfolio_value(uuid)
  from public, anon, authenticated;
revoke execute on function public.enqueue_notification(uuid, text, text, text, text, text)
  from public, anon, authenticated;
revoke execute on function public.refresh_leaderboard_rankings()
  from public, anon, authenticated;

-- 2-b) 트리거 전용 함수 — RPC 로 호출될 이유가 없음
revoke execute on function public.handle_new_user()
  from public, anon, authenticated;
revoke execute on function public.tg_leaderboard_profiles_updated_at()
  from public, anon, authenticated;
revoke execute on function public.tg_profiles_protect_admin_flag()
  from public, anon, authenticated;

-- 2-c) 로그인 사용자 전용 헬퍼 — 익명 호출만 차단
--      (user_is_admin · _user_room_ids 는 RLS 정책 안에서 authenticated 로
--       평가되므로 authenticated 권한은 유지해야 한다)
revoke execute on function public.user_is_admin(uuid) from public, anon;
revoke execute on function public._user_room_ids() from public, anon;
revoke execute on function public._calc_fee_rate(text, text) from public, anon;
revoke execute on function public._gen_invite_code() from public, anon;
revoke execute on function public._kr_nxt_session(timestamptz) from public, anon;
revoke execute on function public._kr_spread_bps(numeric) from public, anon;

-- 2-d) 앞으로 만드는 함수의 기본 EXECUTE 권한 정리 (Supabase 권장 하드닝)
--      Supabase 가 postgres 역할의 public 스키마 기본 권한으로 걸어 둔
--      anon·authenticated 직접 grant 를 제거한다. PostgreSQL 내장 기본값인
--      PUBLIC 의 EXECUTE 는 스키마 단위 설정으로는 지워지지 않으므로, 이후
--      마이그레이션에서도 기존 컨벤션을 반드시 유지한다:
--        revoke all on function ... from public;
--        grant execute on function ... to authenticated;   -- 사용자 호출용일 때만
--        grant execute on function ... to service_role;    -- 워커 전용일 때
alter default privileges in schema public
  revoke execute on functions from public;
alter default privileges in schema public
  revoke execute on functions from anon, authenticated;

-- 2-e) 검증: 위 함수가 여전히 anon/authenticated 로 실행 가능하면 마이그레이션 실패
do $$
declare
  r record;
  v_bad text := '';
begin
  for r in
    select p.oid::regprocedure as fn
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in (
        'apply_dividend', 'apply_corporate_action', 'match_limit_order',
        'expire_pending_order', 'transition_room_lifecycle',
        'compute_portfolio_value', 'enqueue_notification',
        'refresh_leaderboard_rankings', 'handle_new_user',
        'tg_leaderboard_profiles_updated_at', 'tg_profiles_protect_admin_flag'
      )
  loop
    if has_function_privilege('anon', r.fn, 'execute')
       or has_function_privilege('authenticated', r.fn, 'execute') then
      v_bad := v_bad || r.fn::text || ' ';
    end if;
  end loop;
  if v_bad <> '' then
    raise exception 'service-only functions still executable by anon/authenticated: %', v_bad;
  end if;
end;
$$;

-- ═══════════════════════════════════════════════════════════════
-- 3) 리더보드: MV 직접 노출 중단, 익명 사용자 식별자 제거 뷰
-- ═══════════════════════════════════════════════════════════════
-- MV 에는 RLS 를 걸 수 없다. 기존에는 anon·authenticated 가 MV 를 직접 읽어
-- visibility='anonymous' 사용자의 user_id·portfolio_id 까지 보였다.
revoke select on public.leaderboard_rankings from public, anon, authenticated;

-- 뷰는 소유자(postgres) 권한으로 MV 를 읽는다 (security_invoker 기본값 off).
-- 식별자는 visibility='public' 일 때만 내보내고, 본인 여부는 is_me 로만 알린다.
create or replace view public.leaderboard_public as
select
  case when r.visibility = 'public' then r.user_id end as user_id,
  r.visibility,
  case when r.visibility = 'public' then r.nickname end as nickname,
  r.return_overall_pct,
  r.return_30d_pct,
  r.sharpe_30d,
  r.trade_count,
  r.snapshot_ts,
  r.qualified,
  r.portfolio_age,
  coalesce(r.user_id = auth.uid(), false) as is_me
from public.leaderboard_rankings r;

revoke all on public.leaderboard_public from public, anon;
grant select on public.leaderboard_public to authenticated, service_role;

comment on view public.leaderboard_public is
  '보안 강화: leaderboard_rankings 의 공개 투영. 익명 사용자의 user_id/nickname 은 NULL, 본인 여부는 is_me.';
