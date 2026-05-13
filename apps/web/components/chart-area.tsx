"use client";

import { useEffect, useState } from "react";
import { StockChart, type IndicatorType } from "@/components/stock-chart";
import { ChartControls, type Interval } from "@/components/chart-controls";
import {
  DEFAULT_PALETTE_ID,
  loadPaletteId,
  savePaletteId,
  type PaletteId,
} from "@/lib/chart-palettes";

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
  initialBars: Bar[]; // 일봉 SSR 초기 fetch
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
  // SSR/hydration 호환을 위해 초기는 DEFAULT, mount 후 localStorage에서 읽음.
  // React 19 strict effect 규칙 우회 — localStorage sync는 정당한 사용처.
  const [paletteId, setPaletteId] = useState<PaletteId>(DEFAULT_PALETTE_ID);

  useEffect(() => {
    const stored = loadPaletteId();
    if (stored !== DEFAULT_PALETTE_ID) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setPaletteId(stored);
    }
  }, []);

  function handlePaletteChange(p: PaletteId) {
    setPaletteId(p);
    savePaletteId(p);
  }

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
        paletteId={paletteId}
        onPaletteChange={handlePaletteChange}
      />
      {loading ? (
        <div className="text-sm text-muted-foreground py-8 text-center">차트 로딩 중...</div>
      ) : (
        <StockChart bars={bars} indicator={indicator} paletteId={paletteId} />
      )}
    </div>
  );
}
