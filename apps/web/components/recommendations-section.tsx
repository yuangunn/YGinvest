import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RecommendationCardLink } from "@/components/recommendation-card-link";

const CATEGORY_LABEL: Record<string, string> = {
  top_gainers: "급등 종목",
  top_losers: "급락 종목",
  volume_surge: "거래량 급증",
  near_52w_high: "52주 신고가 근처",
  low_per_value: "저PER 가치",
};

type Category = keyof typeof CATEGORY_LABEL;

type Rec = {
  category: string;
  market_scope: string;
  symbol: string;
  rank: number;
  score: number;
  reason: string | null;
};

type StockMeta = {
  symbol: string;
  name: string;
  name_ko: string | null;
  currency: string;
  last_price: number | null;
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

function reasonToneClass(category: Category): string {
  if (category === "top_gainers" || category === "volume_surge" || category === "near_52w_high") {
    return "text-green-500";
  }
  if (category === "top_losers") {
    return "text-red-500";
  }
  return "text-muted-foreground";
}

export async function RecommendationsSection({
  scope = "KR",
  category,
  limit = 5,
}: {
  scope?: "KR" | "US";
  category: Category;
  limit?: number;
}) {
  const supabase = await createClient();
  const { data: recs } = await supabase
    .from("recommendations")
    .select("category, market_scope, symbol, rank, score, reason")
    .eq("category", category)
    .eq("market_scope", scope)
    .order("rank", { ascending: true })
    .limit(limit);

  if (!recs || recs.length === 0) {
    return null;
  }

  const typedRecs = recs as Rec[];
  const symbols = typedRecs.map((r) => r.symbol);
  const { data: stocks } = await supabase
    .from("stocks")
    .select("symbol, name, name_ko, currency, last_price")
    .in("symbol", symbols);
  const stockBySymbol = new Map<string, StockMeta>(
    ((stocks as StockMeta[] | null) ?? []).map((s) => [s.symbol, s]),
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">
          {CATEGORY_LABEL[category]} · {scope}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex gap-2 overflow-x-auto pb-2">
          {typedRecs.map((r) => {
            const stock = stockBySymbol.get(r.symbol);
            const fmt = stock?.currency === "KRW" ? KRW : USD;
            const name = stock?.name_ko ?? stock?.name ?? r.symbol;
            const price = stock?.last_price
              ? fmt.format(Number(stock.last_price))
              : "—";
            return (
              <RecommendationCardLink
                key={`${category}-${scope}-${r.symbol}`}
                href={`/app/trade/${encodeURIComponent(r.symbol)}`}
                category={category}
                marketScope={scope}
                symbol={r.symbol}
                rank={r.rank}
                className="flex-shrink-0 w-40 border rounded-lg p-3 hover:bg-muted/30 transition-colors"
              >
                <div className="text-xs text-muted-foreground">#{r.rank}</div>
                <div className="font-medium text-sm truncate">{name}</div>
                <div className="text-xs text-muted-foreground">{r.symbol}</div>
                <div className="text-sm font-mono mt-1">{price}</div>
                {r.reason && (
                  <div className={`text-xs mt-1 ${reasonToneClass(category)}`}>
                    {r.reason}
                  </div>
                )}
              </RecommendationCardLink>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
