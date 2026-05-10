"use client";

import { useEffect, useState } from "react";
import { StockChart, type IndicatorType } from "@/components/stock-chart";
import { ChartControls, type Interval } from "@/components/chart-controls";

type Bar = {
  ts: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

type Props = {
  symbol: string;
  initialBars: Bar[];  // 일봉 SSR 초기 fetch
};

type LoadedState = {
  symbol: string;
  interval: Interval;
  bars: Bar[];
};

export function ChartArea({ symbol, initialBars }: Props) {
  const [chartInterval, setChartInterval] = useState<Interval>("1d");
  const [indicator, setIndicator] = useState<IndicatorType>("ma");
  const [loaded, setLoaded] = useState<LoadedState | null>(null);

  useEffect(() => {
    if (chartInterval === "1d") {
      // SSR-provided initialBars is the source of truth for daily.
      return;
    }
    let cancelled = false;
    fetch(`/api/stocks/${encodeURIComponent(symbol)}/bars?interval=${chartInterval}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(r.statusText)))
      .then((data) => {
        if (!cancelled) {
          setLoaded({ symbol, interval: chartInterval, bars: data.bars ?? [] });
        }
      })
      .catch(() => {
        if (!cancelled) {
          setLoaded({ symbol, interval: chartInterval, bars: [] });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [symbol, chartInterval]);

  const isFetchedForCurrent =
    loaded !== null && loaded.symbol === symbol && loaded.interval === chartInterval;
  const loading = chartInterval !== "1d" && !isFetchedForCurrent;
  const bars =
    chartInterval === "1d"
      ? initialBars
      : isFetchedForCurrent
      ? loaded.bars
      : [];

  return (
    <div>
      <ChartControls
        interval={chartInterval}
        onIntervalChange={setChartInterval}
        indicator={indicator}
        onIndicatorChange={setIndicator}
      />
      {loading ? (
        <div className="text-sm text-muted-foreground py-8 text-center">차트 로딩 중...</div>
      ) : (
        <StockChart bars={bars} indicator={indicator} />
      )}
    </div>
  );
}
