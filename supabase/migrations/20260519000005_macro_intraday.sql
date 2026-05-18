-- Plan #47.7: 매크로 지수 실시간 fetch (5분 간격).
-- 일봉(macro_indicators)와 별개. 시황 brief의 macro_snapshot에 우선 사용.

create table public.macro_intraday (
  symbol text not null,
  ts timestamptz not null default now(),
  value numeric(20,4) not null,
  primary key (symbol, ts)
);

-- 최신 조회용 인덱스
create index macro_intraday_latest_idx on public.macro_intraday(symbol, ts desc);

comment on table public.macro_intraday is
  'Plan #47.7: 5분 간격 실시간 매크로 시세 (KOSPI/KOSDAQ/USDKRW 등). 7일 retention.';

-- RLS: authenticated 모두 읽기 가능 (개인정보 X)
alter table public.macro_intraday enable row level security;

create policy "macro_intraday: 인증된 사용자 누구나 읽기"
  on public.macro_intraday for select
  to authenticated
  using (true);

-- 7일 이상 자동 cleanup (worker cleanup_old_data cron에서 실행)
-- 별도 함수는 안 만들고 워커 job에서 직접 delete
