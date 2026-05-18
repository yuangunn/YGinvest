-- Plan #47.1: macro_indicators에 KOSDAQ + 비트코인 추가.
-- 시황 brief의 macro_snapshot이 더 풍부해지도록.

insert into public.macro_meta (symbol, yf_ticker, name_ko, group_name, sort_order, unit)
values
  ('KOSDAQ', '^KQ11', 'KOSDAQ', 'index', 102, ''),
  ('BTC_USD', 'BTC-USD', '비트코인 (USD)', 'commodity', 65, '$')
on conflict (symbol) do update set
  yf_ticker = excluded.yf_ticker,
  name_ko = excluded.name_ko,
  group_name = excluded.group_name,
  sort_order = excluded.sort_order,
  unit = excluded.unit;
