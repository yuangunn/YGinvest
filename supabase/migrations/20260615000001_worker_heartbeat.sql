-- Plan #48: 외부 dead-man's switch용 worker heartbeat 테이블.
--
-- 문제: health_monitor / heartbeat 잡이 모두 워커 프로세스 안에서 돈다.
-- 워커가 죽으면 "워커가 죽었다"고 알려줄 감시자도 같이 죽어 무음 장애가 됨
-- (2026-06-05 워커 다운 → 9일간 아무도 모름).
--
-- 해결: heartbeat 잡이 매 60초 이 테이블에 ts를 찍는다. 워커 *밖*(GitHub Actions
-- cron)에서 이 ts가 오래됐는지 검사 → 오래되면 Telegram 알림. heartbeat는 시장
-- 시간과 무관하게 항상 돌기 때문에 ts staleness = 워커 다운의 명확한 신호.

create table public.worker_heartbeat (
  -- 단일 행 패턴 — 항상 id='worker' 1행만 upsert.
  id text primary key,
  ts timestamptz not null default now(),
  -- 진단용 메타 (선택): 워커 버전 / 호스트 등.
  meta jsonb not null default '{}'::jsonb
);

comment on table public.worker_heartbeat is
  'Plan #48: 외부 dead-man monitor용. heartbeat 잡이 매 60초 ts 갱신. '
  'GitHub Actions(worker-deadman.yml)가 ts staleness로 워커 다운 감지.';

-- 부팅 직후 외부 모니터가 "데이터 없음"으로 오인하지 않도록 seed 행 1개.
insert into public.worker_heartbeat (id, ts)
values ('worker', now())
on conflict (id) do nothing;

-- RLS: 관리자만 읽기 (health_alerts와 동일 정책). service_role은 RLS 우회.
alter table public.worker_heartbeat enable row level security;

create policy "worker_heartbeat: admin 읽기"
  on public.worker_heartbeat for select
  to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.is_admin = true
    )
  );
