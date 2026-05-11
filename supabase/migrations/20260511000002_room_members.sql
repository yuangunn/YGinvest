create table public.room_members (
  room_id uuid not null references public.rooms(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  portfolio_id uuid not null references public.portfolios(id) on delete cascade unique,
  joined_at timestamptz not null default now(),
  primary key (room_id, user_id)
);

create index room_members_user_idx on public.room_members (user_id, joined_at desc);
create index room_members_room_idx on public.room_members (room_id, joined_at);

-- RLS는 Task 4에서 일괄 추가 (방 멤버끼리 서로 볼 수 있게).
alter table public.room_members enable row level security;

comment on table public.room_members is '방 멤버십. portfolio_id는 사용자의 방별 포트폴리오';
