-- Plan #20: 테마주 계층 시스템
-- themes: adjacency list (parent_id) — 계층 구조
-- stock_themes: N:N junction with weight (한 종목이 여러 테마, 비중 0~1)

-- =========================================================================
-- 1) themes
-- =========================================================================
create table public.themes (
  id uuid primary key default gen_random_uuid(),
  parent_id uuid references public.themes(id) on delete cascade,
  slug text unique not null,        -- "semiconductor", "memory", "foundry"
  name text not null,                -- "반도체", "메모리 반도체"
  name_en text,                      -- "Semiconductor"
  description text,
  created_at timestamptz not null default now()
);

create index themes_parent_idx on public.themes (parent_id);
create index themes_slug_idx on public.themes (slug);

alter table public.themes enable row level security;
-- 모든 인증 사용자 read
create policy themes_read_all
  on public.themes for select
  to authenticated
  using (true);

comment on table public.themes is
  'Plan #20: 테마주 계층 — adjacency list. 반도체 > 메모리, 파운드리 등';

-- =========================================================================
-- 2) stock_themes (N:N)
-- =========================================================================
create table public.stock_themes (
  stock_symbol text not null references public.stocks(symbol) on delete cascade,
  theme_id uuid not null references public.themes(id) on delete cascade,
  weight numeric(3,2) not null default 1.00 check (weight >= 0 and weight <= 1),
  created_at timestamptz not null default now(),
  primary key (stock_symbol, theme_id)
);

create index stock_themes_theme_idx on public.stock_themes (theme_id);
create index stock_themes_stock_idx on public.stock_themes (stock_symbol);

alter table public.stock_themes enable row level security;
create policy stock_themes_read_all
  on public.stock_themes for select
  to authenticated
  using (true);

comment on table public.stock_themes is
  'Plan #20: 종목-테마 N:N. weight는 해당 테마 내 비중 (0~1)';

-- =========================================================================
-- 3) Seed data — Korean market 중심
-- =========================================================================

-- ===== ROOT THEMES =====
insert into public.themes (id, parent_id, slug, name, name_en, description) values
  ('11111111-1111-1111-1111-000000000001', null, 'semiconductor', '반도체', 'Semiconductor', '메모리/시스템반도체/파운드리/장비/소재 전반'),
  ('11111111-1111-1111-1111-000000000002', null, 'battery', '2차전지', 'Battery', '배터리 셀/소재/장비'),
  ('11111111-1111-1111-1111-000000000003', null, 'ai-software', 'AI/소프트웨어', 'AI/Software', '인공지능 + 클라우드 + 소프트웨어'),
  ('11111111-1111-1111-1111-000000000004', null, 'bio', '바이오/제약', 'Bio/Pharma', '신약/CMO/진단'),
  ('11111111-1111-1111-1111-000000000005', null, 'defense', 'K-방위산업', 'Defense', '한국 방산 수출'),
  ('11111111-1111-1111-1111-000000000006', null, 'k-content', 'K-콘텐츠', 'K-Content', '엔터/게임/미디어'),
  ('11111111-1111-1111-1111-000000000007', null, 'mobility', '모빌리티/전기차', 'Mobility/EV', '완성차 + 자율주행'),
  ('11111111-1111-1111-1111-000000000008', null, 'finance', '금융', 'Finance', '은행/증권/보험');

-- ===== SEMICONDUCTOR SUB-THEMES =====
insert into public.themes (id, parent_id, slug, name, name_en, description) values
  ('22222222-2222-2222-2222-000000000001', '11111111-1111-1111-1111-000000000001', 'memory', '메모리 반도체', 'Memory Semiconductor', 'DRAM/NAND'),
  ('22222222-2222-2222-2222-000000000002', '11111111-1111-1111-1111-000000000001', 'system-semi', '시스템 반도체', 'System Semiconductor', 'CPU/AP/GPU 설계'),
  ('22222222-2222-2222-2222-000000000003', '11111111-1111-1111-1111-000000000001', 'foundry', '파운드리/위탁제조', 'Foundry', '반도체 위탁생산'),
  ('22222222-2222-2222-2222-000000000004', '11111111-1111-1111-1111-000000000001', 'semi-equipment', '반도체 장비', 'Semiconductor Equipment', '전공정/후공정 장비'),
  ('22222222-2222-2222-2222-000000000005', '11111111-1111-1111-1111-000000000001', 'semi-materials', '반도체 소재', 'Semiconductor Materials', '소부장 — 가스/약품/PR'),
  ('22222222-2222-2222-2222-000000000006', '11111111-1111-1111-1111-000000000001', 'hbm-ai-semi', 'HBM/AI 반도체', 'HBM/AI Semi', '고대역폭 메모리 + AI 가속기');

-- ===== BATTERY SUB-THEMES =====
insert into public.themes (id, parent_id, slug, name, name_en, description) values
  ('33333333-3333-3333-3333-000000000001', '11111111-1111-1111-1111-000000000002', 'battery-cell', '배터리 셀', 'Battery Cell', '완제품 셀 제조'),
  ('33333333-3333-3333-3333-000000000002', '11111111-1111-1111-1111-000000000002', 'cathode', '양극재', 'Cathode Material', '하이니켈/LFP'),
  ('33333333-3333-3333-3333-000000000003', '11111111-1111-1111-1111-000000000002', 'anode', '음극재', 'Anode Material', '흑연/실리콘'),
  ('33333333-3333-3333-3333-000000000004', '11111111-1111-1111-1111-000000000002', 'separator', '분리막', 'Separator', ''),
  ('33333333-3333-3333-3333-000000000005', '11111111-1111-1111-1111-000000000002', 'electrolyte', '전해액', 'Electrolyte', ''),
  ('33333333-3333-3333-3333-000000000006', '11111111-1111-1111-1111-000000000002', 'battery-equipment', '배터리 장비', 'Battery Equipment', '');

-- ===== AI/SOFTWARE SUB-THEMES =====
insert into public.themes (id, parent_id, slug, name, name_en, description) values
  ('44444444-4444-4444-4444-000000000001', '11111111-1111-1111-1111-000000000003', 'llm-ai', 'LLM/생성AI', 'LLM/Generative AI', ''),
  ('44444444-4444-4444-4444-000000000002', '11111111-1111-1111-1111-000000000003', 'cloud', '클라우드', 'Cloud', ''),
  ('44444444-4444-4444-4444-000000000003', '11111111-1111-1111-1111-000000000003', 'saas', 'SaaS/엔터프라이즈SW', 'SaaS', ''),
  ('44444444-4444-4444-4444-000000000004', '11111111-1111-1111-1111-000000000003', 'cybersecurity', '사이버보안', 'Cybersecurity', '');

-- ===== BIO SUB-THEMES =====
insert into public.themes (id, parent_id, slug, name, name_en, description) values
  ('55555555-5555-5555-5555-000000000001', '11111111-1111-1111-1111-000000000004', 'new-drug', '신약개발', 'New Drug Development', ''),
  ('55555555-5555-5555-5555-000000000002', '11111111-1111-1111-1111-000000000004', 'cmo-cdmo', 'CMO/CDMO', 'CMO/CDMO', '의약품 위탁생산'),
  ('55555555-5555-5555-5555-000000000003', '11111111-1111-1111-1111-000000000004', 'diagnostics', '진단/의료기기', 'Diagnostics', ''),
  ('55555555-5555-5555-5555-000000000004', '11111111-1111-1111-1111-000000000004', 'biosimilar', '바이오시밀러', 'Biosimilar', '');

-- ===== DEFENSE SUB-THEMES =====
insert into public.themes (id, parent_id, slug, name, name_en, description) values
  ('66666666-6666-6666-6666-000000000001', '11111111-1111-1111-1111-000000000005', 'aerospace-defense', '항공/우주방산', 'Aerospace Defense', ''),
  ('66666666-6666-6666-6666-000000000002', '11111111-1111-1111-1111-000000000005', 'ground-defense', '지상방산', 'Ground Defense', 'K2전차, K9자주포');

-- ===== K-CONTENT SUB-THEMES =====
insert into public.themes (id, parent_id, slug, name, name_en, description) values
  ('77777777-7777-7777-7777-000000000001', '11111111-1111-1111-1111-000000000006', 'k-ent', 'K-엔터테인먼트', 'K-Entertainment', 'K-팝/매니지먼트'),
  ('77777777-7777-7777-7777-000000000002', '11111111-1111-1111-1111-000000000006', 'gaming', '게임', 'Gaming', ''),
  ('77777777-7777-7777-7777-000000000003', '11111111-1111-1111-1111-000000000006', 'media-drama', '미디어/드라마', 'Media/Drama', '');

-- ===== MOBILITY SUB-THEMES =====
insert into public.themes (id, parent_id, slug, name, name_en, description) values
  ('88888888-8888-8888-8888-000000000001', '11111111-1111-1111-1111-000000000007', 'auto-oem', '완성차', 'Auto OEM', ''),
  ('88888888-8888-8888-8888-000000000002', '11111111-1111-1111-1111-000000000007', 'auto-parts', '자동차 부품', 'Auto Parts', ''),
  ('88888888-8888-8888-8888-000000000003', '11111111-1111-1111-1111-000000000007', 'autonomous', '자율주행', 'Autonomous Driving', '');

-- ===== FINANCE SUB-THEMES =====
insert into public.themes (id, parent_id, slug, name, name_en, description) values
  ('99999999-9999-9999-9999-000000000001', '11111111-1111-1111-1111-000000000008', 'banking', '은행', 'Banking', ''),
  ('99999999-9999-9999-9999-000000000002', '11111111-1111-1111-1111-000000000008', 'securities', '증권', 'Securities', ''),
  ('99999999-9999-9999-9999-000000000003', '11111111-1111-1111-1111-000000000008', 'insurance', '보험', 'Insurance', '');

-- =========================================================================
-- 4) Stock-theme mappings (Korean priority + key US)
-- 종목이 stocks 테이블에 없으면 INSERT 실패 — ON CONFLICT DO NOTHING으로 graceful
-- =========================================================================

-- 메모리 반도체
insert into public.stock_themes (stock_symbol, theme_id, weight) values
  ('005930.KS', '22222222-2222-2222-2222-000000000001', 1.00),  -- 삼성전자
  ('000660.KS', '22222222-2222-2222-2222-000000000001', 1.00)   -- SK하이닉스
on conflict do nothing;

-- HBM/AI 반도체
insert into public.stock_themes (stock_symbol, theme_id, weight) values
  ('005930.KS', '22222222-2222-2222-2222-000000000006', 0.60),
  ('000660.KS', '22222222-2222-2222-2222-000000000006', 0.90),
  ('NVDA', '22222222-2222-2222-2222-000000000006', 1.00),
  ('AMD', '22222222-2222-2222-2222-000000000006', 0.80)
on conflict do nothing;

-- 시스템반도체
insert into public.stock_themes (stock_symbol, theme_id, weight) values
  ('005930.KS', '22222222-2222-2222-2222-000000000002', 0.40),
  ('NVDA', '22222222-2222-2222-2222-000000000002', 1.00),
  ('AMD', '22222222-2222-2222-2222-000000000002', 1.00),
  ('INTC', '22222222-2222-2222-2222-000000000002', 0.90),
  ('QCOM', '22222222-2222-2222-2222-000000000002', 1.00)
on conflict do nothing;

-- 파운드리/위탁제조
insert into public.stock_themes (stock_symbol, theme_id, weight) values
  ('005930.KS', '22222222-2222-2222-2222-000000000003', 0.30),  -- Samsung Foundry
  ('TSM', '22222222-2222-2222-2222-000000000003', 1.00),
  ('000990.KS', '22222222-2222-2222-2222-000000000003', 1.00)   -- DB하이텍
on conflict do nothing;

-- 반도체 장비 (KOSDAQ 위주)
insert into public.stock_themes (stock_symbol, theme_id, weight) values
  ('240810.KQ', '22222222-2222-2222-2222-000000000004', 1.00),  -- 원익IPS
  ('095340.KQ', '22222222-2222-2222-2222-000000000004', 1.00),  -- ISC
  ('AMAT', '22222222-2222-2222-2222-000000000004', 1.00),
  ('LRCX', '22222222-2222-2222-2222-000000000004', 1.00),
  ('ASML', '22222222-2222-2222-2222-000000000004', 1.00),
  ('KLAC', '22222222-2222-2222-2222-000000000004', 1.00)
on conflict do nothing;

-- 반도체 소재
insert into public.stock_themes (stock_symbol, theme_id, weight) values
  ('036490.KS', '22222222-2222-2222-2222-000000000005', 1.00)   -- SK머티리얼즈
on conflict do nothing;

-- 배터리 셀
insert into public.stock_themes (stock_symbol, theme_id, weight) values
  ('373220.KS', '33333333-3333-3333-3333-000000000001', 1.00),  -- LG에너지솔루션
  ('006400.KS', '33333333-3333-3333-3333-000000000001', 1.00),  -- 삼성SDI
  ('051910.KS', '33333333-3333-3333-3333-000000000001', 0.70),  -- LG화학
  ('TSLA', '33333333-3333-3333-3333-000000000001', 0.40)
on conflict do nothing;

-- 양극재
insert into public.stock_themes (stock_symbol, theme_id, weight) values
  ('247540.KQ', '33333333-3333-3333-3333-000000000002', 1.00),  -- 에코프로비엠
  ('003670.KS', '33333333-3333-3333-3333-000000000002', 1.00),  -- 포스코퓨처엠
  ('086520.KQ', '33333333-3333-3333-3333-000000000002', 1.00)   -- 에코프로
on conflict do nothing;

-- 음극재
insert into public.stock_themes (stock_symbol, theme_id, weight) values
  ('003670.KS', '33333333-3333-3333-3333-000000000003', 0.60),
  ('011170.KS', '33333333-3333-3333-3333-000000000003', 0.70)   -- 롯데케미칼
on conflict do nothing;

-- LLM/생성AI
insert into public.stock_themes (stock_symbol, theme_id, weight) values
  ('NVDA', '44444444-4444-4444-4444-000000000001', 1.00),
  ('MSFT', '44444444-4444-4444-4444-000000000001', 0.90),
  ('GOOGL', '44444444-4444-4444-4444-000000000001', 1.00),
  ('META', '44444444-4444-4444-4444-000000000001', 0.80),
  ('035420.KS', '44444444-4444-4444-4444-000000000001', 0.80),  -- NAVER
  ('035720.KS', '44444444-4444-4444-4444-000000000001', 0.70)   -- 카카오
on conflict do nothing;

-- 클라우드
insert into public.stock_themes (stock_symbol, theme_id, weight) values
  ('MSFT', '44444444-4444-4444-4444-000000000002', 1.00),
  ('AMZN', '44444444-4444-4444-4444-000000000002', 1.00),
  ('GOOGL', '44444444-4444-4444-4444-000000000002', 0.70)
on conflict do nothing;

-- CMO/CDMO
insert into public.stock_themes (stock_symbol, theme_id, weight) values
  ('207940.KS', '55555555-5555-5555-5555-000000000002', 1.00)   -- 삼성바이오로직스
on conflict do nothing;

-- 신약개발
insert into public.stock_themes (stock_symbol, theme_id, weight) values
  ('068270.KS', '55555555-5555-5555-5555-000000000001', 1.00),  -- 셀트리온
  ('128940.KS', '55555555-5555-5555-5555-000000000001', 1.00),  -- 한미약품
  ('170900.KS', '55555555-5555-5555-5555-000000000001', 1.00)   -- 동아에스티
on conflict do nothing;

-- 바이오시밀러
insert into public.stock_themes (stock_symbol, theme_id, weight) values
  ('068270.KS', '55555555-5555-5555-5555-000000000004', 1.00),
  ('207940.KS', '55555555-5555-5555-5555-000000000004', 0.50)
on conflict do nothing;

-- 항공/우주방산
insert into public.stock_themes (stock_symbol, theme_id, weight) values
  ('047810.KS', '66666666-6666-6666-6666-000000000001', 1.00),  -- 한국항공우주
  ('012450.KS', '66666666-6666-6666-6666-000000000001', 0.80)   -- 한화에어로스페이스
on conflict do nothing;

-- 지상방산
insert into public.stock_themes (stock_symbol, theme_id, weight) values
  ('272210.KS', '66666666-6666-6666-6666-000000000002', 1.00),  -- 한화시스템
  ('012450.KS', '66666666-6666-6666-6666-000000000002', 0.70),
  ('079550.KS', '66666666-6666-6666-6666-000000000002', 1.00)   -- LIG넥스원
on conflict do nothing;

-- K-엔터
insert into public.stock_themes (stock_symbol, theme_id, weight) values
  ('035900.KQ', '77777777-7777-7777-7777-000000000001', 1.00),  -- JYP엔터
  ('122870.KS', '77777777-7777-7777-7777-000000000001', 1.00),  -- 와이지엔터
  ('352820.KS', '77777777-7777-7777-7777-000000000001', 1.00)   -- HYBE
on conflict do nothing;

-- 게임
insert into public.stock_themes (stock_symbol, theme_id, weight) values
  ('251270.KS', '77777777-7777-7777-7777-000000000002', 1.00),  -- 넷마블
  ('259960.KS', '77777777-7777-7777-7777-000000000002', 1.00),  -- 크래프톤
  ('036570.KS', '77777777-7777-7777-7777-000000000002', 1.00)   -- 엔씨소프트
on conflict do nothing;

-- 미디어/드라마
insert into public.stock_themes (stock_symbol, theme_id, weight) values
  ('253450.KQ', '77777777-7777-7777-7777-000000000003', 1.00)   -- 스튜디오드래곤
on conflict do nothing;

-- 완성차
insert into public.stock_themes (stock_symbol, theme_id, weight) values
  ('005380.KS', '88888888-8888-8888-8888-000000000001', 1.00),  -- 현대차
  ('000270.KS', '88888888-8888-8888-8888-000000000001', 1.00),  -- 기아
  ('TSLA', '88888888-8888-8888-8888-000000000001', 1.00),
  ('F', '88888888-8888-8888-8888-000000000001', 0.80)
on conflict do nothing;

-- 자동차 부품
insert into public.stock_themes (stock_symbol, theme_id, weight) values
  ('012330.KS', '88888888-8888-8888-8888-000000000002', 1.00),  -- 현대모비스
  ('018880.KS', '88888888-8888-8888-8888-000000000002', 0.80)   -- 한온시스템
on conflict do nothing;

-- 자율주행
insert into public.stock_themes (stock_symbol, theme_id, weight) values
  ('TSLA', '88888888-8888-8888-8888-000000000003', 0.70),
  ('GOOGL', '88888888-8888-8888-8888-000000000003', 0.40),
  ('NVDA', '88888888-8888-8888-8888-000000000003', 0.50)
on conflict do nothing;

-- 은행
insert into public.stock_themes (stock_symbol, theme_id, weight) values
  ('055550.KS', '99999999-9999-9999-9999-000000000001', 1.00),  -- 신한지주
  ('086790.KS', '99999999-9999-9999-9999-000000000001', 1.00),  -- 하나금융지주
  ('024110.KS', '99999999-9999-9999-9999-000000000001', 1.00),  -- 기업은행
  ('JPM', '99999999-9999-9999-9999-000000000001', 1.00),
  ('BAC', '99999999-9999-9999-9999-000000000001', 1.00)
on conflict do nothing;

-- 증권
insert into public.stock_themes (stock_symbol, theme_id, weight) values
  ('006800.KS', '99999999-9999-9999-9999-000000000002', 1.00),  -- 미래에셋증권
  ('016360.KS', '99999999-9999-9999-9999-000000000002', 1.00)   -- 삼성증권
on conflict do nothing;

-- 보험
insert into public.stock_themes (stock_symbol, theme_id, weight) values
  ('000810.KS', '99999999-9999-9999-9999-000000000003', 1.00),  -- 삼성화재
  ('088350.KS', '99999999-9999-9999-9999-000000000003', 1.00),  -- 한화생명
  ('032830.KS', '99999999-9999-9999-9999-000000000003', 1.00)   -- 삼성생명
on conflict do nothing;
