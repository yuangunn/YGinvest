"use client";

import { useEffect, useState } from "react";
import { Pencil, Spline, Trash2 } from "lucide-react";
import {
  StockChart,
  type DrawingMode,
  type IndicatorType,
  type TrendlinePoints,
} from "@/components/stock-chart";
import { ChartControls, type Interval } from "@/components/chart-controls";
import { Button } from "@/components/ui/button";
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
  const [paletteId, setPaletteId] = useState<PaletteId>(DEFAULT_PALETTE_ID);
  const [drawingMode, setDrawingMode] = useState<DrawingMode>("none");
  const [trendlines, setTrendlines] = useState<TrendlinePoints[]>([]);
  const [fibLines, setFibLines] = useState<TrendlinePoints[]>([]);

  useEffect(() => {
    const stored = loadPaletteId();
    if (stored !== DEFAULT_PALETTE_ID) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setPaletteId(stored);
    }
  }, []);

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    setTrendlines([]);
    setFibLines([]);
    setDrawingMode("none");
  }, [symbol, chartInterval]);
  /* eslint-enable react-hooks/set-state-in-effect */

  function handlePaletteChange(p: PaletteId) {
    setPaletteId(p);
    savePaletteId(p);
  }

  function handleTrendlineComplete(line: TrendlinePoints) {
    setTrendlines((prev) => [...prev, line]);
    setDrawingMode("none");
  }

  function handleFibComplete(line: TrendlinePoints) {
    setFibLines((prev) => [...prev, line]);
    setDrawingMode("none");
  }

  function clearAllDrawings() {
    setTrendlines([]);
    setFibLines([]);
  }

  useEffect(() => {
    if (chartInterval === "1d") return;
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

  const totalDrawings = trendlines.length + fibLines.length;

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
      <div className="flex flex-wrap gap-2 items-center mb-2">
        <Button
          type="button"
          size="sm"
          variant={drawingMode === "trendline" ? "default" : "outline"}
          onClick={() =>
            setDrawingMode((v) => (v === "trendline" ? "none" : "trendline"))
          }
          title="추세선 — 차트에 두 점 클릭"
        >
          <Pencil className="h-3 w-3 mr-1" />
          {drawingMode === "trendline" ? "추세선 그리는 중" : "추세선"}
        </Button>
        <Button
          type="button"
          size="sm"
          variant={drawingMode === "fib" ? "default" : "outline"}
          onClick={() =>
            setDrawingMode((v) => (v === "fib" ? "none" : "fib"))
          }
          title="피보나치 되돌림 — 차트에 고점/저점 두 점 클릭"
        >
          <Spline className="h-3 w-3 mr-1" />
          {drawingMode === "fib" ? "Fib 그리는 중" : "Fib"}
        </Button>
        {totalDrawings > 0 && (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={clearAllDrawings}
            title="모든 도형 삭제"
          >
            <Trash2 className="h-3 w-3 mr-1" />
            지우기 ({totalDrawings})
          </Button>
        )}
      </div>
      {loading ? (
        <div className="text-sm text-muted-foreground py-8 text-center">차트 로딩 중...</div>
      ) : (
        <StockChart
          bars={bars}
          indicator={indicator}
          paletteId={paletteId}
          drawingMode={drawingMode}
          trendlines={trendlines}
          fibLines={fibLines}
          onTrendlineComplete={handleTrendlineComplete}
          onFibComplete={handleFibComplete}
        />
      )}
    </div>
  );
}
