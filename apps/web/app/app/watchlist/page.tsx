import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent } from "@/components/ui/card";
import { getSelectedPortfolioId } from "@/lib/portfolio-context";

const KRW = new Intl.NumberFormat("ko-KR", { style: "currency", currency: "KRW", maximumFractionDigits: 0 });
const USD = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });

export default async function WatchlistPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const portfolioId = await getSelectedPortfolioId(supabase, user.id);
  const { data: items } = portfolioId
    ? await supabase
        .from("watchlists")
        .select("symbol, added_at, stocks(name, name_ko, currency, market, last_price)")
        .eq("portfolio_id", portfolioId)
        .order("added_at", { ascending: false })
    : { data: null };

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-4">
      <h1 className="text-2xl font-bold">관심 종목</h1>
      <Card>
        <CardContent className="pt-6">
          {!items || items.length === 0 ? (
            <div className="text-center py-12 space-y-3">
              <div className="text-4xl" aria-hidden>⭐</div>
              <div className="text-sm text-muted-foreground">관심 종목이 없어요</div>
              <Link
                href="/app/trade/search"
                className="inline-block text-sm text-primary hover:underline"
              >
                → 종목 검색 후 ☆로 추가
              </Link>
            </div>
          ) : (
            <ul className="space-y-2">
              {items.map((it) => {
                const stock = Array.isArray(it.stocks) ? it.stocks[0] : it.stocks;
                const fmt = stock?.currency === "KRW" ? KRW : USD;
                return (
                  <li key={it.symbol} className="border-b pb-2">
                    <Link
                      href={`/app/trade/${encodeURIComponent(it.symbol)}`}
                      className="block hover:bg-muted/30 p-2 rounded flex items-center justify-between"
                    >
                      <div>
                        <div className="font-medium">{stock?.name_ko ?? stock?.name ?? it.symbol}</div>
                        <div className="text-xs text-muted-foreground">{it.symbol} · {stock?.market}</div>
                      </div>
                      <div className="font-mono text-sm">
                        {stock?.last_price ? fmt.format(Number(stock.last_price)) : "—"}
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
