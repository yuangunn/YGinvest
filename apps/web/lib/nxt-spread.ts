/**
 * NXT spread tier (Plan #12.5) — KRX 종목 한정.
 * PG `_kr_spread_bps()`와 1:1 매핑. UI 표시용.
 */

export function krSpreadBps(marketCap: number | null | undefined): number {
  if (marketCap == null) return 15;
  if (marketCap >= 10_000_000_000_000) return 5; // 10조원 +
  if (marketCap >= 1_000_000_000_000) return 10; // 1~10조원
  return 20; // < 1조원
}

export type SpreadTier = "tier1" | "tier2" | "tier3" | "unknown";

export function krSpreadTier(marketCap: number | null | undefined): SpreadTier {
  if (marketCap == null) return "unknown";
  if (marketCap >= 10_000_000_000_000) return "tier1";
  if (marketCap >= 1_000_000_000_000) return "tier2";
  return "tier3";
}

export const TIER_LABEL: Record<SpreadTier, string> = {
  tier1: "대형주",
  tier2: "중형주",
  tier3: "소형주",
  unknown: "—",
};
