import { Suspense } from "react";
import { redirect, notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartArea } from "@/components/chart-area";
import { StockNews } from "@/components/stock-news";
import { StockFinancials } from "@/components/stock-financials";
import Link from "next/link";
import { GitCompare } from "lucide-react";
import { BuySellSheet } from "@/components/buy-sell-sheet";
import { WatchlistButton } from "@/components/watchlist-button";
import { KrSessionBadge } from "@/components/kr-session-badge";
import { NxtSpreadBadge } from "@/components/nxt-spread-badge";
import { StockThemes } from "@/components/stock-themes";
import { StockRatingBadge } from "@/components/stock-rating-badge";
import { Term } from "@/components/term";
import { OrderBook } from "@/components/order-book";
import { PriceAlertForm } from "@/components/price-alert-form";
import { getSelectedPortfolioId } from "@/lib/portfolio-context";

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

  const portfolioId = await getSelectedPortfolioId(supabase, user.id);
  const [{ data: portfolio }, { data: bars }, { data: watch }, { data: alerts }] =
    await Promise.all([
      portfolioId
        ? supabase
            .from("portfolios")
            .select("id, krw_balance, usd_balance, status")
            .eq("id", portfolioId)
            .single()
        : Promise.resolve({ data: null }),
      supabase
        .from("stock_bars")
        .select("ts, open, high, low, close, volume")
        .eq("symbol", decodedSymbol)
        .eq("interval", "1d")
        .order("ts", { ascending: true })
        .limit(365),
      portfolioId
        ? supabase
            .from("watchlists")
            .select("symbol")
            .eq("portfolio_id", portfolioId)
            .eq("symbol", decodedSymbol)
            .maybeSingle()
        : Promise.resolve({ data: null }),
      supabase
        .from("price_alerts")
        .select(
          "id, symbol, condition, trigger_price, status, created_at, triggered_at, triggered_price",
        )
        .eq("user_id", user.id)
        .eq("symbol", decodedSymbol)
        .neq("status", "cancelled")
        .order("created_at", { ascending: false }),
    ]);

  const fmt = stock.currency === "KRW" ? KRW : USD;
  const symbolName = stock.name_ko ?? stock.name;

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-xs text-muted-foreground flex items-center gap-2">
            <span>{stock.symbol} · {stock.market}</span>
            {stock.currency === "KRW" && <KrSessionBadge />}
          </div>
          <h1 className="text-2xl font-bold">{symbolName}</h1>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href={`/app/compare?a=${encodeURIComponent(stock.symbol)}`}
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-primary border rounded-md px-2 py-1"
            title="다른 종목과 비교"
          >
            <GitCompare className="h-3 w-3" />
            비교
          </Link>
          <WatchlistButton symbol={stock.symbol} initialWatched={!!watch} />
        </div>
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
          <div className="mt-2">
            <NxtSpreadBadge
              market={stock.market}
              lastPrice={stock.last_price ? Number(stock.last_price) : null}
              marketCap={stock.market_cap ? Number(stock.market_cap) : null}
            />
          </div>
          <div className="mt-2">
            <StockThemes symbol={stock.symbol} />
          </div>
          <div className="mt-2">
            <Suspense
              fallback={
                <div className="text-xs text-muted-foreground">분석 로딩…</div>
              }
            >
              <StockRatingBadge symbol={stock.symbol} />
            </Suspense>
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
              market={stock.market}
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

      {stock.market.startsWith("KRX_") && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">호가창</CardTitle>
          </CardHeader>
          <CardContent>
            <OrderBook
              market={stock.market}
              lastPrice={stock.last_price ? Number(stock.last_price) : null}
              marketCap={stock.market_cap ? Number(stock.market_cap) : null}
            />
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">가격 알림</CardTitle>
        </CardHeader>
        <CardContent>
          <PriceAlertForm
            symbol={stock.symbol}
            currentPrice={stock.last_price ? Number(stock.last_price) : null}
            currency={stock.currency}
            initialAlerts={alerts ?? []}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">기본 정보</CardTitle>
        </CardHeader>
        <CardContent className="text-sm">
          <div className="grid grid-cols-2 gap-x-4 gap-y-2">
            <InfoRow
              labelNode={<Term k="sector">섹터</Term>}
              value={stock.sector}
            />
            <InfoRow
              labelNode={<Term k="market-cap">시가총액</Term>}
              value={
                stock.market_cap
                  ? formatMarketCap(Number(stock.market_cap), stock.currency)
                  : null
              }
            />
            <InfoRow
              labelNode={
                <>
                  <Term k="per">PER</Term> (주가수익비율)
                </>
              }
              value={stock.per ? Number(stock.per).toFixed(2) : null}
              hint={
                stock.per && stock.last_price
                  ? `EPS ≈ ${fmt.format(Number(stock.last_price) / Number(stock.per))}`
                  : undefined
              }
            />
            <InfoRow
              labelNode={<Term k="52w-high">52주 최고</Term>}
              value={
                stock.fifty_two_week_high
                  ? fmt.format(Number(stock.fifty_two_week_high))
                  : null
              }
              hint={
                stock.fifty_two_week_high && stock.last_price
                  ? `현재 대비 ${(
                      ((Number(stock.last_price) - Number(stock.fifty_two_week_high)) /
                        Number(stock.fifty_two_week_high)) *
                      100
                    ).toFixed(1)}%`
                  : undefined
              }
            />
            <InfoRow
              labelNode={<Term k="52w-low">52주 최저</Term>}
              value={
                stock.fifty_two_week_low
                  ? fmt.format(Number(stock.fifty_two_week_low))
                  : null
              }
              hint={
                stock.fifty_two_week_low && stock.last_price
                  ? `현재 대비 +${(
                      ((Number(stock.last_price) - Number(stock.fifty_two_week_low)) /
                        Number(stock.fifty_two_week_low)) *
                      100
                    ).toFixed(1)}%`
                  : undefined
              }
            />
            <InfoRow
              label="52주 범위 내 위치"
              value={
                stock.fifty_two_week_high &&
                stock.fifty_two_week_low &&
                stock.last_price &&
                Number(stock.fifty_two_week_high) > Number(stock.fifty_two_week_low)
                  ? `${(
                      ((Number(stock.last_price) - Number(stock.fifty_two_week_low)) /
                        (Number(stock.fifty_two_week_high) -
                          Number(stock.fifty_two_week_low))) *
                      100
                    ).toFixed(0)}%`
                  : null
              }
              hint="0% = 52w 저점, 100% = 52w 고점"
            />
            <InfoRow
              label="시장"
              value={
                stock.market === "KRX_KS"
                  ? "KOSPI"
                  : stock.market === "KRX_KQ"
                    ? "KOSDAQ"
                    : stock.market
              }
            />
            <InfoRow
              label="통화"
              value={stock.currency}
            />
          </div>
          {(!stock.sector || !stock.per || !stock.fifty_two_week_high) && (
            <div className="text-[10px] text-muted-foreground mt-3 pt-2 border-t">
              ⚠️ 일부 데이터 미수집 — 매일 05:30 KST에 yfinance에서 갱신 (관리자 트리거 가능: POST `/api/admin/enrich-stocks`)
            </div>
          )}
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

function InfoRow({
  label,
  labelNode,
  value,
  hint,
}: {
  label?: string;
  labelNode?: React.ReactNode;
  value: string | null | undefined;
  hint?: string;
}) {
  return (
    <div>
      <div className="text-xs text-muted-foreground">{labelNode ?? label}</div>
      <div
        className={`font-medium tabular-nums ${value ? "" : "text-muted-foreground"}`}
      >
        {value ?? "—"}
      </div>
      {hint && value && (
        <div className="text-[10px] text-muted-foreground mt-0.5">{hint}</div>
      )}
    </div>
  );
}

function formatMarketCap(cap: number, currency: string): string {
  if (currency === "KRW") {
    if (cap >= 1e12) return `${(cap / 1e12).toFixed(1)}조원`;
    if (cap >= 1e8) return `${(cap / 1e8).toFixed(0)}억원`;
    return KRW.format(cap);
  }
  if (cap >= 1e12) return `$${(cap / 1e12).toFixed(2)}T`;
  if (cap >= 1e9) return `$${(cap / 1e9).toFixed(2)}B`;
  if (cap >= 1e6) return `$${(cap / 1e6).toFixed(1)}M`;
  return USD.format(cap);
}
