import Link from "next/link";
import { Target } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { loadSectorStats, getSectorStats } from "@/lib/sector-stats";
import {
  computeValuation,
  marketScope,
  RATING_COLOR,
  RATING_LABEL,
  type Rating,
} from "@/lib/valuation";

const KRW = new Intl.NumberFormat("ko-KR", {
  style: "currency",
  currency: "KRW",
  maximumFractionDigits: 0,
});
const USD = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

export async function StockRatingBadge({ symbol }: { symbol: string }) {
  const supabase = await createClient();
  const { data: stock } = await supabase
    .from("stocks")
    .select(
      "symbol, sector, market, currency, last_price, per, fifty_two_week_high, fifty_two_week_low",
    )
    .eq("symbol", symbol)
    .maybeSingle();
  if (!stock) return null;

  const scope = marketScope(stock.market);
  if (!stock.sector || !scope) return null;

  const sectorStats = await loadSectorStats(supabase);
  const stats = getSectorStats(sectorStats, stock.sector, scope);

  const v = computeValuation(
    {
      symbol: stock.symbol,
      per: stock.per ? Number(stock.per) : null,
      last_price: stock.last_price ? Number(stock.last_price) : null,
      market: stock.market,
      sector: stock.sector,
      fifty_two_week_high: stock.fifty_two_week_high
        ? Number(stock.fifty_two_week_high)
        : null,
      fifty_two_week_low: stock.fifty_two_week_low
        ? Number(stock.fifty_two_week_low)
        : null,
    },
    stats,
  );

  if (!v.hasData) return null;

  const fmt = stock.currency === "KRW" ? KRW : USD;
  const ratingClass = RATING_COLOR[v.rating as Rating];

  return (
    <Link
      href={`/app/stocks/${encodeURIComponent(symbol)}/analysis`}
      className={`inline-flex items-center gap-2 rounded-md border px-2.5 py-1 text-xs ${ratingClass} hover:opacity-90 transition-opacity`}
      title="자세한 분석 보기"
    >
      <Target className="h-3 w-3" />
      <span className="font-bold">{RATING_LABEL[v.rating as Rating]}</span>
      <span className="text-muted-foreground">
        목표 {fmt.format(v.targetPrice!)} (
        {v.upsidePct! >= 0 ? "+" : ""}
        {(v.upsidePct! * 100).toFixed(1)}%)
      </span>
    </Link>
  );
}
