"use client";

import { useEffect, useRef } from "react";
import {
  createChart,
  CandlestickSeries,
  LineSeries,
  type IChartApi,
  type Time,
} from "lightweight-charts";
import { ma, rsi, bollinger } from "@/lib/indicators";
import { PALETTES, type PaletteId } from "@/lib/chart-palettes";

type Bar = {
  ts: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

export type IndicatorType = "none" | "ma" | "rsi" | "bollinger";

type Props = {
  bars: Bar[];
  height?: number;
  indicator?: IndicatorType;
  paletteId?: PaletteId;
};

function tsToTime(ts: string): Time {
  // 일봉이면 "YYYY-MM-DD", 인트라데이면 ISO datetime → seconds since epoch
  if (ts.includes("T") && ts.length > 10) {
    const epoch = Math.floor(new Date(ts).getTime() / 1000);
    return epoch as Time;
  }
  return ts.split("T")[0] as Time;
}

export function StockChart({
  bars,
  height = 320,
  indicator = "ma",
  paletteId = "classic",
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    if (bars.length === 0) return;

    const palette = PALETTES[paletteId];

    const chart = createChart(containerRef.current, {
      height,
      layout: { background: { color: "transparent" }, textColor: "#888" },
      grid: {
        vertLines: { color: "rgba(255,255,255,0.05)" },
        horzLines: { color: "rgba(255,255,255,0.05)" },
      },
      timeScale: { timeVisible: true, secondsVisible: false },
    });
    chartRef.current = chart;

    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: palette.up,
      downColor: palette.down,
      borderVisible: false,
      wickUpColor: palette.up,
      wickDownColor: palette.down,
    });

    const candleData = bars.map((b) => ({
      time: tsToTime(b.ts),
      open: b.open,
      high: b.high,
      low: b.low,
      close: b.close,
    }));
    candleSeries.setData(candleData);

    const closes = bars.map((b) => b.close);

    if (indicator === "ma") {
      const ma20 = ma(closes, 20);
      const ma60 = ma(closes, 60);
      const ma20Series = chart.addSeries(LineSeries, {
        color: palette.ma20,
        lineWidth: 1,
      });
      ma20Series.setData(
        bars
          .map((b, i) => ({ time: tsToTime(b.ts), value: ma20[i] }))
          .filter((d): d is { time: Time; value: number } => d.value !== undefined),
      );
      const ma60Series = chart.addSeries(LineSeries, {
        color: palette.ma60,
        lineWidth: 1,
      });
      ma60Series.setData(
        bars
          .map((b, i) => ({ time: tsToTime(b.ts), value: ma60[i] }))
          .filter((d): d is { time: Time; value: number } => d.value !== undefined),
      );
    } else if (indicator === "bollinger") {
      const { upper, middle, lower } = bollinger(closes, 20, 2);
      const middleSeries = chart.addSeries(LineSeries, {
        color: palette.bbMid,
        lineWidth: 1,
      });
      middleSeries.setData(
        bars
          .map((b, i) => ({ time: tsToTime(b.ts), value: middle[i] }))
          .filter((d): d is { time: Time; value: number } => d.value !== undefined),
      );
      const upperSeries = chart.addSeries(LineSeries, {
        color: palette.bbBand,
        lineWidth: 1,
      });
      upperSeries.setData(
        bars
          .map((b, i) => ({ time: tsToTime(b.ts), value: upper[i] }))
          .filter((d): d is { time: Time; value: number } => d.value !== undefined),
      );
      const lowerSeries = chart.addSeries(LineSeries, {
        color: palette.bbBand,
        lineWidth: 1,
      });
      lowerSeries.setData(
        bars
          .map((b, i) => ({ time: tsToTime(b.ts), value: lower[i] }))
          .filter((d): d is { time: Time; value: number } => d.value !== undefined),
      );
    }
    // RSI는 별도 패널 필요해서 v1.5에선 텍스트로만 (legend에서 표시)

    chart.timeScale().fitContent();

    const onResize = () => {
      if (containerRef.current) {
        chart.applyOptions({ width: containerRef.current.clientWidth });
      }
    };
    onResize();
    window.addEventListener("resize", onResize);

    return () => {
      window.removeEventListener("resize", onResize);
      chart.remove();
      chartRef.current = null;
    };
  }, [bars, height, indicator, paletteId]);

  if (bars.length === 0) {
    return (
      <div className="text-sm text-muted-foreground py-8 text-center">
        차트 데이터 없음
      </div>
    );
  }

  return (
    <div>
      <div ref={containerRef} className="w-full" style={{ height }} />
      <ChartLegend indicator={indicator} bars={bars} paletteId={paletteId} />
    </div>
  );
}

function ChartLegend({
  indicator,
  bars,
  paletteId,
}: {
  indicator: IndicatorType;
  bars: Bar[];
  paletteId: PaletteId;
}) {
  const palette = PALETTES[paletteId];
  if (indicator === "none") return null;
  if (indicator === "ma") {
    return (
      <div className="text-xs text-muted-foreground mt-2 flex gap-3 justify-center">
        <span>
          <span
            className="inline-block w-3 h-1 align-middle mr-1"
            style={{ backgroundColor: palette.ma20 }}
          />
          MA20
        </span>
        <span>
          <span
            className="inline-block w-3 h-1 align-middle mr-1"
            style={{ backgroundColor: palette.ma60 }}
          />
          MA60
        </span>
      </div>
    );
  }
  if (indicator === "bollinger") {
    return (
      <div className="text-xs text-muted-foreground mt-2 flex gap-3 justify-center">
        <span>
          <span
            className="inline-block w-3 h-1 align-middle mr-1"
            style={{ backgroundColor: palette.bbBand }}
          />
          Upper/Lower (2σ)
        </span>
        <span>
          <span
            className="inline-block w-3 h-1 align-middle mr-1"
            style={{ backgroundColor: palette.bbMid }}
          />
          MA20
        </span>
      </div>
    );
  }
  if (indicator === "rsi") {
    const closes = bars.map((b) => b.close);
    const rsiValues = rsi(closes, 14);
    const last = rsiValues[rsiValues.length - 1];
    return (
      <div className="text-xs text-muted-foreground mt-2 text-center">
        RSI(14): {last !== undefined ? last.toFixed(1) : "—"}
        {last !== undefined && last >= 70 && (
          <span className="ml-2 text-red-500">과매수</span>
        )}
        {last !== undefined && last <= 30 && (
          <span className="ml-2 text-green-500">과매도</span>
        )}
      </div>
    );
  }
  return null;
}
