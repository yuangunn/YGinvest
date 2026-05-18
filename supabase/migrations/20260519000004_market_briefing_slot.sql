-- Plan #47.4: market_briefing 1일 2회 (평일 06:30 + 12:30 KST) 지원.
-- date PK → (date, slot) composite PK 변경.
--   slot = 'morning' (06:30, 장 시작 전)
--   slot = 'noon'    (12:30, 오전장 정리)

-- 1) slot 컬럼 추가 (기존 row는 'morning'으로 기본값)
alter table public.market_briefing
  add column if not exists slot text not null default 'morning'
  check (slot in ('morning', 'noon'));

-- 2) 기존 PK 제거 + composite PK 추가
alter table public.market_briefing drop constraint market_briefing_pkey;
alter table public.market_briefing add primary key (date, slot);

-- 3) 인덱스 갱신 (date desc 조회 빈번)
drop index if exists market_briefing_date_desc_idx;
create index market_briefing_date_slot_desc_idx
  on public.market_briefing (date desc, slot desc);

comment on column public.market_briefing.slot is
  'Plan #47.4: morning (06:30 KST, 장 시작 전) | noon (12:30 KST, 오전장 정리)';
