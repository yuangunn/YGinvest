// Plan #45: YG ChartCard — handoff trade-detail.jsx ChartCard 패턴.
//
// 깔끔한 AreaChart + range tabs (1일~5년) + "상세 ›" 링크 (자동 추세선 풀 차트로).
// margin: '12px 20px 0' 으로 다른 카드와 폭 일관성.

import Link from "next/link";
import { YGRangeChart } from "./yg-range-chart";

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
  currency?: "KRW" | "USD";
};

export function YGChartCard({ symbol, initialBars, currency }: Props) {
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
        <Link
          href={`/app/trade/${encodeURIComponent(symbol)}/chart`}
          style={{
            fontSize: 13,
            fontWeight: 700,
            color: "var(--yg-fg-tertiary)",
            textDecoration: "none",
          }}
        >
          상세 ›
        </Link>
      </div>
      <YGRangeChart
        symbol={symbol}
        initialBars={initialBars}
        currency={currency}
      />
    </div>
  );
}
