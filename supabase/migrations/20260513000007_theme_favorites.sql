-- Plan #21: 사용자별 테마 즐겨찾기
create table public.theme_favorites (
  user_id uuid not null references auth.users(id) on delete cascade,
  theme_id uuid not null references public.themes(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, theme_id)
);

create index theme_favorites_user_idx on public.theme_favorites (user_id, created_at desc);
create index theme_favorites_theme_idx on public.theme_favorites (theme_id);

alter table public.theme_favorites enable row level security;

create policy theme_favorites_select_own
  on public.theme_favorites for select
  to authenticated
  using (auth.uid() = user_id);

create policy theme_favorites_insert_own
  on public.theme_favorites for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy theme_favorites_delete_own
  on public.theme_favorites for delete
  to authenticated
  using (auth.uid() = user_id);

comment on table public.theme_favorites is
  'Plan #21: 사용자가 즐겨찾는 테마 (대시보드 표시용)';
