import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ChevronLeft, Sparkles, Target, Activity } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/supabase/user";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Suspense } from "react";
import { StockFinancials } from "@/components/stock-financials";
import { loadSectorStats, getSectorStats } from "@/lib/sector-stats";
import { formatMarketCap } from "@/lib/format";
import {
  computeValuation,
  marketScope,
  RATING_COLOR,
  RATING_LABEL,
  type Rating,
} from "@/lib/valuation";
import { AiAnalysisButton } from "@/components/ai-analysis-button";
import type { Provider } from "@/lib/ai-providers";

const KRW = new Intl.NumberFormat("ko-KR", {
  style: "currency",
  currency: "KRW",
  maximumFractionDigits: 0,
});
const USD = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

export default async function StockAnalysisPage({
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
    .select(
      "symbol, name, name_ko, sector, market, currency, last_price, per, market_cap, fifty_two_week_high, fifty_two_week_low",
    )
    .eq("symbol", decodedSymbol)
    .single();
  if (!stock) notFound();

  const scope = marketScope(stock.market);
  const sectorStats = await loadSectorStats(supabase);
  const myStats =
    stock.sector && scope ? getSectorStats(sectorStats, stock.sector, scope) : null;

  const valuation = computeValuation(
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
    myStats,
  );

  const fmt = stock.currency === "KRW" ? KRW : USD;
  const symbolName = stock.name_ko ?? stock.name;
  const ratingClass = RATING_COLOR[valuation.rating as Rating];

  // Peers — 같은 sector + scope의 다른 종목들 (시총 상위 5)
  let peers: {
    symbol: string;
    name: string;
    name_ko: string | null;
    last_price: number | null;
    per: number | null;
    market_cap: number | null;
  }[] = [];
  if (stock.sector && scope) {
    const marketFilter =
      scope === "KR" ? ["KRX_KS", "KRX_KQ"] : ["NYSE", "NASDAQ"];
    const { data: peerData } = await supabase
      .from("stocks")
      .select("symbol, name, name_ko, last_price, per, market_cap")
      .eq("sector", stock.sector)
      .in("market", marketFilter)
      .neq("symbol", stock.symbol)
      .order("market_cap", { ascending: false, nullsFirst: false })
      .limit(5);
    peers = peerData ?? [];
  }

  // 사용자가 등록한 AI provider 목록
  const { data: aiKeys } = await supabase
    .from("user_ai_keys")
    .select("provider")
    .eq("user_id", user.id);
  const registeredProviders = ((aiKeys as { provider: string }[] | null) ?? []).map(
    (k) => k.provider as Provider,
  );

  return (
    <div className="max-w-3xl mx-auto p-4 space-y-4">
      <div className="text-xs text-muted-foreground">
        <Link
          href={`/app/trade/${encodeURIComponent(decodedSymbol)}`}
          className="hover:underline inline-flex items-center gap-0.5"
        >
          <ChevronLeft className="h-3 w-3" />
          {symbolName}로 돌아가기
        </Link>
      </div>

      <div className="flex items-start justify-between gap-2">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            {symbolName} 큐레이션
          </h1>
          <p className="text-xs text-muted-foreground mt-1">
            {stock.symbol} · {stock.market} · {stock.sector ?? "—"}
          </p>
        </div>
        <span
          className={`inline-flex items-center rounded-md border px-2.5 py-1 text-sm font-bold ${ratingClass}`}
        >
          {RATING_LABEL[valuation.rating as Rating]}
        </span>
      </div>

      {/* Top-line summary */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Target className="h-4 w-4 text-primary" />
            적정 주가 / 목표가
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!valuation.hasData ? (
            <p className="text-sm text-muted-foreground">
              분석 불가 — {valuation.reason}
            </p>
          ) : (
            <div className="space-y-3">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <Metric
                  label="현재가"
                  value={fmt.format(valuation.currentPrice!)}
                  primary
                />
                <Metric
                  label="적정 주가"
                  value={fmt.format(valuation.fairValuePe!)}
                  hint={`섹터 PER × EPS`}
                />
                <Metric
                  label="목표 주가"
                  value={fmt.format(valuation.targetPrice!)}
                  hint={`성장 프리미엄 ×${valuation.growthPremium!.toFixed(2)}`}
                />
                <Metric
                  label="기대 수익률"
                  value={`${valuation.upsidePct! >= 0 ? "+" : ""}${(valuation.upsidePct! * 100).toFixed(1)}%`}
                  tone={
                    valuation.upsidePct! >= 0.05
                      ? "up"
                      : valuation.upsidePct! <= -0.05
                        ? "down"
                        : undefined
                  }
                />
              </div>
              <div className="flex flex-wrap gap-1.5 pt-1">
                {valuation.factors.map((f, i) => (
                  <span
                    key={i}
                    className="text-[10px] rounded-full bg-muted px-2 py-0.5 text-muted-foreground"
                  >
                    {f}
                  </span>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 기업가치 분석 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Activity className="h-4 w-4 text-primary" />
            기업가치 분석 (PER 기반)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
            <Metric
              label="현재 PER"
              value={
                stock.per ? Number(stock.per).toFixed(2) : "—"
              }
            />
            <Metric
              label={`${stock.sector ?? "섹터"} 중간 PER`}
              value={
                valuation.sectorMedianPer
                  ? valuation.sectorMedianPer.toFixed(2)
                  : "—"
              }
              hint={
                valuation.sectorPeerCount
                  ? `${valuation.sectorPeerCount}개 종목 기준`
                  : undefined
              }
            />
            <Metric
              label="EPS (도출값)"
              value={valuation.eps ? fmt.format(valuation.eps) : "—"}
              hint="현재가 ÷ PER"
            />
            <Metric
              label="시가총액"
              value={
                stock.market_cap
                  ? formatMarketCap(Number(stock.market_cap), stock.currency)
                  : "—"
              }
            />
          </div>
        </CardContent>
      </Card>

      {/* AI 분석 (BYOK) */}
      <AiAnalysisButton
        symbol={stock.symbol}
        registeredProviders={registeredProviders}
      />

      {/* 재무제표 (worker RPC 활용) */}
      <Suspense
        fallback={
          <Card>
            <CardHeader>
              <CardTitle className="text-base">재무 지표</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">로딩 중...</p>
            </CardContent>
          </Card>
        }
      >
        <StockFinancials symbol={stock.symbol} />
      </Suspense>

      {/* Peers */}
      {peers.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">동종 종목 (Peer Group)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-1">
              {peers.map((p) => (
                <Link
                  key={p.symbol}
                  href={`/app/trade/${encodeURIComponent(p.symbol)}`}
                  className="flex items-center justify-between gap-2 rounded p-1.5 hover:bg-muted/30 text-sm"
                >
                  <span className="truncate">{p.name_ko ?? p.name}</span>
                  <span className="text-xs text-muted-foreground flex-shrink-0">
                    PER {p.per ? Number(p.per).toFixed(1) : "—"} ·{" "}
                    {p.last_price ? fmt.format(Number(p.last_price)) : "—"}
                  </span>
                </Link>
              ))}
            </div>
            {stock.sector && (
              <Link
                href={`/app/sectors/${encodeURIComponent(stock.sector)}`}
                className="text-xs text-primary hover:underline mt-2 inline-block"
              >
                전체 {stock.sector} 종목 보기 →
              </Link>
            )}
          </CardContent>
        </Card>
      )}

      <div className="text-xs text-muted-foreground border-t pt-3">
        <p>
          ⚠️ 이 분석은 sector-relative PER 기반 rule-based 알고리즘입니다. 실제 투자에는
          재무제표, 산업 동향, 거시 환경을 종합 판단하세요. 매수/매도 추천은 시뮬레이션 용도일 뿐
          금융 자문이 아닙니다.
        </p>
      </div>
    </div>
  );
}

function Metric({
  label,
  value,
  hint,
  primary,
  tone,
}: {
  label: string;
  value: string;
  hint?: string;
  primary?: boolean;
  tone?: "up" | "down";
}) {
  return (
    <div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div
        className={`font-mono ${
          primary ? "text-base font-bold" : "text-sm"
        } ${tone === "up" ? "text-green-500" : tone === "down" ? "text-red-500" : ""}`}
      >
        {value}
      </div>
      {hint && (
        <div className="text-[10px] text-muted-foreground mt-0.5">{hint}</div>
      )}
    </div>
  );
}
