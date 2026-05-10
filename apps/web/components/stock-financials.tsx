"use client";

import { useEffect, useState } from "react";

type Metrics = {
  trailing_eps: number | null;
  forward_pe: number | null;
  dividend_yield: number | null;
  beta: number | null;
  profit_margin: number | null;
  roe: number | null;
  debt_to_equity: number | null;
};

function fmtPct(v: number | null) {
  return v === null ? "—" : `${(v * 100).toFixed(2)}%`;
}
function fmtNum(v: number | null, digits = 2) {
  return v === null ? "—" : v.toFixed(digits);
}

export function StockFinancials({ symbol }: { symbol: string }) {
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/stocks/${encodeURIComponent(symbol)}/financials`)
      .then((r) => (r.ok ? r.json() : Promise.reject(r.statusText)))
      .then((data) => {
        if (!cancelled) setMetrics(data);
      })
      .catch((e) => {
        if (!cancelled) setError(String(e));
      });
    return () => {
      cancelled = true;
    };
  }, [symbol]);

  if (error) return <div className="text-sm text-muted-foreground">재무 지표 불러오기 실패</div>;
  if (!metrics) return <div className="text-sm text-muted-foreground">로딩 중...</div>;

  return (
    <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
      <dt className="text-muted-foreground">EPS (12M)</dt>
      <dd className="font-mono">{fmtNum(metrics.trailing_eps)}</dd>
      <dt className="text-muted-foreground">Forward P/E</dt>
      <dd className="font-mono">{fmtNum(metrics.forward_pe)}</dd>
      <dt className="text-muted-foreground">배당 수익률</dt>
      <dd className="font-mono">{fmtPct(metrics.dividend_yield)}</dd>
      <dt className="text-muted-foreground">베타</dt>
      <dd className="font-mono">{fmtNum(metrics.beta)}</dd>
      <dt className="text-muted-foreground">순이익률</dt>
      <dd className="font-mono">{fmtPct(metrics.profit_margin)}</dd>
      <dt className="text-muted-foreground">ROE</dt>
      <dd className="font-mono">{fmtPct(metrics.roe)}</dd>
      <dt className="text-muted-foreground">부채비율</dt>
      <dd className="font-mono">{fmtNum(metrics.debt_to_equity, 1)}</dd>
    </dl>
  );
}
