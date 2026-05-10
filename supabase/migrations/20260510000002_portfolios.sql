-- rooms 테이블은 Plan #5에서 생성됨. 지금은 room_id를 nullable uuid로만 두고
-- FK는 미설정. Plan #5에서 ALTER TABLE로 FK 추가.
create table public.portfolios (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  room_id uuid,
  starting_krw numeric(20,4) not null,
  starting_usd numeric(20,4) not null default 0,
  fx_rate_at_start numeric(20,8) not null,
  krw_balance numeric(20,4) not null,
  usd_balance numeric(20,4) not null default 0,
  status text not null default 'active' check (status in ('active', 'ended')),
  started_at timestamptz not null default now(),
  ended_at timestamptz
);

-- 사용자당 글로벌 포트폴리오는 1개만
create unique index portfolios_user_global_uniq
  on public.portfolios (user_id) where room_id is null;

-- 사용자당 같은 방의 포트폴리오는 1개만
create unique index portfolios_user_room_uniq
  on public.portfolios (user_id, room_id) where room_id is not null;

create index portfolios_user_id_idx on public.portfolios (user_id);
create index portfolios_room_id_idx on public.portfolios (room_id) where room_id is not null;

comment on table public.portfolios is '경쟁 단위. 글로벌(room_id=NULL) + 방 포트폴리오';
