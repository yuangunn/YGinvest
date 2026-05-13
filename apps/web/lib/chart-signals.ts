// Chart 자동 매수/매도 시그널 계산.
// 현재 활성화된 지표(indicator)에 따라 적절한 시그널 규칙 사용.
// 같은 방향 시그널이 연속 발생하지 않도록 lastSide로 트래킹.

import {
  ma,
  rsi,
  macd as macdFn,
  stochastic,
  bollinger,
  vwap as vwapFn,
} from "@/lib/indicators";
import type { IndicatorType } from "@/components/stock-chart";

export type SignalSide = "buy" | "sell";

export type ChartSignal = {
  /** ISO ts of the bar at which the signal fires */
  ts: string;
  side: SignalSide;
  /** Human-readable reason (for tooltip / debug) */
  reason: string;
};

export type SignalBar = {
  ts: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

/**
 * 지표별 buy/sell 시그널을 계산해 시간순으로 반환.
 *
 * - `ma`: MA20/60 골든·데드 크로스
 * - `rsi`: RSI<30 진입 매수, >70 진입 매도
 * - `macd`: 히스토그램 0 상향 매수, 하향 매도
 * - `stoch`: %K 20 상향 매수, 80 하향 매도
 * - `bollinger`: 종가가 하단 밴드 상향 돌파 매수, 상단 밴드 하향 돌파 매도
 * - `vwap`: VWAP 상향 매수, 하향 매도
 * - `none`: 기본 MA20/60 cross 사용
 */
export function computeSignals(
  bars: SignalBar[],
  indicator: IndicatorType,
): ChartSignal[] {
  if (bars.length < 30) return [];

  const closes = bars.map((b) => b.close);
  const highs = bars.map((b) => b.high);
  const lows = bars.map((b) => b.low);

  const effectiveInd: IndicatorType = indicator === "none" ? "ma" : indicator;
  const signals: ChartSignal[] = [];
  let lastSide: SignalSide | null = null;

  function push(i: number, side: SignalSide, reason: string) {
    if (side === lastSide) return; // 같은 방향 연속 방지
    lastSide = side;
    signals.push({ ts: bars[i].ts, side, reason });
  }

  if (effectiveInd === "ma") {
    const ma20 = ma(closes, 20);
    const ma60 = ma(closes, 60);
    for (let i = 60; i < bars.length; i++) {
      const cur20 = ma20[i];
      const prev20 = ma20[i - 1];
      const cur60 = ma60[i];
      const prev60 = ma60[i - 1];
      if (
        cur20 === undefined ||
        prev20 === undefined ||
        cur60 === undefined ||
        prev60 === undefined
      )
        continue;
      if (prev20 <= prev60 && cur20 > cur60) push(i, "buy", "골든 크로스");
      else if (prev20 >= prev60 && cur20 < cur60) push(i, "sell", "데드 크로스");
    }
  } else if (effectiveInd === "rsi") {
    const rsiVals = rsi(closes, 14);
    for (let i = 1; i < bars.length; i++) {
      const cur = rsiVals[i];
      const prev = rsiVals[i - 1];
      if (cur === undefined || prev === undefined) continue;
      if (prev >= 30 && cur < 30) push(i, "buy", "과매도 진입 (RSI<30)");
      else if (prev <= 70 && cur > 70) push(i, "sell", "과매수 진입 (RSI>70)");
    }
  } else if (effectiveInd === "macd") {
    const SLOW = 26;
    const m = macdFn(closes, 12, SLOW, 9);
    for (let mi = 1; mi < m.histogram.length; mi++) {
      const cur = m.histogram[mi];
      const prev = m.histogram[mi - 1];
      const barIdx = mi + SLOW - 1;
      if (prev <= 0 && cur > 0) push(barIdx, "buy", "MACD 히스토그램 0 상향");
      else if (prev >= 0 && cur < 0)
        push(barIdx, "sell", "MACD 히스토그램 0 하향");
    }
  } else if (effectiveInd === "stoch") {
    const { k } = stochastic(highs, lows, closes, 14, 3);
    for (let i = 1; i < bars.length; i++) {
      const cur = k[i];
      const prev = k[i - 1];
      if (cur === undefined || prev === undefined) continue;
      if (prev <= 20 && cur > 20) push(i, "buy", "%K 20 상향 돌파");
      else if (prev >= 80 && cur < 80) push(i, "sell", "%K 80 하향 돌파");
    }
  } else if (effectiveInd === "bollinger") {
    const { upper, lower } = bollinger(closes, 20, 2);
    for (let i = 1; i < bars.length; i++) {
      const c = closes[i];
      const pc = closes[i - 1];
      const u = upper[i];
      const pu = upper[i - 1];
      const l = lower[i];
      const pl = lower[i - 1];
      if (u === undefined || pu === undefined || l === undefined || pl === undefined)
        continue;
      // 종가가 하단을 위로 돌파 → 매수
      if (pc <= pl && c > l) push(i, "buy", "Bollinger 하단 회복");
      // 종가가 상단을 아래로 돌파 → 매도
      else if (pc >= pu && c < u) push(i, "sell", "Bollinger 상단 이탈");
    }
  } else if (effectiveInd === "vwap") {
    const vwapVals = vwapFn(
      bars.map((b) => ({
        high: b.high,
        low: b.low,
        close: b.close,
        volume: b.volume,
      })),
    );
    for (let i = 1; i < bars.length; i++) {
      const v = vwapVals[i];
      const pv = vwapVals[i - 1];
      if (v === undefined || pv === undefined) continue;
      const c = closes[i];
      const pc = closes[i - 1];
      if (pc <= pv && c > v) push(i, "buy", "VWAP 상향 돌파");
      else if (pc >= pv && c < v) push(i, "sell", "VWAP 하향 돌파");
    }
  }

  return signals;
}
