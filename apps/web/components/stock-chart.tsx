"use client";

import { useEffect, useRef } from "react";
import {
  createChart,
  CandlestickSeries,
  LineSeries,
  type IChartApi,
  type ISeriesApi,
  type Time,
} from "lightweight-charts";

type Bar = {
  ts: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

type Props = {
  bars: Bar[];
  height?: number;
};

function calcMA(closes: number[], period: number): (number | undefined)[] {
  const out: (number | undefined)[] = [];
  let sum = 0;
  for (let i = 0; i < closes.length; i++) {
    sum += closes[i];
    if (i >= period) sum -= closes[i - period];
    if (i >= period - 1) out.push(sum / period);
    else out.push(undefined);
  }
  return out;
}

export function StockChart({ bars, height = 320 }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    if (bars.length === 0) return;

    const chart = createChart(containerRef.current, {
      height,
      layout: {
        background: { color: "transparent" },
        textColor: "#888",
      },
      grid: {
        vertLines: { color: "rgba(255,255,255,0.05)" },
        horzLines: { color: "rgba(255,255,255,0.05)" },
      },
      timeScale: { timeVisible: false },
    });
    chartRef.current = chart;

    const candleSeries: ISeriesApi<"Candlestick"> = chart.addSeries(CandlestickSeries, {
      upColor: "#26a69a",
      downColor: "#ef5350",
      borderVisible: false,
      wickUpColor: "#26a69a",
      wickDownColor: "#ef5350",
    });

    const candleData = bars.map((b) => ({
      time: (b.ts.split("T")[0]) as Time,
      open: b.open,
      high: b.high,
      low: b.low,
      close: b.close,
    }));
    candleSeries.setData(candleData);

    // MA20 + MA60
    const closes = bars.map((b) => b.close);
    const ma20 = calcMA(closes, 20);
    const ma60 = calcMA(closes, 60);

    const ma20Series = chart.addSeries(LineSeries, { color: "#f59e0b", lineWidth: 1 });
    ma20Series.setData(
      bars
        .map((b, i) => ({
          time: (b.ts.split("T")[0]) as Time,
          value: ma20[i],
        }))
        .filter((d): d is { time: Time; value: number } => d.value !== undefined)
    );

    const ma60Series = chart.addSeries(LineSeries, { color: "#a78bfa", lineWidth: 1 });
    ma60Series.setData(
      bars
        .map((b, i) => ({
          time: (b.ts.split("T")[0]) as Time,
          value: ma60[i],
        }))
        .filter((d): d is { time: Time; value: number } => d.value !== undefined)
    );

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
  }, [bars, height]);

  if (bars.length === 0) {
    return (
      <div className="text-sm text-muted-foreground py-8 text-center">
        차트 데이터 없음 (워커가 일봉 fetch 후 표시)
      </div>
    );
  }

  return (
    <div>
      <div ref={containerRef} className="w-full" style={{ height }} />
      <div className="text-xs text-muted-foreground mt-2 flex gap-3 justify-center">
        <span>
          <span className="inline-block w-3 h-1 align-middle mr-1" style={{ backgroundColor: "#f59e0b" }} />
          MA20
        </span>
        <span>
          <span className="inline-block w-3 h-1 align-middle mr-1" style={{ backgroundColor: "#a78bfa" }} />
          MA60
        </span>
      </div>
    </div>
  );
}
