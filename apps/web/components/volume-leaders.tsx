import Link from "next/link";
import { Flame } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Term } from "@/components/term";

type StockMeta = {
  symbol: string;
  name: string;
  name_ko: string | null;
  market: string;
  currency: string;
  last_price: number | null;
};

const KRW = new Intl.NumberFormat("ko-KR", {
  style: "currency",
  currency: "KRW",
  maximumFractionDigits: 0,
});
const USD = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });

function formatVolume(v: number, currency: string): string {
  if (currency === "KRW") {
    if (v >= 1e12) return `${(v / 1e12).toFixed(1)}조`;
    if (v >= 1e8) return `${(v / 1e8).toFixed(0)}억`;
    return v.toLocaleString();
  }
  if (v >= 1e9) return `$${(v / 1e9).toFixed(2)}B`;
  if (v >= 1e6) return `$${(v / 1e6).toFixed(1)}M`;
  return `$${(v / 1e3).toFixed(0)}K`;
}

/**
 * Plan #23 — 거래대금 상위 종목 (오늘 일봉의 close × volume 기준).
 * scope === "KR" || "US"
 */
export async function VolumeLeaders({
  scope = "KR",
  limit = 5,
}: {
  scope?: "KR" | "US";
  limit?: number;
}) {
  const supabase = await createClient();
  const markets =
    scope === "KR" ? ["KRX_KS", "KRX_KQ"] : ["NYSE", "NASDAQ"];

  // 가장 최근 일봉 1개 (오늘 종가) — pagination 필요
  // 종가 × 거래량 = 거래대금. 모든 active stocks 로드 후 정렬.
  const stocks: StockMeta[] = [];
  for (let off = 0; ; off += 1000) {
    const { data } = await supabase
      .from("stocks")
      .select("symbol, name, name_ko, market, currency, last_price")
      .eq("is_active", true)
      .in("market", markets)
      .range(off, off + 999);
    if (!data || data.length === 0) break;
    stocks.push(...(data as StockMeta[]));
    if (data.length < 1000) break;
  }

  if (stocks.length === 0) return null;
  const symbols = stocks.map((s) => s.symbol);

  // 가장 최근 일봉 거래량
  const latestBars = new Map<string, { close: number; volume: number }>();
  for (let off = 0; ; off += 1000) {
    const { data: bars } = await supabase
      .from("stock_bars")
      .select("symbol, ts, close, volume")
      .in("symbol", symbols.slice(0, Math.min(symbols.length, 1500)))
      .eq("interval", "1d")
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

  // 거래대금 = close × volume
  const ranked = stocks
    .map((s) => {
      const bar = latestBars.get(s.symbol);
      if (!bar || !bar.volume) return null;
      const tradingValue = bar.close * bar.volume;
      return { stock: s, tradingValue, volume: bar.volume };
    })
    .filter((r): r is NonNullable<typeof r> => r !== null)
    .sort((a, b) => b.tradingValue - a.tradingValue)
    .slice(0, limit);

  if (ranked.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Flame className="h-4 w-4 text-orange-500" />
          <Term k="trading-value">거래대금</Term> 상위 · {scope}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-1">
          {ranked.map(({ stock, tradingValue }, idx) => {
            const fmt = stock.currency === "KRW" ? KRW : USD;
            const name = stock.name_ko ?? stock.name;
            const price = stock.last_price
              ? fmt.format(Number(stock.last_price))
              : "—";
            return (
              <Link
                key={stock.symbol}
                href={`/app/trade/${encodeURIComponent(stock.symbol)}`}
                className="flex items-center justify-between gap-2 rounded p-2 hover:bg-muted/30 transition-colors"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-xs text-muted-foreground w-4">
                    {idx + 1}
                  </span>
                  <div className="min-w-0">
                    <div className="text-sm font-medium truncate">{name}</div>
                    <div className="text-[10px] text-muted-foreground">
                      {stock.symbol}
                    </div>
                  </div>
                </div>
                <div className="text-right flex-shrink-0">
                  <div className="font-mono text-sm tabular-nums">{price}</div>
                  <div className="text-[10px] text-muted-foreground tabular-nums">
                    {formatVolume(tradingValue, stock.currency)}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
