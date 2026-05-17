"use client";

// Plan #45: YG ChartCard — handoff trade-detail.jsx ChartCard 패턴.
//
// 카드 wrapping + section-head + ChartArea + range tabs.
// margin: '12px 20px 0' 으로 다른 카드와 폭 일관성 보장.

import { ChartArea } from "@/components/chart-area";

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
  initialBars: Bar[];
};

export function YGChartCard({ symbol, initialBars }: Props) {
  return (
    <div
      className="yg-card"
      style={{ padding: 18, margin: "12px 20px 0" }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 12,
        }}
      >
        <h3
          style={{
            margin: 0,
            fontSize: 18,
            fontWeight: 700,
            letterSpacing: "-0.015em",
            color: "var(--yg-fg-primary)",
          }}
        >
          차트
        </h3>
        <span
          style={{
            fontSize: 11,
            fontWeight: 700,
            color: "var(--yg-fg-tertiary)",
            padding: "4px 8px",
            background: "var(--yg-bg-tint-ink)",
            borderRadius: 99,
          }}
        >
          일봉
        </span>
      </div>
      <ChartArea symbol={symbol} initialBars={initialBars} />
    </div>
  );
}
