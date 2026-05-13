"use client";

import { useEffect, useRef, useState } from "react";
import {
  createChart,
  CandlestickSeries,
  HistogramSeries,
  LineSeries,
  LineStyle,
  type IChartApi,
  type ISeriesApi,
  type MouseEventParams,
  type SeriesType,
  type Time,
} from "lightweight-charts";
import { ma, rsi, bollinger, macd, stochastic } from "@/lib/indicators";
import { PALETTES, type PaletteId } from "@/lib/chart-palettes";

type Bar = {
  ts: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

export type IndicatorType = "none" | "ma" | "rsi" | "bollinger" | "macd" | "stoch";

type Props = {
  bars: Bar[];
  height?: number;
  indicator?: IndicatorType;
  paletteId?: PaletteId;
};

type HoverData = {
  index: number;
  bar: Bar;
  ma20?: number;
  ma60?: number;
  rsi?: number;
  bbUpper?: number;
  bbLower?: number;
  macd?: number;
  macdSignal?: number;
  macdHist?: number;
  stochK?: number;
  stochD?: number;
};

function tsToTime(ts: string): Time {
  if (ts.includes("T") && ts.length > 10) {
    const epoch = Math.floor(new Date(ts).getTime() / 1000);
    return epoch as Time;
  }
  return ts.split("T")[0] as Time;
}

function formatVolume(v: number): string {
  if (v >= 1_000_000_000) return `${(v / 1_000_000_000).toFixed(1)}B`;
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(1)}K`;
  return String(v);
}

export function StockChart({
  bars,
  height = 320,
  indicator = "ma",
  paletteId = "classic",
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const [hover, setHover] = useState<HoverData | null>(null);

  // total chart height — price + volume (+ indicator sub-panel if active)
  const hasIndicatorPane =
    indicator === "rsi" || indicator === "macd" || indicator === "stoch";
  const totalHeight = hasIndicatorPane ? height + 80 + 110 : height + 80;

  useEffect(() => {
    if (!containerRef.current) return;
    if (bars.length === 0) return;

    const palette = PALETTES[paletteId];

    const chart = createChart(containerRef.current, {
      height: totalHeight,
      layout: { background: { color: "transparent" }, textColor: "#888" },
      grid: {
        vertLines: { color: "rgba(255,255,255,0.05)" },
        horzLines: { color: "rgba(255,255,255,0.05)" },
      },
      timeScale: { timeVisible: true, secondsVisible: false },
      crosshair: { mode: 1 }, // magnet
    });
    chartRef.current = chart;

    // ─── Pane 0: Candlestick (price) ──────────────────────────────────────
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
    let ma20Series: ISeriesApi<SeriesType> | null = null;
    let ma60Series: ISeriesApi<SeriesType> | null = null;
    let bbUpperSeries: ISeriesApi<SeriesType> | null = null;
    let bbLowerSeries: ISeriesApi<SeriesType> | null = null;
    let rsiSeries: ISeriesApi<SeriesType> | null = null;

    if (indicator === "ma") {
      const ma20 = ma(closes, 20);
      const ma60 = ma(closes, 60);
      ma20Series = chart.addSeries(LineSeries, {
        color: palette.ma20,
        lineWidth: 1,
      });
      ma20Series.setData(
        bars
          .map((b, i) => ({ time: tsToTime(b.ts), value: ma20[i] }))
          .filter((d): d is { time: Time; value: number } => d.value !== undefined),
      );
      ma60Series = chart.addSeries(LineSeries, {
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
      bbUpperSeries = chart.addSeries(LineSeries, {
        color: palette.bbBand,
        lineWidth: 1,
      });
      bbUpperSeries.setData(
        bars
          .map((b, i) => ({ time: tsToTime(b.ts), value: upper[i] }))
          .filter((d): d is { time: Time; value: number } => d.value !== undefined),
      );
      bbLowerSeries = chart.addSeries(LineSeries, {
        color: palette.bbBand,
        lineWidth: 1,
      });
      bbLowerSeries.setData(
        bars
          .map((b, i) => ({ time: tsToTime(b.ts), value: lower[i] }))
          .filter((d): d is { time: Time; value: number } => d.value !== undefined),
      );
    }

    // ─── Pane 1: Volume bars ─────────────────────────────────────────────
    const volumeSeries = chart.addSeries(
      HistogramSeries,
      {
        priceFormat: { type: "volume" },
        priceScaleId: "",
      },
      1, // pane index — auto-creates pane 1
    );
    volumeSeries.setData(
      bars.map((b, i) => {
        const prevClose = i > 0 ? bars[i - 1].close : b.close;
        const isUp = b.close >= prevClose;
        return {
          time: tsToTime(b.ts),
          value: b.volume,
          color: isUp ? palette.up : palette.down,
        };
      }),
    );

    // ─── Pane 2: Indicator sub-panel (RSI / MACD / Stochastic) ───────────
    if (indicator === "rsi") {
      const rsiValues = rsi(closes, 14);
      rsiSeries = chart.addSeries(
        LineSeries,
        { color: palette.ma60, lineWidth: 1 },
        2,
      );
      rsiSeries.setData(
        bars
          .map((b, i) => ({ time: tsToTime(b.ts), value: rsiValues[i] }))
          .filter((d): d is { time: Time; value: number } => d.value !== undefined),
      );
      rsiSeries.createPriceLine({
        price: 70,
        color: palette.down,
        lineStyle: LineStyle.Dashed,
        lineWidth: 1,
        axisLabelVisible: true,
        title: "70",
      });
      rsiSeries.createPriceLine({
        price: 50,
        color: "#666",
        lineStyle: LineStyle.Solid,
        lineWidth: 1,
        axisLabelVisible: false,
        title: "",
      });
      rsiSeries.createPriceLine({
        price: 30,
        color: palette.up,
        lineStyle: LineStyle.Dashed,
        lineWidth: 1,
        axisLabelVisible: true,
        title: "30",
      });
    } else if (indicator === "macd") {
      const SLOW = 26;
      const macdData = macd(closes, 12, SLOW, 9);
      // macdData arrays start from bars[SLOW-1] (length closes.length-SLOW+1)
      const macdLine = chart.addSeries(
        LineSeries,
        { color: palette.ma60, lineWidth: 1 },
        2,
      );
      macdLine.setData(
        macdData.macd.map((v, i) => ({
          time: tsToTime(bars[i + SLOW - 1].ts),
          value: v,
        })),
      );
      const signalLine = chart.addSeries(
        LineSeries,
        { color: palette.ma20, lineWidth: 1 },
        2,
      );
      signalLine.setData(
        macdData.signal.map((v, i) => ({
          time: tsToTime(bars[i + SLOW - 1].ts),
          value: v,
        })),
      );
      const histSeries = chart.addSeries(
        HistogramSeries,
        { priceFormat: { type: "price", precision: 2, minMove: 0.01 } },
        2,
      );
      histSeries.setData(
        macdData.histogram.map((v, i) => ({
          time: tsToTime(bars[i + SLOW - 1].ts),
          value: v,
          color: v >= 0 ? palette.up : palette.down,
        })),
      );
      // zero line
      macdLine.createPriceLine({
        price: 0,
        color: "#666",
        lineStyle: LineStyle.Solid,
        lineWidth: 1,
        axisLabelVisible: false,
        title: "",
      });
    } else if (indicator === "stoch") {
      const highs = bars.map((b) => b.high);
      const lows = bars.map((b) => b.low);
      const { k, d } = stochastic(highs, lows, closes, 14, 3);
      const kSeries = chart.addSeries(
        LineSeries,
        { color: palette.ma60, lineWidth: 1 },
        2,
      );
      kSeries.setData(
        bars
          .map((b, i) => ({ time: tsToTime(b.ts), value: k[i] }))
          .filter((d): d is { time: Time; value: number } => d.value !== undefined),
      );
      const dSeries = chart.addSeries(
        LineSeries,
        { color: palette.ma20, lineWidth: 1 },
        2,
      );
      dSeries.setData(
        bars
          .map((b, i) => ({ time: tsToTime(b.ts), value: d[i] }))
          .filter((d): d is { time: Time; value: number } => d.value !== undefined),
      );
      kSeries.createPriceLine({
        price: 80,
        color: palette.down,
        lineStyle: LineStyle.Dashed,
        lineWidth: 1,
        axisLabelVisible: true,
        title: "80",
      });
      kSeries.createPriceLine({
        price: 20,
        color: palette.up,
        lineStyle: LineStyle.Dashed,
        lineWidth: 1,
        axisLabelVisible: true,
        title: "20",
      });
    }

    // ─── Resize pane heights ──────────────────────────────────────────────
    // Set pane heights via panes() API. Volume should be ~1/4 height; RSI ~1/3.
    try {
      const panes = chart.panes();
      if (panes.length >= 2) {
        panes[0].setHeight(height);
        panes[1].setHeight(80);
        if (hasIndicatorPane && panes.length >= 3) {
          panes[2].setHeight(110);
        }
      }
    } catch {
      // pane API 변경 시 graceful — 기본 height ratio 사용
    }

    chart.timeScale().fitContent();

    // ─── Crosshair tooltip ───────────────────────────────────────────────
    const ma20Vals = indicator === "ma" ? ma(closes, 20) : [];
    const ma60Vals = indicator === "ma" ? ma(closes, 60) : [];
    const rsiVals = indicator === "rsi" ? rsi(closes, 14) : [];
    const bbBands = indicator === "bollinger" ? bollinger(closes, 20, 2) : null;
    const macdData =
      indicator === "macd" ? macd(closes, 12, 26, 9) : null;
    const stochData =
      indicator === "stoch"
        ? stochastic(bars.map((b) => b.high), bars.map((b) => b.low), closes, 14, 3)
        : null;
    const MACD_SLOW = 26;

    const timeToIndex = new Map<string, number>();
    bars.forEach((b, i) => {
      const t = tsToTime(b.ts);
      timeToIndex.set(String(t), i);
    });

    chart.subscribeCrosshairMove((param: MouseEventParams) => {
      if (!param.time || !param.point) {
        setHover(null);
        return;
      }
      const idx = timeToIndex.get(String(param.time));
      if (idx === undefined) {
        setHover(null);
        return;
      }
      const bar = bars[idx];
      const macdIdx = idx - (MACD_SLOW - 1);
      setHover({
        index: idx,
        bar,
        ma20: ma20Vals[idx],
        ma60: ma60Vals[idx],
        rsi: rsiVals[idx],
        bbUpper: bbBands?.upper[idx],
        bbLower: bbBands?.lower[idx],
        macd:
          macdData && macdIdx >= 0 && macdIdx < macdData.macd.length
            ? macdData.macd[macdIdx]
            : undefined,
        macdSignal:
          macdData && macdIdx >= 0 && macdIdx < macdData.signal.length
            ? macdData.signal[macdIdx]
            : undefined,
        macdHist:
          macdData && macdIdx >= 0 && macdIdx < macdData.histogram.length
            ? macdData.histogram[macdIdx]
            : undefined,
        stochK: stochData?.k[idx],
        stochD: stochData?.d[idx],
      });
    });

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
  }, [bars, height, totalHeight, hasIndicatorPane, indicator, paletteId]);

  if (bars.length === 0) {
    return (
      <div className="text-sm text-muted-foreground py-8 text-center">
        차트 데이터 없음
      </div>
    );
  }

  // 마지막 봉을 default로 (hover 없을 때)
  const displayBar: HoverData = hover ?? {
    index: bars.length - 1,
    bar: bars[bars.length - 1],
  };

  return (
    <div className="relative">
      {/* Floating tooltip — chart 좌상단 */}
      <ChartTooltip
        data={displayBar}
        indicator={indicator}
        isHover={hover !== null}
      />
      <div ref={containerRef} className="w-full" style={{ height: totalHeight }} />
      <ChartLegend indicator={indicator} paletteId={paletteId} />
    </div>
  );
}

function ChartTooltip({
  data,
  indicator,
  isHover,
}: {
  data: HoverData;
  indicator: IndicatorType;
  isHover: boolean;
}) {
  const b = data.bar;
  const dateLabel = new Date(b.ts).toLocaleDateString("ko-KR", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  return (
    <div className="absolute top-2 left-2 z-10 rounded-md bg-background/85 backdrop-blur border border-border px-2 py-1.5 text-[10px] font-mono pointer-events-none">
      <div className="text-muted-foreground">
        {dateLabel}
        {!isHover && <span className="ml-1 text-[9px] opacity-60">(최근)</span>}
      </div>
      <div className="flex gap-2 mt-0.5">
        <span>
          O <span className="font-semibold">{b.open.toFixed(2)}</span>
        </span>
        <span>
          H <span className="font-semibold">{b.high.toFixed(2)}</span>
        </span>
      </div>
      <div className="flex gap-2">
        <span>
          L <span className="font-semibold">{b.low.toFixed(2)}</span>
        </span>
        <span>
          C <span className="font-semibold">{b.close.toFixed(2)}</span>
        </span>
      </div>
      <div className="text-muted-foreground mt-0.5">
        Vol <span className="font-semibold">{formatVolume(b.volume)}</span>
      </div>
      {indicator === "ma" && (data.ma20 !== undefined || data.ma60 !== undefined) && (
        <div className="text-muted-foreground mt-0.5">
          {data.ma20 !== undefined && (
            <span>
              MA20 <span className="font-semibold">{data.ma20.toFixed(2)}</span>
            </span>
          )}
          {data.ma20 !== undefined && data.ma60 !== undefined && " · "}
          {data.ma60 !== undefined && (
            <span>
              MA60 <span className="font-semibold">{data.ma60.toFixed(2)}</span>
            </span>
          )}
        </div>
      )}
      {indicator === "rsi" && data.rsi !== undefined && (
        <div className="text-muted-foreground mt-0.5">
          RSI <span className="font-semibold">{data.rsi.toFixed(1)}</span>
          {data.rsi >= 70 && <span className="ml-1 text-red-500">과매수</span>}
          {data.rsi <= 30 && <span className="ml-1 text-green-500">과매도</span>}
        </div>
      )}
      {indicator === "bollinger" &&
        (data.bbUpper !== undefined || data.bbLower !== undefined) && (
          <div className="text-muted-foreground mt-0.5">
            {data.bbUpper !== undefined && (
              <span>
                U <span className="font-semibold">{data.bbUpper.toFixed(2)}</span>
              </span>
            )}
            {data.bbUpper !== undefined && data.bbLower !== undefined && " · "}
            {data.bbLower !== undefined && (
              <span>
                L <span className="font-semibold">{data.bbLower.toFixed(2)}</span>
              </span>
            )}
          </div>
        )}
      {indicator === "macd" && data.macd !== undefined && (
        <div className="text-muted-foreground mt-0.5">
          MACD <span className="font-semibold">{data.macd.toFixed(2)}</span>
          {data.macdSignal !== undefined && (
            <>
              {" · Sig "}
              <span className="font-semibold">{data.macdSignal.toFixed(2)}</span>
            </>
          )}
          {data.macdHist !== undefined && (
            <>
              {" · Hist "}
              <span
                className={
                  data.macdHist >= 0 ? "text-green-500" : "text-red-500"
                }
              >
                {data.macdHist.toFixed(2)}
              </span>
            </>
          )}
        </div>
      )}
      {indicator === "stoch" &&
        (data.stochK !== undefined || data.stochD !== undefined) && (
          <div className="text-muted-foreground mt-0.5">
            {data.stochK !== undefined && (
              <span>
                %K <span className="font-semibold">{data.stochK.toFixed(1)}</span>
              </span>
            )}
            {data.stochK !== undefined && data.stochD !== undefined && " · "}
            {data.stochD !== undefined && (
              <span>
                %D <span className="font-semibold">{data.stochD.toFixed(1)}</span>
              </span>
            )}
            {data.stochK !== undefined && data.stochK >= 80 && (
              <span className="ml-1 text-red-500">과매수</span>
            )}
            {data.stochK !== undefined && data.stochK <= 20 && (
              <span className="ml-1 text-green-500">과매도</span>
            )}
          </div>
        )}
    </div>
  );
}

function ChartLegend({
  indicator,
  paletteId,
}: {
  indicator: IndicatorType;
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
  // RSI panel 자체가 시각화이므로 별도 legend 불필요
  return null;
}
