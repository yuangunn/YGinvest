create table public.stock_bars (
  symbol text not null references public.stocks(symbol) on delete cascade,
  interval text not null check (interval in ('15m', '1h', '1d')),
  ts timestamptz not null,
  open numeric(20,4) not null,
  high numeric(20,4) not null,
  low numeric(20,4) not null,
  close numeric(20,4) not null,
  volume bigint not null default 0,
  primary key (symbol, interval, ts)
);

create index stock_bars_symbol_interval_ts_idx
  on public.stock_bars (symbol, interval, ts desc);

-- RLS: 누구나 읽기 (가격 데이터 공개), 쓰기는 service_role만
alter table public.stock_bars enable row level security;

create policy "stock_bars: 누구나 읽기"
  on public.stock_bars for select
  to anon, authenticated
  using (true);

comment on table public.stock_bars is '시계열 OHLCV. v1은 일봉(1d)만, 인트라데이는 v1.5에서 추가';
