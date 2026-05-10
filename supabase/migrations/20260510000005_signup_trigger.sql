-- 신규 auth.users 행 생성 시 profile + 글로벌 portfolio + notification_settings 자동 생성
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  default_display_name text;
begin
  -- display_name 결정 우선순위: OAuth full_name → user_metadata.display_name → email local part
  default_display_name := coalesce(
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'name',
    new.raw_user_meta_data->>'display_name',
    split_part(new.email, '@', 1)
  );

  insert into public.profiles (id, display_name, avatar_url)
  values (
    new.id,
    default_display_name,
    new.raw_user_meta_data->>'avatar_url'
  );

  -- 글로벌 포트폴리오: 1억 KRW + 0 USD
  -- fx_rate_at_start는 Plan #2에서 fx_rates 테이블 생기면 실시간 환율로 대체.
  -- 지금은 starting_usd=0이라 의미 없으므로 placeholder 1395 사용.
  insert into public.portfolios (user_id, starting_krw, starting_usd, fx_rate_at_start, krw_balance, usd_balance)
  values (new.id, 100000000, 0, 1395, 100000000, 0);

  insert into public.notification_settings (user_id) values (new.id);

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
