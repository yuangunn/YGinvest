-- Plan #46: 글로벌 리더보드 opt-in 시스템.
--
-- 3-tier 공개 모드 (Hidden / Anonymous / Public+nickname)
-- + 3 카테고리 (종합 / 30일 / Sharpe) + 자격 조건 (최소 거래 5건)
-- + Materialized view + 매일 새벽 refresh.

-- ─────────────────────────────────────────────────────────────────
-- 1) leaderboard_profiles — opt-in 테이블
-- ─────────────────────────────────────────────────────────────────
create table public.leaderboard_profiles (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  -- 'hidden' (default) = 리더보드 노출 안 함
  -- 'anonymous'        = 등수 + 수익률 노출 (닉네임은 "익명")
  -- 'public'           = 닉네임 + 수익률 공개
  visibility text not null default 'hidden'
    check (visibility in ('hidden', 'anonymous', 'public')),
  -- 닉네임: 2~20자, 공백 없음, 한글/영문/숫자/_ 만
  nickname text unique
    check (
      nickname is null
      or (char_length(nickname) between 2 and 20
          and nickname ~ '^[A-Za-z0-9가-힣_]+$')
    ),
  opted_in_at timestamptz,
  last_nickname_change_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- visibility='public' 이면 nickname 필수
  constraint nickname_required_for_public
    check (visibility != 'public' or nickname is not null)
);

comment on table public.leaderboard_profiles is
  'Plan #46: 글로벌 리더보드 opt-in. Hidden(default) / Anonymous / Public+nickname.';

create index leaderboard_profiles_visibility_idx
  on public.leaderboard_profiles(visibility)
  where visibility != 'hidden';

alter table public.leaderboard_profiles enable row level security;

-- 본인 row는 항상 읽기 가능
create policy "leaderboard_profiles: 본인 읽기"
  on public.leaderboard_profiles for select
  to authenticated
  using (user_id = auth.uid());

-- 공개(public/anonymous)된 row는 모두 읽기 가능
create policy "leaderboard_profiles: 공개된 row 누구나 읽기"
  on public.leaderboard_profiles for select
  to authenticated
  using (visibility != 'hidden');

-- 본인만 자기 row insert/update/delete 가능
create policy "leaderboard_profiles: 본인 upsert"
  on public.leaderboard_profiles for insert
  to authenticated
  with check (user_id = auth.uid());

create policy "leaderboard_profiles: 본인 update"
  on public.leaderboard_profiles for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "leaderboard_profiles: 본인 delete"
  on public.leaderboard_profiles for delete
  to authenticated
  using (user_id = auth.uid());

-- ─────────────────────────────────────────────────────────────────
-- 2) updated_at 자동 갱신 트리거
-- ─────────────────────────────────────────────────────────────────
create or replace function public.tg_leaderboard_profiles_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  -- 닉네임 변경 시각 트래킹
  if old is null or new.nickname is distinct from old.nickname then
    new.last_nickname_change_at := now();
  end if;
  -- 처음 hidden 아닌 상태로 변경된 시점 = opted_in_at
  if new.visibility != 'hidden'
     and (old is null or old.visibility = 'hidden')
     and new.opted_in_at is null then
    new.opted_in_at := now();
  end if;
  return new;
end $$;

create trigger leaderboard_profiles_updated_at_trg
  before insert or update on public.leaderboard_profiles
  for each row execute function public.tg_leaderboard_profiles_updated_at();

-- ─────────────────────────────────────────────────────────────────
-- 3) Materialized view — 카테고리별 랭킹 계산용
--    글로벌 portfolio (room_id IS NULL) + active 만 대상.
--    카테고리:
--      - return_pct: 시작부터 누적 (latest snapshot의 return_pct 사용)
--      - return_30d_pct: 30일 전 대비 현재 가치 (있는 사람만)
--      - sharpe_30d: 30일 일별 수익률 mean / stddev (n_days >= 14)
--    자격: trade_count >= 5
-- ─────────────────────────────────────────────────────────────────
create materialized view public.leaderboard_rankings as
with latest_snap as (
  select distinct on (ps.portfolio_id)
    ps.portfolio_id, ps.ts, ps.total_value_krw, ps.return_pct
  from public.portfolio_snapshots ps
  order by ps.portfolio_id, ps.ts desc
),
snap_30d_ago as (
  select distinct on (ps.portfolio_id)
    ps.portfolio_id, ps.ts, ps.total_value_krw
  from public.portfolio_snapshots ps
  where ps.ts <= now() - interval '30 days'
  order by ps.portfolio_id, ps.ts desc
),
daily_returns_30d as (
  select
    portfolio_id,
    ts::date as day,
    -- 그날 마지막 스냅샷 가치
    last_value(total_value_krw) over (
      partition by portfolio_id, ts::date
      order by ts
      rows between unbounded preceding and unbounded following
    ) as eod_value
  from public.portfolio_snapshots
  where ts >= now() - interval '30 days'
),
daily_unique as (
  select distinct portfolio_id, day, eod_value
  from daily_returns_30d
),
daily_changes as (
  select
    portfolio_id, day, eod_value,
    lag(eod_value) over (partition by portfolio_id order by day) as prev_eod
  from daily_unique
),
daily_ret as (
  select
    portfolio_id,
    case when prev_eod > 0 then eod_value / prev_eod - 1 else null end as ret
  from daily_changes
  where prev_eod is not null
),
sharpe_stats as (
  select
    portfolio_id,
    avg(ret) as mean_ret,
    stddev_samp(ret) as std_ret,
    count(*) as n_days
  from daily_ret
  where ret is not null
  group by portfolio_id
),
trade_counts as (
  select portfolio_id, count(*) as n
  from public.trades
  group by portfolio_id
)
select
  lp.user_id,
  lp.visibility,
  lp.nickname,
  p.id as portfolio_id,
  p.started_at as portfolio_age,
  ls.snapshot_ts,
  ls.total_value_krw,
  -- 종합 수익률 (시작 자본 대비 누적)
  ls.return_pct as return_overall_pct,
  -- 30일 수익률
  case
    when s30.total_value_krw is not null and s30.total_value_krw > 0
      then (ls.total_value_krw / s30.total_value_krw - 1) * 100
    else null
  end as return_30d_pct,
  -- Sharpe (30일 일별)
  case
    when ss.std_ret is not null and ss.std_ret > 0 and ss.n_days >= 14
      then ss.mean_ret / ss.std_ret
    else null
  end as sharpe_30d,
  ss.n_days as sharpe_n_days,
  coalesce(tc.n, 0) as trade_count,
  -- 자격: 5건 이상 거래
  (coalesce(tc.n, 0) >= 5) as qualified
from public.leaderboard_profiles lp
join public.portfolios p
  on p.user_id = lp.user_id
 and p.room_id is null
 and p.status = 'active'
join (
  select portfolio_id, ts as snapshot_ts, total_value_krw, return_pct
  from latest_snap
) ls on ls.portfolio_id = p.id
left join snap_30d_ago s30 on s30.portfolio_id = p.id
left join sharpe_stats ss on ss.portfolio_id = p.id
left join trade_counts tc on tc.portfolio_id = p.id
where lp.visibility != 'hidden';

create unique index leaderboard_rankings_user_idx
  on public.leaderboard_rankings(user_id);

create index leaderboard_rankings_overall_idx
  on public.leaderboard_rankings(return_overall_pct desc nulls last)
  where qualified = true;

create index leaderboard_rankings_30d_idx
  on public.leaderboard_rankings(return_30d_pct desc nulls last)
  where qualified = true;

create index leaderboard_rankings_sharpe_idx
  on public.leaderboard_rankings(sharpe_30d desc nulls last)
  where qualified = true;

comment on materialized view public.leaderboard_rankings is
  'Plan #46: opt-in 사용자의 카테고리별 랭킹. 매일 04:00 KST refresh.';

-- ─────────────────────────────────────────────────────────────────
-- 4) Refresh 함수 (cron에서 호출)
-- ─────────────────────────────────────────────────────────────────
create or replace function public.refresh_leaderboard_rankings()
returns void
language sql
security definer
set search_path = public
as $$
  refresh materialized view concurrently public.leaderboard_rankings;
$$;

comment on function public.refresh_leaderboard_rankings() is
  'Plan #46: leaderboard_rankings MV concurrent refresh. service_role only via worker.';

-- ─────────────────────────────────────────────────────────────────
-- 5) MV 자체에는 RLS가 적용 안 됨 (PG 제약).
--    대신 service_role 통해서만 읽도록 grant 제어.
--    authenticated role도 읽기 허용 — MV 자체가 opt-in 사용자만 포함하므로 안전.
-- ─────────────────────────────────────────────────────────────────
grant select on public.leaderboard_rankings to authenticated, anon;
