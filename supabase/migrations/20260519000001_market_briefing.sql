-- Plan #47: 일일 시장 시황 브리핑 (대시보드 popup + 상세 페이지).
--
-- 매일 06:30 KST에 worker가:
--   1) RSS feed 5-7개 + Yahoo Finance 헤드라인 fetch (~100개)
--   2) Claude Haiku로 키워드 추출 + 카테고리 분류 + 요약 생성
--   3) market_briefing 테이블에 1일 1행 저장
--   4) Web/Telegram이 조회

-- ─────────────────────────────────────────────────────────────────
-- 1) market_briefing — 일자별 시황 (singleton per date)
-- ─────────────────────────────────────────────────────────────────
create table public.market_briefing (
  date date primary key,
  -- AI가 생성한 헤드라인 요약 (3-5줄)
  summary text not null,
  -- 키워드 그룹: [{ keyword, category, count, articles: [{ title, url, source, published_at }] }]
  -- category: 'politics' | 'war' | 'real_estate' | 'monetary' | 'corporate' | 'tech' | 'global' | 'other'
  keywords jsonb not null default '[]'::jsonb,
  -- 매크로 스냅샷 (KOSPI, USD/KRW, 유가, 금 등 — 06:30 시점)
  macro_snapshot jsonb default '{}'::jsonb,
  -- 총 헤드라인 수 (디버깅용)
  source_count int not null default 0,
  -- AI 모델 (claude-haiku-4 등)
  model text,
  -- 입출력 토큰 (비용 추적)
  input_tokens int,
  output_tokens int,
  generated_at timestamptz not null default now()
);

comment on table public.market_briefing is
  'Plan #47: 일일 06:30 KST 생성. 대시보드 popup + /app/market-today 페이지에서 조회.';

-- RLS: 인증된 사용자 누구나 읽기 (개인정보 없음)
alter table public.market_briefing enable row level security;

create policy "briefing: 인증된 사용자 누구나 읽기"
  on public.market_briefing for select
  to authenticated
  using (true);

-- service_role(worker)만 insert/update — 별도 policy 불필요 (service_role은 RLS 우회)

-- ─────────────────────────────────────────────────────────────────
-- 2) 인덱스 — date desc로 최신 조회 (단일 row지만 future-proof)
-- ─────────────────────────────────────────────────────────────────
create index market_briefing_date_desc_idx
  on public.market_briefing (date desc);
