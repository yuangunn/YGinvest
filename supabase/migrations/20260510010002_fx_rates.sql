create table public.fx_rates (
  base text not null,
  quote text not null,
  ts timestamptz not null,
  rate numeric(20,8) not null,
  primary key (base, quote, ts)
);

create index fx_rates_latest_idx on public.fx_rates (base, quote, ts desc);

comment on table public.fx_rates is '환율 시계열. (USD,KRW)는 워커가 30분마다 INSERT';
