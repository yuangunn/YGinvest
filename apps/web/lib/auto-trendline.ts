// 자동 추세선 계산.
// Pivot(swing) 점을 찾아 최근 2개 고점/저점을 직선으로 연결.
// 추세선은 마지막 봉까지 연장해 향후 지지/저항 가이드로 보이게 함.

export type TrendlineBar = {
  ts: string;
  open: number;
  high: number;
  low: number;
  close: number;
};

export type AutoTrendline = {
  side: "support" | "resistance";
  /** 시작 ts (정확히 pivot 봉 시점) */
  t1: string;
  p1: number;
  /** 끝 ts (마지막 봉까지 연장된 시점) */
  t2: string;
  p2: number;
};

export type AutoTrendlineSet = {
  support: AutoTrendline | null;
  resistance: AutoTrendline | null;
};

/**
 * 좌우 `window`개 봉보다 high가 가장 큰 봉 = pivot high.
 * 마찬가지로 low가 가장 작은 봉 = pivot low.
 * 마지막 `window`개 봉은 미확정(아직 우측 데이터 부족)이므로 pivot 후보에서 제외.
 */
function findPivots(
  bars: TrendlineBar[],
  window: number,
): { highs: number[]; lows: number[] } {
  const highs: number[] = [];
  const lows: number[] = [];
  for (let i = window; i < bars.length - window; i++) {
    let isHigh = true;
    let isLow = true;
    for (let j = i - window; j <= i + window; j++) {
      if (j === i) continue;
      if (bars[j].high >= bars[i].high) isHigh = false;
      if (bars[j].low <= bars[i].low) isLow = false;
      if (!isHigh && !isLow) break;
    }
    if (isHigh) highs.push(i);
    if (isLow) lows.push(i);
  }
  return { highs, lows };
}

/**
 * 두 pivot 봉을 지나는 직선을 마지막 봉까지 연장.
 * pivot1, pivot2는 봉 인덱스. priceFn(i)는 해당 봉의 가격(고가 또는 저가).
 */
function extendLine(
  bars: TrendlineBar[],
  p1Idx: number,
  p2Idx: number,
  priceFn: (i: number) => number,
): { t1: string; p1: number; t2: string; p2: number } {
  const p1 = priceFn(p1Idx);
  const p2 = priceFn(p2Idx);
  const lastIdx = bars.length - 1;
  // 직선 y = a + b*x, 여기서 x = bar index, y = price
  const slope = (p2 - p1) / Math.max(1, p2Idx - p1Idx);
  // 연장된 끝점 = 마지막 봉 시점
  const extendedP = p2 + slope * (lastIdx - p2Idx);
  return {
    t1: bars[p1Idx].ts,
    p1,
    t2: bars[lastIdx].ts,
    p2: extendedP,
  };
}

/**
 * 최근 swing high 2개로 저항선, swing low 2개로 지지선.
 *
 * @param bars 시간순 정렬된 일봉 (또는 분봉) 배열
 * @param window pivot 좌/우 비교 윈도우 (기본 5)
 */
export function computeAutoTrendlines(
  bars: TrendlineBar[],
  window: number = 5,
): AutoTrendlineSet {
  if (bars.length < window * 2 + 4) {
    return { support: null, resistance: null };
  }

  const { highs, lows } = findPivots(bars, window);

  let resistance: AutoTrendline | null = null;
  let support: AutoTrendline | null = null;

  if (highs.length >= 2) {
    const last2 = highs.slice(-2);
    const seg = extendLine(bars, last2[0], last2[1], (i) => bars[i].high);
    resistance = { side: "resistance", ...seg };
  }
  if (lows.length >= 2) {
    const last2 = lows.slice(-2);
    const seg = extendLine(bars, last2[0], last2[1], (i) => bars[i].low);
    support = { side: "support", ...seg };
  }

  return { support, resistance };
}
