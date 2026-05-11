create table public.rooms (
  id uuid primary key default gen_random_uuid(),
  host_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  invite_code text not null unique,
  starting_krw numeric(20,4) not null check (starting_krw >= 0),
  starting_usd numeric(20,4) not null default 0 check (starting_usd >= 0),
  starts_at timestamptz not null default now(),
  ends_at timestamptz,                              -- NULL = 무제한
  late_join_until timestamptz,                      -- NULL = 무기한 가입 허용
  max_members int not null default 10 check (max_members >= 2 and max_members <= 50),
  status text not null default 'open' check (status in ('open', 'active', 'ended')),
  created_at timestamptz not null default now()
);

create index rooms_host_idx on public.rooms (host_id, created_at desc);
create index rooms_invite_code_idx on public.rooms (invite_code) where status <> 'ended';
create index rooms_status_idx on public.rooms (status, starts_at, ends_at);

-- RLS는 Task 4(20260511000004_room_rls_extensions.sql)에서 room_members 테이블 생성 후 일괄 추가.
-- 그 전엔 service_role만 접근 가능. PG 함수가 모두 security definer라 정상 동작.
alter table public.rooms enable row level security;

comment on table public.rooms is '친구방. 호스트가 starting_krw/usd, starts_at, ends_at 자유 설정';
