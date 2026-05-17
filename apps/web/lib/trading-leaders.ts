// Plan #32a: 검색 페이지 / trending UI용 거래대금 상위 헬퍼.
//
// 거래대금 = 최근 7일 내 가장 최신 일봉의 close × volume.
// scope/instrument/limit별로 stocks + stock_bars를 조회 후 정렬해 반환.

import type { SupabaseClient } from "@supabase/supabase-js";

export type TradingLeader = {
  symbol: string;
  name: string;
  name_ko: string | null;
  market: string;
  currency: string;
  last_price: number | null;
  instrument_type: "stock" | "etf";
  etf_category: string | null;
  fund_family: string | null;
  trading_value: number;
};

type Options = {
  /** "KR" = KOSPI+KOSDAQ, "US" = NYSE+NASDAQ */
  scope: "KR" | "US";
  /** "all" = 둘 다, "stock"/"etf" */
  instrument: "all" | "stock" | "etf";
  /** 반환 개수 */
  limit: number;
};

/**
 * 주어진 scope/instrument에서 거래대금 상위 stocks 반환.
 * VolumeLeaders 컴포넌트와 동일 로직, 단 SSR 재사용 가능한 함수형.
 */
export async function getTradingLeaders(
  supabase: SupabaseClient,
  { scope, instrument, limit }: Options,
): Promise<TradingLeader[]> {
  const markets =
    scope === "KR" ? ["KRX_KS", "KRX_KQ"] : ["NYSE", "NASDAQ"];

  // 1. stocks fetch
  let stocksQuery = supabase
    .from("stocks")
    .select(
      "symbol, name, name_ko, market, currency, last_price, instrument_type, etf_category, fund_family",
    )
    .eq("is_active", true)
    .in("market", markets);

  if (instrument === "stock") {
    stocksQuery = stocksQuery.eq("instrument_type", "stock");
  } else if (instrument === "etf") {
    stocksQuery = stocksQuery.eq("instrument_type", "etf");
  }

  const allStocks: Omit<TradingLeader, "trading_value">[] = [];
  for (let off = 0; ; off += 1000) {
    const { data } = await stocksQuery.range(off, off + 999);
    if (!data || data.length === 0) break;
    allStocks.push(
      ...(data as Omit<TradingLeader, "trading_value">[]),
    );
    if (data.length < 1000) break;
  }

  if (allStocks.length === 0) return [];

  // 2. 가장 최근 일봉 fetch (7일 윈도우, 심볼별 첫 결과만)
  const sevenDaysAgo = new Date(Date.now() - 7 * 86400000)
    .toISOString()
    .slice(0, 10);
  const latestBars = new Map<string, { close: number; volume: number }>();
  const symbols = allStocks.map((s) => s.symbol);

  const CHUNK = 800;
  for (let ci = 0; ci < symbols.length; ci += CHUNK) {
    const symChunk = symbols.slice(ci, ci + CHUNK);
    for (let off = 0; ; off += 1000) {
      const { data: bars } = await supabase
        .from("stock_bars")
        .select("symbol, ts, close, volume")
        .in("symbol", symChunk)
        .eq("interval", "1d")
        .gte("ts", sevenDaysAgo)
        .order("ts", { ascending: false })
        .range(off, off + 999);
      if (!bars || bars.length === 0) break;
      for (const b of bars as {
        symbol: string;
        ts: string;
        close: number;
        volume: number;
      }[]) {
        if (!latestBars.has(b.symbol)) {
          latestBars.set(b.symbol, { close: b.close, volume: b.volume });
        }
      }
      if (bars.length < 1000) break;
    }
  }

  // 3. 거래대금 = close × volume. 정렬 후 상위 limit.
  const ranked: TradingLeader[] = allStocks
    .map((s) => {
      const bar = latestBars.get(s.symbol);
      if (!bar || !bar.volume) return null;
      return { ...s, trading_value: bar.close * bar.volume };
    })
    .filter((r): r is TradingLeader => r !== null)
    .sort((a, b) => b.trading_value - a.trading_value)
    .slice(0, limit);

  return ranked;
}

export function formatTradingValue(v: number, currency: string): string {
  if (currency === "KRW") {
    if (v >= 1e12) return `${(v / 1e12).toFixed(1)}조`;
    if (v >= 1e8) return `${(v / 1e8).toFixed(0)}억`;
    return v.toLocaleString();
  }
  if (v >= 1e9) return `$${(v / 1e9).toFixed(2)}B`;
  if (v >= 1e6) return `$${(v / 1e6).toFixed(1)}M`;
  return `$${(v / 1e3).toFixed(0)}K`;
}
