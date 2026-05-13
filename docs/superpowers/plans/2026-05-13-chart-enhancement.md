# Chart Enhancement — Plan #15

> Inline execution. 차트 시각화 강화.

**Goal:** lightweight-charts v5의 multi-pane 기능으로 차트를 보강 — (1) 거래량 바를 캔들 아래 sub-panel로, (2) RSI를 텍스트가 아닌 시각화 panel로 (70/30 기준선 포함), (3) 크로스헤어 위치의 OHLC + 거래량 + 지표값을 실시간으로 보여주는 floating tooltip.

**Architecture:** `chart.addPane()`으로 sub-pane 생성, `chart.addSeries(SeriesType, options, paneIndex)`로 series를 특정 pane에 부착. 거래량은 main pane(0)에 작게 또는 sub-pane(1)에 별도. RSI는 indicator===rsi 일 때 추가 pane(1)에 LineSeries + `createPriceLine` 으로 70/30 reference. Crosshair는 `subscribeCrosshairMove`로 hover 데이터를 받아 React state로 tooltip 갱신.

**Tech Stack:** lightweight-charts v5 API (HistogramSeries, addPane, paneSize, createPriceLine, subscribeCrosshairMove), 기존 `lib/chart-palettes.ts` 색 적용.

---

## Scope

In scope:
- 거래량 바: 항상 표시 (모든 indicator 모드에서). Main pane 아래에 작은 별도 pane (height ratio ~ 1/4)
- 거래량 색: 그날 종가가 전날 종가보다 높으면 `palette.up`, 낮으면 `palette.down`
- RSI indicator 선택 시: sub-pane에 RSI(14) LineSeries + 70 (red dashed) / 30 (green dashed) reference price lines + 50 (gray solid)
- Crosshair tooltip: chart 좌상단에 floating div, hover한 bar의 O/H/L/C + Volume + 활성 indicator값 표시
- 모든 색은 `chart-palettes.ts` 팔레트 사용 — Korean 팔레트면 거래량 빨간 봉/파란 봉
- Mobile-friendly: tooltip은 touch 가능

Out of scope:
- MACD, Stochastic, ATR — RSI/MA/BB로 충분
- Drawing tools (trendline, fib retracement)
- 종목 비교 (compare overlay)
- VWAP / Volume Profile
- Pre/post-market shading
- Custom indicator parameters (RSI 14 → 21 등)

---

## Tasks

### Task 1: lib/indicators.ts에 `priceChange()` helper

거래량 바 색 결정용. 이전 bar 대비 close 변화로 up/down 판정.

```ts
export function priceChange(bars: { close: number }[]): ("up" | "down" | "flat")[] {
  return bars.map((b, i) => {
    if (i === 0) return "flat";
    const prev = bars[i - 1].close;
    if (b.close > prev) return "up";
    if (b.close < prev) return "down";
    return "flat";
  });
}
```

### Task 2: StockChart에 거래량 + RSI panel + crosshair tooltip

`apps/web/components/stock-chart.tsx` 재작성:
- Main pane(0): 캔들 + MA/BB lines + 거래량 (작게 overlay) — 또는 sub-pane(1)에 분리
- 결정: 거래량은 sub-pane(1)에 분리 (overlay는 가독성 떨어짐)
- RSI: indicator === "rsi"일 때 pane(2)에 line + 70/50/30 reference lines
- subscribeCrosshairMove → React state → floating tooltip div

### Task 3: 기존 ChartLegend 제거 / 통합

`ChartLegend`는 RSI 텍스트 표시로만 쓰였음. RSI가 panel로 시각화되니까 legend 단순화 (MA/BB 색만 안내, RSI는 panel 자체로 충분).

### Task 4: 빌드 + lint + 시각 확인

### Task 5: README + 머지 + 배포
