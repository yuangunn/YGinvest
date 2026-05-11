import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AllocationDonut } from "@/components/allocation-donut";
import { getSelectedPortfolioId } from "@/lib/portfolio-context";

const KRW = new Intl.NumberFormat("ko-KR", { style: "currency", currency: "KRW", maximumFractionDigits: 0 });

export default async function PortfolioOverview() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const portfolioId = await getSelectedPortfolioId(supabase, user.id);
  const { data: portfolio } = portfolioId
    ? await supabase
        .from("portfolios")
        .select("id, krw_balance, usd_balance, starting_krw, starting_usd, fx_rate_at_start, room_id, status")
        .eq("id", portfolioId)
        .single()
    : { data: null };

  const { data: fxRow } = await supabase
    .from("fx_rates")
    .select("rate")
    .eq("base", "USD")
    .eq("quote", "KRW")
    .order("ts", { ascending: false })
    .limit(1)
    .maybeSingle();
  const fxRate = fxRow?.rate ? Number(fxRow.rate) : 1395;

  const { data: holdings } = await supabase
    .from("holdings")
    .select("symbol, quantity, avg_cost, stocks(name, name_ko, currency, last_price)")
    .eq("portfolio_id", portfolio?.id ?? "");

  const krwCash = Number(portfolio?.krw_balance ?? 0);
  const usdCash = Number(portfolio?.usd_balance ?? 0);
  const usdCashKrw = usdCash * fxRate;

  const slices: { name: string; value: number }[] = [];
  let totalHoldingsKrw = 0;
  for (const h of holdings ?? []) {
    const stock = Array.isArray(h.stocks) ? h.stocks[0] : h.stocks;
    if (!stock?.last_price) continue;
    const valueLocal = Number(stock.last_price) * Number(h.quantity);
    const valueKrw = stock.currency === "KRW" ? valueLocal : valueLocal * fxRate;
    totalHoldingsKrw += valueKrw;
    slices.push({
      name: stock.name_ko ?? stock.name ?? h.symbol,
      value: Math.round(valueKrw),
    });
  }
  if (krwCash > 0) slices.push({ name: "KRW 현금", value: Math.round(krwCash) });
  if (usdCashKrw > 0) slices.push({ name: "USD 현금", value: Math.round(usdCashKrw) });

  const totalKrw = krwCash + usdCashKrw + totalHoldingsKrw;
  const startingKrwEq =
    Number(portfolio?.starting_krw ?? 0) +
    Number(portfolio?.starting_usd ?? 0) * Number(portfolio?.fx_rate_at_start ?? 1395);
  const returnPct = startingKrwEq > 0 ? ((totalKrw - startingKrwEq) / startingKrwEq) * 100 : 0;

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-4">
      <h1 className="text-2xl font-bold">포트폴리오 Overview</h1>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">총자산 (KRW 환산)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{KRW.format(totalKrw)}</div>
            <div className="text-xs text-muted-foreground mt-1">
              시작: {KRW.format(startingKrwEq)} (1 USD = ₩{fxRate})
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">누적 수익률</CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${returnPct >= 0 ? "text-green-500" : "text-red-500"}`}>
              {returnPct >= 0 ? "+" : ""}{returnPct.toFixed(2)}%
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              {KRW.format(totalKrw - startingKrwEq)} {totalKrw - startingKrwEq >= 0 ? "이익" : "손실"}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">자산 배분</CardTitle>
        </CardHeader>
        <CardContent>
          <AllocationDonut slices={slices} />
        </CardContent>
      </Card>

      <div className="text-sm text-muted-foreground">
        <Link href="/app/portfolio/holdings" className="underline">→ 보유 종목 상세</Link>
        {" · "}
        <Link href="/app/portfolio/orders" className="underline">→ 주문 내역</Link>
      </div>
    </div>
  );
}
