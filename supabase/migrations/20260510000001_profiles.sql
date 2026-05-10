create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index profiles_display_name_idx on public.profiles (display_name);

comment on table public.profiles is '사용자 프로필 (auth.users 1:1)';
