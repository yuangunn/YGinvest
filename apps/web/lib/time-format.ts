// 시장별 타임존 변환 + 라벨 헬퍼.
//
// last_price_at은 UTC ISO string으로 DB에 저장됨.
// 표시 시 market 종류에 따라 KST 또는 ET(EDT/EST)로 변환해 사용자가 헷갈리지 않게 함.
//
// - KR markets (KRX_KS, KRX_KQ): KST = UTC+9 (DST 없음, 항상 고정)
// - US markets (NASDAQ, NYSE): EDT = UTC-4 (3~11월) / EST = UTC-5 (11~3월)
//   * Intl.DateTimeFormat의 short timeZoneName이 자동 판별

export type MarketLike =
  | "KRX_KS"
  | "KRX_KQ"
  | "NASDAQ"
  | "NYSE"
  | string
  | null
  | undefined;

function isUsMarket(market: MarketLike): boolean {
  return market === "NASDAQ" || market === "NYSE";
}

function tzInfoFor(market: MarketLike, date: Date): { tz: string; label: string } {
  if (isUsMarket(market)) {
    // EDT/EST는 DST 따라 자동 판별
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: "America/New_York",
      timeZoneName: "short",
    }).formatToParts(date);
    const name = parts.find((p) => p.type === "timeZoneName")?.value ?? "EST";
    const offset = name === "EDT" ? "-4" : "-5";
    return { tz: "America/New_York", label: `${name} / UTC ${offset}` };
  }
  // 기본은 KST (KR + 알 수 없는 시장도 KST로 표시)
  return { tz: "Asia/Seoul", label: "KST / UTC +9" };
}

/**
 * UTC ISO 문자열을 시장 현지 시각 + TZ 라벨로 변환.
 *
 * @example
 *   formatMarketTimestamp("2026-05-14T04:45:23Z", "NASDAQ")
 *   → "2026. 5. 14. 오전 12:45:23 (EDT / UTC -4)"
 *
 *   formatMarketTimestamp("2026-05-14T04:45:23Z", "KRX_KS")
 *   → "2026. 5. 14. 오후 1:45:23 (KST / UTC +9)"
 */
export function formatMarketTimestamp(
  isoString: string,
  market: MarketLike,
): string {
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) return "—";
  const { tz, label } = tzInfoFor(market, date);
  const formatted = date.toLocaleString("ko-KR", {
    timeZone: tz,
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });
  return `${formatted} (${label})`;
}
