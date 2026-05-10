"use client";

import { Button } from "@/components/ui/button";
import type { IndicatorType } from "@/components/stock-chart";

export type Interval = "1d" | "1h" | "15m";

type Props = {
  interval: Interval;
  onIntervalChange: (i: Interval) => void;
  indicator: IndicatorType;
  onIndicatorChange: (i: IndicatorType) => void;
};

export function ChartControls({ interval, onIntervalChange, indicator, onIndicatorChange }: Props) {
  return (
    <div className="flex flex-wrap gap-2 items-center justify-between mb-3">
      <div className="flex gap-1">
        {(["1d", "1h", "15m"] as Interval[]).map((i) => (
          <Button
            key={i}
            type="button"
            size="sm"
            variant={interval === i ? "default" : "outline"}
            onClick={() => onIntervalChange(i)}
          >
            {i === "1d" ? "일봉" : i === "1h" ? "1시간" : "15분"}
          </Button>
        ))}
      </div>
      <div className="flex gap-1">
        {(["none", "ma", "rsi", "bollinger"] as IndicatorType[]).map((ind) => (
          <Button
            key={ind}
            type="button"
            size="sm"
            variant={indicator === ind ? "default" : "outline"}
            onClick={() => onIndicatorChange(ind)}
          >
            {ind === "none" ? "지표 없음" : ind === "ma" ? "MA" : ind === "rsi" ? "RSI" : "BB"}
          </Button>
        ))}
      </div>
    </div>
  );
}
