/**
 * Plan #22 — sector statistics 계산 헬퍼.
 * 큐레이션 / valuation API의 공통 building block.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { marketScope, medianOf, type SectorStats } from "@/lib/valuation";

type StockRow = {
  symbol: string;
  sector: string | null;
  per: number | null;
  market: string;
};

/**
 * 전체 stocks에서 sector × market_scope 별로 median PER 계산.
 * pagination으로 1000+ 종목도 안전하게 처리.
 */
export async function loadSectorStats(
  supabase: SupabaseClient,
): Promise<Map<string, SectorStats>> {
  const rows: StockRow[] = [];
  for (let offset = 0; ; offset += 1000) {
    const { data } = await supabase
      .from("stocks")
      .select("symbol, sector, per, market")
      .eq("is_active", true)
      .not("sector", "is", null)
      .not("per", "is", null)
      .gt("per", 0)
      .range(offset, offset + 999);
    if (!data || data.length === 0) break;
    rows.push(...(data as StockRow[]));
    if (data.length < 1000) break;
  }

  const buckets = new Map<string, number[]>();
  for (const r of rows) {
    if (!r.sector || !r.per) continue;
    const scope = marketScope(r.market);
    if (!scope) continue;
    const key = `${scope}::${r.sector}`;
    const arr = buckets.get(key) ?? [];
    arr.push(Number(r.per));
    buckets.set(key, arr);
  }

  const stats = new Map<string, SectorStats>();
  for (const [key, pers] of buckets) {
    const [scope, sector] = key.split("::");
    stats.set(key, {
      sector,
      marketScope: scope as "KR" | "US",
      count: pers.length,
      medianPer: medianOf(pers),
    });
  }
  return stats;
}

/**
 * 특정 (sector, scope)에 대한 stats 조회.
 */
export function getSectorStats(
  cache: Map<string, SectorStats>,
  sector: string,
  scope: "KR" | "US",
): SectorStats | null {
  return cache.get(`${scope}::${sector}`) ?? null;
}
