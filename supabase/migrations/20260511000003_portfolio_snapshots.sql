create table public.portfolio_snapshots (
  portfolio_id uuid not null references public.portfolios(id) on delete cascade,
  ts timestamptz not null,
  total_value_krw numeric(20,4) not null,
  return_pct numeric(10,4) not null,
  primary key (portfolio_id, ts)
);

create index portfolio_snapshots_latest_idx
  on public.portfolio_snapshots (portfolio_id, ts desc);

alter table public.portfolio_snapshots enable row level security;

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
      where rm.room_id in (
        select room_id from public.room_members where user_id = auth.uid()
      )
    )
  );

comment on table public.portfolio_snapshots is '5분 주기 포트폴리오 가치 시계열. 리더보드 + 차트용';
