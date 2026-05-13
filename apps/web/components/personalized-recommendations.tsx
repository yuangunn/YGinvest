import { Sparkles } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RecommendationCardLink } from "@/components/recommendation-card-link";

type SymbolRow = { symbol: string };
type StockMeta = {
  symbol: string;
  name: string;
  name_ko: string | null;
  currency: string;
  last_price: number | null;
  market_cap: number | null;
  sector: string | null;
};

const KRW = new Intl.NumberFormat("ko-KR", {
  style: "currency",
  currency: "KRW",
  maximumFractionDigits: 0,
});
const USD = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

export async function PersonalizedRecommendations({
  portfolioId,
}: {
  portfolioId: string;
}) {
  const supabase = await createClient();

  // 1) 사용자 시그널 집합 — holdings + watchlists
  const [{ data: holdings }, { data: watchlists }] = await Promise.all([
    supabase
      .from("holdings")
      .select("symbol")
      .eq("portfolio_id", portfolioId),
    supabase
      .from("watchlists")
      .select("symbol")
      .eq("portfolio_id", portfolioId),
  ]);

  const userSymbols = new Set<string>([
    ...((holdings as SymbolRow[] | null) ?? []).map((r) => r.symbol),
    ...((watchlists as SymbolRow[] | null) ?? []).map((r) => r.symbol),
  ]);
  if (userSymbols.size === 0) return null;

  // 2) 각 symbol의 sector
  const { data: userStocks } = await supabase
    .from("stocks")
    .select("symbol, sector")
    .in("symbol", [...userSymbols]);

  const sectorCounts: Record<string, number> = {};
  for (const s of (userStocks as { symbol: string; sector: string | null }[] | null) ?? []) {
    if (s.sector) sectorCounts[s.sector] = (sectorCounts[s.sector] ?? 0) + 1;
  }
  const topSectors = Object.entries(sectorCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 2)
    .map(([sector]) => sector);

  if (topSectors.length === 0) return null;

  // 3) 같은 sector 안에서 사용자가 안 가진 종목 — market_cap DESC
  const { data: candidates } = await supabase
    .from("stocks")
    .select("symbol, name, name_ko, currency, last_price, market_cap, sector")
    .in("sector", topSectors)
    .not("market_cap", "is", null)
    .order("market_cap", { ascending: false })
    .limit(50);

  const recs = ((candidates as StockMeta[] | null) ?? [])
    .filter((s) => !userSymbols.has(s.symbol))
    .slice(0, 5);

  if (recs.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <CardTitle className="text-base flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            당신을 위한 추천
          </CardTitle>
          <div className="flex flex-wrap gap-1">
            {topSectors.map((s) => (
              <span
                key={s}
                className="text-xs rounded-full bg-muted px-2 py-0.5 text-muted-foreground"
              >
                {s}
              </span>
            ))}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex gap-2 overflow-x-auto pb-2">
          {recs.map((s, idx) => {
            const fmt = s.currency === "KRW" ? KRW : USD;
            const name = s.name_ko ?? s.name;
            const price = s.last_price ? fmt.format(Number(s.last_price)) : "—";
            return (
              <RecommendationCardLink
                key={s.symbol}
                href={`/app/trade/${encodeURIComponent(s.symbol)}`}
                category="personalized"
                symbol={s.symbol}
                rank={idx + 1}
                className="flex-shrink-0 w-40 border rounded-lg p-3 hover:bg-muted/30 hover:border-primary/40 transition-colors"
              >
                <div className="text-xs text-muted-foreground truncate">
                  {s.sector ?? "—"}
                </div>
                <div className="font-medium text-sm truncate">{name}</div>
                <div className="text-xs text-muted-foreground">{s.symbol}</div>
                <div className="text-sm font-mono mt-1">{price}</div>
              </RecommendationCardLink>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
