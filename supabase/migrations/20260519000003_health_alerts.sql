-- Plan #47.3: Worker E2E health monitor용 alert 로그.
--
-- worker가 15분마다 데이터 파이프라인 검사 → 임계치 위반 시 이 테이블에
-- alert 기록 + Telegram 알림. 60분 내 같은 종류 alert 중복 방지에도 사용.

create table public.health_alerts (
  id bigserial primary key,
  alert_key text not null,
  -- 'info' | 'warning' | 'critical'
  severity text not null check (severity in ('info', 'warning', 'critical')),
  message text not null,
  context jsonb not null default '{}'::jsonb,
  ts timestamptz not null default now(),
  acknowledged_at timestamptz
);

create index health_alerts_key_ts_idx on public.health_alerts(alert_key, ts desc);
create index health_alerts_ts_desc_idx on public.health_alerts(ts desc);

comment on table public.health_alerts is
  'Plan #47.3: Worker E2E health monitor alert 로그. 매 15분 cron에서 발견.';

-- RLS: 관리자만 읽기 (sensitive — 시스템 상태 정보)
alter table public.health_alerts enable row level security;

-- admin은 profiles.role='admin' 기준 (기존 admin_role.sql 참조).
-- 일반 사용자는 alert 못 봄.
create policy "health_alerts: admin 읽기"
  on public.health_alerts for select
  to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.is_admin = true
    )
  );

-- worker (service_role)는 RLS 우회하므로 별도 policy 불필요.
