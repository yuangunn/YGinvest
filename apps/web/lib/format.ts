/**
 * 공통 포맷 헬퍼. 큰 숫자를 사람이 읽기 좋게.
 */

const KRW = new Intl.NumberFormat("ko-KR", {
  style: "currency",
  currency: "KRW",
  maximumFractionDigits: 0,
});
const USD = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

export function formatMarketCap(cap: number, currency: string): string {
  if (currency === "KRW") {
    if (cap >= 1e12) return `${(cap / 1e12).toFixed(1)}조원`;
    if (cap >= 1e8) return `${(cap / 1e8).toFixed(0)}억원`;
    return KRW.format(cap);
  }
  if (cap >= 1e12) return `$${(cap / 1e12).toFixed(2)}T`;
  if (cap >= 1e9) return `$${(cap / 1e9).toFixed(2)}B`;
  if (cap >= 1e6) return `$${(cap / 1e6).toFixed(1)}M`;
  return USD.format(cap);
}

export function formatVolume(v: number): string {
  if (v >= 1e9) return `${(v / 1e9).toFixed(1)}B`;
  if (v >= 1e6) return `${(v / 1e6).toFixed(1)}M`;
  if (v >= 1e3) return `${(v / 1e3).toFixed(1)}K`;
  return String(v);
}
