import { Suspense } from "react";
import { redirect, notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ChartArea } from "@/components/chart-area";
import { StockNews } from "@/components/stock-news";
import { StockFinancials } from "@/components/stock-financials";
import Link from "next/link";
import { GitCompare } from "lucide-react";
import { YGPriceCard } from "@/components/trade/yg-price-card";
import { YGTradeButtons } from "@/components/trade/yg-trade-buttons";
import { YGChartCard } from "@/components/trade/yg-chart-card";
import { YGSectionCard } from "@/components/yg/section-card";
import { WatchlistButton } from "@/components/watchlist-button";
import { KrSessionBadge } from "@/components/kr-session-badge";
import { NxtSpreadBadge } from "@/components/nxt-spread-badge";
import { Term } from "@/components/term";
import { OrderBook } from "@/components/order-book";
import { PriceAlertForm } from "@/components/price-alert-form";
import { RecentTracker } from "@/components/recent-tracker";
import { TradeNotes } from "@/components/trade-notes";
import { EtfInfoCard } from "@/components/etf-info-card";
import { EtfHoldingsList } from "@/components/etf-holdings-list";
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
  const [{ data: portfolio }, { data: bars }, { data: watch }, { data: alerts }, { data: holding }] =
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
      // Plan #31: 매수/매도 UI에 현재 보유 수량 + 평단가 표시
      portfolioId
        ? supabase
            .from("holdings")
            .select("quantity, avg_cost")
            .eq("portfolio_id", portfolioId)
            .eq("symbol", decodedSymbol)
            .maybeSingle()
        : Promise.resolve({ data: null }),
    ]);

  const symbolName = stock.name_ko ?? stock.name;
  // 기본 정보 카드의 fmt 헬퍼 (KRW vs USD)
  const fmt = stock.currency === "KRW" ? KRW : USD;

  return (
    <div style={{ paddingBottom: 16 }}>
      <RecentTracker symbol={stock.symbol} name={symbolName} />

      {/* Plan #44: YG 헤더 — Toss 스타일 (큰 종목명 + ticker + market) */}
      <div
        style={{
          padding: "16px 20px 12px",
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: 10,
        }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              marginBottom: 4,
            }}
          >
            <span
              className="yg-num"
              style={{
                fontSize: 12,
                fontWeight: 700,
                color: "var(--yg-fg-tertiary)",
              }}
            >
              {stock.symbol}
            </span>
            <span
              style={{
                fontSize: 11,
                fontWeight: 700,
                color: "var(--yg-fg-tertiary)",
              }}
            >
              · {stock.market}
            </span>
            {stock.currency === "KRW" && <KrSessionBadge />}
            <NxtSpreadBadge
              market={stock.market}
              lastPrice={stock.last_price ? Number(stock.last_price) : null}
              marketCap={stock.market_cap ? Number(stock.market_cap) : null}
            />
          </div>
          <h1
            style={{
              fontSize: 22,
              fontWeight: 800,
              letterSpacing: "-0.025em",
              margin: 0,
              color: "var(--yg-fg-primary)",
            }}
          >
            {symbolName}
          </h1>
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            flexShrink: 0,
          }}
        >
          <Link
            href={`/app/compare?a=${encodeURIComponent(stock.symbol)}`}
            title="다른 종목과 비교"
            style={{
              padding: "6px 10px",
              borderRadius: 99,
              fontSize: 12,
              fontWeight: 700,
              background: "var(--yg-bg-tint-ink)",
              color: "var(--yg-fg-secondary)",
              textDecoration: "none",
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
            }}
          >
            <GitCompare className="h-3 w-3" />
            비교
          </Link>
          <WatchlistButton symbol={stock.symbol} initialWatched={!!watch} />
        </div>
      </div>

      {/* Plan #44: YG 가격 hero */}
      <YGPriceCard
        lastPrice={stock.last_price ? Number(stock.last_price) : null}
        currency={stock.currency}
        lastPriceAt={stock.last_price_at}
        market={stock.market}
        fiftyTwoWeekHigh={
          stock.fifty_two_week_high ? Number(stock.fifty_two_week_high) : null
        }
        fiftyTwoWeekLow={
          stock.fifty_two_week_low ? Number(stock.fifty_two_week_low) : null
        }
        symbol={stock.symbol}
        isEtf={stock.instrument_type === "etf"}
      />

      {/* Plan #45: YG 차트 카드 — 일관된 margin 0 20px */}
      <YGChartCard
        symbol={stock.symbol}
        initialBars={(bars ?? []).map((b) => ({ ...b, ts: String(b.ts) }))}
      />

      {/* Plan #44: YG 매수/매도 카드 (잔고+보유+평단+버튼) */}
      {portfolio && (
        <YGTradeButtons
          portfolioId={portfolio.id}
          symbol={stock.symbol}
          symbolName={symbolName}
          currency={stock.currency}
          market={stock.market}
          lastPrice={stock.last_price ? Number(stock.last_price) : null}
          cashBalance={
            stock.currency === "KRW"
              ? Number(portfolio.krw_balance ?? 0)
              : Number(portfolio.usd_balance ?? 0)
          }
          currentQty={holding ? Number(holding.quantity) : 0}
          avgCost={holding ? Number(holding.avg_cost) : null}
        />
      )}

      {/* Plan #32: ETF 메타 정보 + 구성 종목 */}
      {stock.instrument_type === "etf" && (
        <>
          <div style={{ margin: "12px 20px 0" }}>
            <EtfInfoCard
              category={stock.etf_category ?? null}
              fundFamily={stock.fund_family ?? null}
              underlyingIndex={stock.underlying_index ?? null}
              expenseRatio={
                stock.expense_ratio ? Number(stock.expense_ratio) : null
              }
              aum={stock.aum ? Number(stock.aum) : null}
              inceptionDate={stock.inception_date ?? null}
              currency={stock.currency}
            />
          </div>
          <div style={{ margin: "12px 20px 0" }}>
            <Suspense
              fallback={
                <div
                  className="yg-card"
                  style={{
                    padding: 18,
                    fontSize: 13,
                    color: "var(--yg-fg-tertiary)",
                  }}
                >
                  구성 종목 로딩…
                </div>
              }
            >
              <EtfHoldingsList etfSymbol={stock.symbol} />
            </Suspense>
          </div>
        </>
      )}

      {stock.market.startsWith("KRX_") && (
        <YGSectionCard title="호가창">
          <OrderBook
            market={stock.market}
            lastPrice={stock.last_price ? Number(stock.last_price) : null}
            marketCap={stock.market_cap ? Number(stock.market_cap) : null}
          />
        </YGSectionCard>
      )}

      <YGSectionCard title="가격 알림">
        <PriceAlertForm
          symbol={stock.symbol}
          currentPrice={stock.last_price ? Number(stock.last_price) : null}
          currency={stock.currency}
          initialAlerts={alerts ?? []}
        />
      </YGSectionCard>

      <div style={{ margin: "12px 20px 0" }}>
        <TradeNotes symbol={stock.symbol} />
      </div>

      <YGSectionCard title="종목 정보">
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            rowGap: 10,
            columnGap: 16,
          }}
        >
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
                <Term k="per">PER</Term>
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
                    ((Number(stock.last_price) -
                      Number(stock.fifty_two_week_high)) /
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
                    ((Number(stock.last_price) -
                      Number(stock.fifty_two_week_low)) /
                      Number(stock.fifty_two_week_low)) *
                    100
                  ).toFixed(1)}%`
                : undefined
            }
          />
          <InfoRow
            label="52주 위치"
            value={
              stock.fifty_two_week_high &&
              stock.fifty_two_week_low &&
              stock.last_price &&
              Number(stock.fifty_two_week_high) >
                Number(stock.fifty_two_week_low)
                ? `${(
                    ((Number(stock.last_price) -
                      Number(stock.fifty_two_week_low)) /
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
          <InfoRow label="통화" value={stock.currency} />
        </div>
        {(!stock.sector || !stock.per || !stock.fifty_two_week_high) && (
          <div
            style={{
              fontSize: 10,
              color: "var(--yg-fg-tertiary)",
              marginTop: 12,
              paddingTop: 8,
              borderTop: "1px solid var(--yg-line-faint)",
            }}
          >
            ⚠️ 일부 데이터 미수집 — 매일 05:30 KST에 yfinance에서 갱신
          </div>
        )}
      </YGSectionCard>

      {/* Plan #32: ETF는 단일 종목 재무지표가 의미 없음 — skip */}
      {stock.instrument_type !== "etf" && (
        <YGSectionCard title="재무 지표">
          <StockFinancials symbol={stock.symbol} />
        </YGSectionCard>
      )}

      <YGSectionCard title="뉴스">
        <StockNews symbol={stock.symbol} />
      </YGSectionCard>

      <div style={{ height: 24 }} />
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
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        borderBottom: "1px solid var(--yg-line-faint)",
        paddingBottom: 8,
        alignItems: "flex-start",
        gap: 8,
      }}
    >
      <span
        style={{
          fontSize: 12,
          color: "var(--yg-fg-tertiary)",
          fontWeight: 700,
        }}
      >
        {labelNode ?? label}
      </span>
      <div style={{ textAlign: "right" }}>
        <div
          className="yg-num"
          style={{
            fontSize: 13,
            fontWeight: 800,
            color: value ? "var(--yg-fg-primary)" : "var(--yg-fg-tertiary)",
          }}
        >
          {value ?? "—"}
        </div>
        {hint && value && (
          <div
            style={{
              fontSize: 10,
              color: "var(--yg-fg-tertiary)",
              marginTop: 2,
            }}
          >
            {hint}
          </div>
        )}
      </div>
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
