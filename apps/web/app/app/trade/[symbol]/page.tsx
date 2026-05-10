import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { OrderForm } from "@/components/order-form";

const KRW = new Intl.NumberFormat("ko-KR", { style: "currency", currency: "KRW", maximumFractionDigits: 0 });
const USD = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });

export default async function StockDetail({ params }: { params: Promise<{ symbol: string }> }) {
  const { symbol } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const { data: stock } = await supabase
    .from("stocks")
    .select("*")
    .eq("symbol", decodeURIComponent(symbol))
    .single();

  if (!stock) notFound();

  const { data: portfolio } = await supabase
    .from("portfolios")
    .select("id, krw_balance, usd_balance")
    .eq("user_id", user.id)
    .is("room_id", null)
    .single();

  const fmt = stock.currency === "KRW" ? KRW : USD;

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-4">
      <div>
        <div className="text-xs text-muted-foreground">{stock.symbol} · {stock.market}</div>
        <h1 className="text-2xl font-bold">{stock.name_ko ?? stock.name}</h1>
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">현재가</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold font-mono">
            {stock.last_price ? fmt.format(Number(stock.last_price)) : "—"}
          </div>
          <div className="text-xs text-muted-foreground mt-1">
            업데이트: {stock.last_price_at ? new Date(stock.last_price_at).toLocaleString("ko-KR") : "—"}
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">기본 정보</CardTitle>
        </CardHeader>
        <CardContent className="text-sm space-y-1">
          <div>섹터: {stock.sector ?? "—"}</div>
          <div>시가총액: {stock.market_cap ? fmt.format(Number(stock.market_cap)) : "—"}</div>
          <div>PER: {stock.per ?? "—"}</div>
          <div>52주 최고: {stock.fifty_two_week_high ? fmt.format(Number(stock.fifty_two_week_high)) : "—"}</div>
          <div>52주 최저: {stock.fifty_two_week_low ? fmt.format(Number(stock.fifty_two_week_low)) : "—"}</div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">거래</CardTitle>
        </CardHeader>
        <CardContent>
          {portfolio ? (
            <OrderForm
              portfolioId={portfolio.id}
              symbol={stock.symbol}
              currency={stock.currency}
              lastPrice={stock.last_price ? Number(stock.last_price) : null}
            />
          ) : (
            <div className="text-sm text-muted-foreground">포트폴리오 로딩 실패</div>
          )}
          <div className="text-xs text-muted-foreground mt-3">
            잔고: {portfolio?.krw_balance ? KRW.format(Number(portfolio.krw_balance)) : "—"}
            {" · "}
            {portfolio?.usd_balance ? USD.format(Number(portfolio.usd_balance)) : "$0"}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
