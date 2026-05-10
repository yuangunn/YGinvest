// 클라이언트 사이드 지표 계산. 모두 closes: number[] 입력 → 결과 배열 출력.
// undefined는 데이터 부족 (워밍업 구간).

export function ma(closes: number[], period: number): (number | undefined)[] {
  const out: (number | undefined)[] = [];
  let sum = 0;
  for (let i = 0; i < closes.length; i++) {
    sum += closes[i];
    if (i >= period) sum -= closes[i - period];
    out.push(i >= period - 1 ? sum / period : undefined);
  }
  return out;
}

// EMA (지수이동평균) — MACD 계산용
function ema(values: number[], period: number): number[] {
  const k = 2 / (period + 1);
  const out: number[] = [];
  let prev = values[0];
  out.push(prev);
  for (let i = 1; i < values.length; i++) {
    prev = values[i] * k + prev * (1 - k);
    out.push(prev);
  }
  return out;
}

// RSI (Relative Strength Index) — Wilder smoothing
export function rsi(closes: number[], period: number = 14): (number | undefined)[] {
  const out: (number | undefined)[] = [undefined];
  if (closes.length < 2) return out;

  const gains: number[] = [0];
  const losses: number[] = [0];
  for (let i = 1; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1];
    gains.push(diff > 0 ? diff : 0);
    losses.push(diff < 0 ? -diff : 0);
  }

  let avgGain = 0;
  let avgLoss = 0;
  for (let i = 1; i < closes.length; i++) {
    if (i < period) {
      avgGain += gains[i] / period;
      avgLoss += losses[i] / period;
      out.push(undefined);
    } else if (i === period) {
      avgGain += gains[i] / period;
      avgLoss += losses[i] / period;
      const rs = avgLoss === 0 ? Infinity : avgGain / avgLoss;
      out.push(100 - 100 / (1 + rs));
    } else {
      avgGain = (avgGain * (period - 1) + gains[i]) / period;
      avgLoss = (avgLoss * (period - 1) + losses[i]) / period;
      const rs = avgLoss === 0 ? Infinity : avgGain / avgLoss;
      out.push(100 - 100 / (1 + rs));
    }
  }
  return out;
}

// MACD (12, 26, 9) — returns aligned arrays starting from index slow-1 of input
export function macd(
  closes: number[],
  fast: number = 12,
  slow: number = 26,
  signal: number = 9
): { macd: number[]; signal: number[]; histogram: number[] } {
  if (closes.length < slow) {
    return { macd: [], signal: [], histogram: [] };
  }
  const emaFast = ema(closes, fast);
  const emaSlow = ema(closes, slow);
  const macdLine = emaFast.map((v, i) => v - emaSlow[i]);
  const signalLine = ema(macdLine.slice(slow - 1), signal);
  const macdResult = macdLine.slice(slow - 1);
  const histogram = macdResult.map((v, i) => v - signalLine[i]);
  return { macd: macdResult, signal: signalLine, histogram };
}

// Bollinger Bands — returns {upper, middle, lower}
export function bollinger(
  closes: number[],
  period: number = 20,
  stdDev: number = 2
): { upper: (number | undefined)[]; middle: (number | undefined)[]; lower: (number | undefined)[] } {
  const middle = ma(closes, period);
  const upper: (number | undefined)[] = [];
  const lower: (number | undefined)[] = [];
  for (let i = 0; i < closes.length; i++) {
    if (i < period - 1) {
      upper.push(undefined);
      lower.push(undefined);
      continue;
    }
    const window = closes.slice(i - period + 1, i + 1);
    const mean = middle[i]!;
    const variance = window.reduce((acc, v) => acc + (v - mean) ** 2, 0) / period;
    const sd = Math.sqrt(variance);
    upper.push(mean + stdDev * sd);
    lower.push(mean - stdDev * sd);
  }
  return { upper, middle, lower };
}
