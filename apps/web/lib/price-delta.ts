// 전일 대비 가격 변동 계산 (순수 함수).
//
// 일봉(ts 오름차순)과 현재가(last_price)로 "직전 거래일 종가"를 정한다:
//   - 마지막 봉의 close가 현재가와 같으면 그 봉은 '오늘' → 직전 봉이 전일 종가
//   - 다르면 마지막 봉이 직전 거래일 종가

export type DailyBar = { close: number | string };

/** 직전 거래일 종가. 계산 불가 시 null. */
export function previousClose(
  bars: DailyBar[],
  lastPrice: number | null,
): number | null {
  if (lastPrice == null || bars.length === 0) return null;
  const lastBarClose = Number(bars[bars.length - 1].close);
  if (Math.abs(lastBarClose - lastPrice) < 1e-9) {
    return bars.length >= 2 ? Number(bars[bars.length - 2].close) : null;
  }
  return lastBarClose;
}

/** 전일 대비 변동(절대/퍼센트). 계산 불가 시 null. */
export function priceDelta(
  lastPrice: number | null,
  prevClose: number | null,
): { abs: number; pct: number } | null {
  if (lastPrice == null || prevClose == null || prevClose <= 0) return null;
  const abs = lastPrice - prevClose;
  return { abs, pct: (abs / prevClose) * 100 };
}
