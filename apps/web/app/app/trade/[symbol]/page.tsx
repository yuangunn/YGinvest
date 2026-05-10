import { redirect, notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartArea } from "@/components/chart-area";
import { StockNews } from "@/components/stock-news";
import { StockFinancials } from "@/components/stock-financials";
import { BuySellSheet } from "@/components/buy-sell-sheet";
import { WatchlistButton } from "@/components/watchlist-button";

const KRW = new Intl.NumberFormat("ko-KR", { style: "currency", currency: "KRW", maximumFractionDigits: 0 });
const USD = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });

export default async function StockDetail({ params }: { params: Promise<{ symbol: string }> }) {
  const { symbol } = await params;
  const decodedSymbol = decodeURIComponent(symbol);
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const { data: stock } = await supabase
    .from("stocks")
    .select("*")
    .eq("symbol", decodedSymbol)
    .single();
  if (!stock) notFound();

  const [{ data: portfolio }, { data: bars }, { data: watch }] = await Promise.all([
    supabase
      .from("portfolios")
      .select("id, krw_balance, usd_balance")
      .eq("user_id", user.id)
      .is("room_id", null)
      .single(),
    supabase
      .from("stock_bars")
      .select("ts, open, high, low, close, volume")
      .eq("symbol", decodedSymbol)
      .eq("interval", "1d")
      .order("ts", { ascending: true })
      .limit(365),
    supabase
      .from("watchlists")
      .select("symbol")
      .eq("symbol", decodedSymbol)
      .maybeSingle(),
  ]);

  const fmt = stock.currency === "KRW" ? KRW : USD;
  const symbolName = stock.name_ko ?? stock.name;

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-xs text-muted-foreground">{stock.symbol} · {stock.market}</div>
          <h1 className="text-2xl font-bold">{symbolName}</h1>
        </div>
        <WatchlistButton symbol={stock.symbol} initialWatched={!!watch} />
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
          <CardTitle className="text-base">차트</CardTitle>
        </CardHeader>
        <CardContent>
          <ChartArea
            symbol={stock.symbol}
            initialBars={(bars ?? []).map((b) => ({ ...b, ts: String(b.ts) }))}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">거래</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {portfolio ? (
            <BuySellSheet
              portfolioId={portfolio.id}
              symbol={stock.symbol}
              symbolName={symbolName}
              currency={stock.currency}
              lastPrice={stock.last_price ? Number(stock.last_price) : null}
            />
          ) : (
            <div className="text-sm text-muted-foreground">포트폴리오 로딩 실패</div>
          )}
          <div className="text-xs text-muted-foreground">
            잔고: {portfolio?.krw_balance ? KRW.format(Number(portfolio.krw_balance)) : "—"}
            {" · "}
            {portfolio?.usd_balance ? USD.format(Number(portfolio.usd_balance)) : "$0"}
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
          <CardTitle className="text-base">재무 지표</CardTitle>
        </CardHeader>
        <CardContent>
          <StockFinancials symbol={stock.symbol} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">뉴스</CardTitle>
        </CardHeader>
        <CardContent>
          <StockNews symbol={stock.symbol} />
        </CardContent>
      </Card>
    </div>
  );
}
