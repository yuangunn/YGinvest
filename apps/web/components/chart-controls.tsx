"use client";

import { Palette } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { IndicatorType } from "@/components/stock-chart";
import { PALETTES, type PaletteId } from "@/lib/chart-palettes";

export type Interval = "1mo" | "1wk" | "1d" | "1h" | "15m";

const INTERVAL_LABEL: Record<Interval, string> = {
  "1mo": "월봉",
  "1wk": "주봉",
  "1d": "일봉",
  "1h": "1시간",
  "15m": "15분",
};

const INTERVALS: Interval[] = ["1mo", "1wk", "1d", "1h", "15m"];

type Props = {
  interval: Interval;
  onIntervalChange: (i: Interval) => void;
  indicator: IndicatorType;
  onIndicatorChange: (i: IndicatorType) => void;
  paletteId: PaletteId;
  onPaletteChange: (p: PaletteId) => void;
};

export function ChartControls({
  interval,
  onIntervalChange,
  indicator,
  onIndicatorChange,
  paletteId,
  onPaletteChange,
}: Props) {
  return (
    <div className="space-y-2 mb-3">
      <div className="flex flex-wrap gap-2 items-center justify-between">
        <div className="flex gap-1 flex-wrap">
          {INTERVALS.map((i) => (
            <Button
              key={i}
              type="button"
              size="sm"
              variant={interval === i ? "default" : "outline"}
              onClick={() => onIntervalChange(i)}
            >
              {INTERVAL_LABEL[i]}
            </Button>
          ))}
        </div>
        <div className="flex gap-1 flex-wrap">
          {(
            [
              "none",
              "ma",
              "vwap",
              "bollinger",
              "rsi",
              "macd",
              "stoch",
            ] as IndicatorType[]
          ).map((ind) => (
            <Button
              key={ind}
              type="button"
              size="sm"
              variant={indicator === ind ? "default" : "outline"}
              onClick={() => onIndicatorChange(ind)}
            >
              {ind === "none"
                ? "지표 없음"
                : ind === "ma"
                  ? "MA"
                  : ind === "vwap"
                    ? "VWAP"
                    : ind === "rsi"
                      ? "RSI"
                      : ind === "bollinger"
                        ? "BB"
                        : ind === "macd"
                          ? "MACD"
                          : "Stoch"}
            </Button>
          ))}
        </div>
      </div>
      <div className="flex gap-1 items-center">
        <Palette className="h-3.5 w-3.5 text-muted-foreground" />
        <select
          value={paletteId}
          onChange={(e) => onPaletteChange(e.target.value as PaletteId)}
          className="h-8 text-xs border rounded-md bg-background px-2"
          aria-label="차트 색 팔레트"
        >
          {Object.values(PALETTES).map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        <span
          className="ml-1 inline-flex items-center gap-0.5 text-[10px]"
          aria-hidden
        >
          <span
            className="inline-block w-2 h-2 rounded-sm"
            style={{ backgroundColor: PALETTES[paletteId].up }}
          />
          <span
            className="inline-block w-2 h-2 rounded-sm"
            style={{ backgroundColor: PALETTES[paletteId].down }}
          />
        </span>
      </div>
    </div>
  );
}
