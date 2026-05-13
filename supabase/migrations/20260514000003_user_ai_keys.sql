-- Plan #24: BYOK (Bring Your Own Key) — 사용자별 AI provider API 키 저장.
-- 각 user는 provider별 키를 하나씩 등록 가능. RLS로 본인만 read/write.

create table public.user_ai_keys (
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null check (provider in ('anthropic', 'openai', 'google')),
  api_key text not null,
  model text,  -- optional: claude-3-5-sonnet-latest, gpt-4o-mini, gemini-1.5-flash etc.
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, provider)
);

alter table public.user_ai_keys enable row level security;

create policy user_ai_keys_select_own
  on public.user_ai_keys for select
  to authenticated
  using (auth.uid() = user_id);

create policy user_ai_keys_insert_own
  on public.user_ai_keys for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy user_ai_keys_update_own
  on public.user_ai_keys for update
  to authenticated
  using (auth.uid() = user_id);

create policy user_ai_keys_delete_own
  on public.user_ai_keys for delete
  to authenticated
  using (auth.uid() = user_id);

comment on table public.user_ai_keys is
  'Plan #24: BYOK API keys. RLS로 본인만 접근. 평문 저장 (전송 시 HTTPS).';
