// Plan #45: 차트 상세 (landscape) — 자동 추세선 + 지표 풀 차트.
//
// 모바일: CSS rotate(90deg) 로 가로 표시 (회전 안내 후 자동).
// 데스크탑: 일반 표시.

import { redirect, notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/supabase/user";
import { ChartDetailLandscape } from "@/components/trade/chart-detail-landscape";

export default async function ChartDetailPage({
  params,
}: {
  params: Promise<{ symbol: string }>;
}) {
  const { symbol } = await params;
  const decodedSymbol = decodeURIComponent(symbol);
  const supabase = await createClient();
  const user = await getCurrentUser();
  if (!user) redirect("/auth/login");

  const { data: stock } = await supabase
    .from("stocks")
    .select("symbol, name, name_ko, market, currency, last_price")
    .eq("symbol", decodedSymbol)
    .single();
  if (!stock) notFound();

  const { data: bars } = await supabase
    .from("stock_bars")
    .select("ts, open, high, low, close, volume")
    .eq("symbol", decodedSymbol)
    .eq("interval", "1d")
    .order("ts", { ascending: true })
    .limit(365);

  const symbolName = stock.name_ko ?? stock.name;

  return (
    <ChartDetailLandscape
      symbol={stock.symbol}
      symbolName={symbolName}
      market={stock.market}
      currency={stock.currency}
      lastPrice={stock.last_price ? Number(stock.last_price) : null}
      initialBars={(bars ?? []).map((b) => ({ ...b, ts: String(b.ts) }))}
    />
  );
}
