/**
 * Plan #21: 테마별 등락률 계산 헬퍼.
 * 각 종목의 최근 2개 일봉(stock_bars 1d)으로 1일 등락률 계산 후
 * stock_themes.weight 기반 가중 평균을 산출.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

export type ThemeReturn = {
  themeId: string;
  themeName: string;
  themeSlug: string;
  parentId: string | null;
  avgReturn: number; // -0.05 = -5%
  stockCount: number;
  topGainer?: { symbol: string; name: string; ret: number };
  topLoser?: { symbol: string; name: string; ret: number };
};

export async function computeThemeReturns(
  supabase: SupabaseClient,
): Promise<ThemeReturn[]> {
  // 1) Themes
  const { data: themes } = await supabase
    .from("themes")
    .select("id, slug, name, parent_id");
  if (!themes) return [];

  // 2) Stock-theme mappings + stock info
  const { data: stMappings } = await supabase
    .from("stock_themes")
    .select(
      `theme_id, weight, stocks ( symbol, name, name_ko, last_price )`,
    );
  if (!stMappings) return [];

  type Row = {
    theme_id: string;
    weight: number;
    stocks: {
      symbol: string;
      name: string;
      name_ko: string | null;
      last_price: number | null;
    } | null;
  };
  const rows = stMappings as unknown as Row[];

  // 3) Get yesterday's close for all symbols (most recent 2 daily bars)
  const symbols = Array.from(
    new Set(rows.map((r) => r.stocks?.symbol).filter(Boolean) as string[]),
  );
  if (symbols.length === 0) return [];

  // pagination — PostgREST 1000-row limit
  const closes = new Map<string, number[]>(); // symbol → [yesterday, today_or_latest]
  for (let offset = 0; offset < symbols.length * 2; offset += 1000) {
    const { data: bars } = await supabase
      .from("stock_bars")
      .select("symbol, ts, close")
      .in("symbol", symbols)
      .eq("interval", "1d")
      .order("ts", { ascending: false })
      .range(offset, offset + 999);
    if (!bars || bars.length === 0) break;
    for (const b of bars as { symbol: string; ts: string; close: number }[]) {
      const arr = closes.get(b.symbol) ?? [];
      if (arr.length < 2) {
        arr.push(b.close);
        closes.set(b.symbol, arr);
      }
    }
    if (bars.length < 1000) break;
  }

  // 4) Compute return per stock
  const stockReturns = new Map<string, number>();
  for (const sym of symbols) {
    const c = closes.get(sym);
    if (!c || c.length < 2 || c[1] === 0) continue;
    const ret = (c[0] - c[1]) / c[1];
    stockReturns.set(sym, ret);
  }

  // 5) Aggregate per theme (weighted average)
  const themeAgg = new Map<
    string,
    {
      wsum: number;
      retsum: number;
      count: number;
      gainers: { symbol: string; name: string; ret: number }[];
      losers: { symbol: string; name: string; ret: number }[];
    }
  >();

  for (const row of rows) {
    if (!row.stocks) continue;
    const sym = row.stocks.symbol;
    const ret = stockReturns.get(sym);
    if (ret === undefined) continue;
    const slot = themeAgg.get(row.theme_id) ?? {
      wsum: 0,
      retsum: 0,
      count: 0,
      gainers: [],
      losers: [],
    };
    slot.wsum += row.weight;
    slot.retsum += ret * row.weight;
    slot.count++;
    const item = {
      symbol: sym,
      name: row.stocks.name_ko ?? row.stocks.name,
      ret,
    };
    slot.gainers.push(item);
    slot.losers.push(item);
    themeAgg.set(row.theme_id, slot);
  }

  const result: ThemeReturn[] = [];
  for (const theme of themes as {
    id: string;
    slug: string;
    name: string;
    parent_id: string | null;
  }[]) {
    const agg = themeAgg.get(theme.id);
    if (!agg || agg.wsum === 0) continue;
    const topG = [...agg.gainers].sort((a, b) => b.ret - a.ret)[0];
    const topL = [...agg.losers].sort((a, b) => a.ret - b.ret)[0];
    result.push({
      themeId: theme.id,
      themeName: theme.name,
      themeSlug: theme.slug,
      parentId: theme.parent_id,
      avgReturn: agg.retsum / agg.wsum,
      stockCount: agg.count,
      topGainer: topG,
      topLoser: topL,
    });
  }

  return result.sort((a, b) => b.avgReturn - a.avgReturn);
}
