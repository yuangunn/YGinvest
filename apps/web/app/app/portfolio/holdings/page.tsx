import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent } from "@/components/ui/card";
import { getSelectedPortfolioId } from "@/lib/portfolio-context";

const KRW = new Intl.NumberFormat("ko-KR", { style: "currency", currency: "KRW", maximumFractionDigits: 0 });
const USD = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });

export default async function HoldingsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const portfolioId = await getSelectedPortfolioId(supabase, user.id);
  const { data: holdings } = portfolioId
    ? await supabase
        .from("holdings")
        .select("portfolio_id, symbol, quantity, avg_cost, updated_at, stocks(name, name_ko, currency, market, last_price)")
        .eq("portfolio_id", portfolioId)
    : { data: null };

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-4">
      <h1 className="text-2xl font-bold">보유 종목</h1>
      <Card>
        <CardContent className="pt-6">
          {!holdings || holdings.length === 0 ? (
            <div className="text-center py-12 space-y-3">
              <div className="text-4xl" aria-hidden>📈</div>
              <div className="text-sm text-muted-foreground">아직 보유 종목이 없어요</div>
              <Link
                href="/app/trade/search"
                className="inline-block text-sm text-primary hover:underline"
              >
                → 종목 검색해서 매수하기
              </Link>
            </div>
          ) : (
            <ul className="space-y-3">
              {holdings.map((h) => {
                const stock = Array.isArray(h.stocks) ? h.stocks[0] : h.stocks;
                const fmt = stock?.currency === "KRW" ? KRW : USD;
                const cost = Number(h.avg_cost) * Number(h.quantity);
                const value = stock?.last_price ? Number(stock.last_price) * Number(h.quantity) : null;
                const pl = value !== null ? value - cost : null;
                return (
                  <li key={h.symbol} className="border-b pb-2">
                    <Link href={`/app/trade/${encodeURIComponent(h.symbol)}`} className="block hover:bg-muted/30 p-2 rounded">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="font-medium">{stock?.name_ko ?? stock?.name ?? h.symbol}</div>
                          <div className="text-xs text-muted-foreground">{h.symbol} · {h.quantity}주</div>
                        </div>
                        <div className="text-right">
                          <div className="font-mono text-sm">평단 {fmt.format(Number(h.avg_cost))}</div>
                          {value !== null && (
                            <div className={`text-sm ${pl! >= 0 ? "text-green-500" : "text-red-500"}`}>
                              {fmt.format(value)} ({pl! >= 0 ? "+" : ""}{fmt.format(pl!)})
                            </div>
                          )}
                        </div>
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
