import Link from "next/link";
import { redirect } from "next/navigation";
import {
  Sparkles,
  Award,
  Gem,
  TrendingUp,
  BarChart3,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { loadSectorStats, getSectorStats } from "@/lib/sector-stats";
import {
  computeValuation,
  marketScope,
  RATING_COLOR,
  RATING_LABEL,
  type Rating,
  type Valuation,
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

type StockRow = {
  symbol: string;
  name: string;
  name_ko: string | null;
  market: string;
  currency: string;
  sector: string | null;
  last_price: number | null;
  per: number | null;
  market_cap: number | null;
  fifty_two_week_high: number | null;
  fifty_two_week_low: number | null;
};

export default async function CurationPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  // 모든 active stocks 로드 (pagination)
  const all: StockRow[] = [];
  for (let offset = 0; ; offset += 1000) {
    const { data } = await supabase
      .from("stocks")
      .select(
        "symbol, name, name_ko, market, currency, sector, last_price, per, market_cap, fifty_two_week_high, fifty_two_week_low",
      )
      .eq("is_active", true)
      .range(offset, offset + 999);
    if (!data || data.length === 0) break;
    all.push(...(data as StockRow[]));
    if (data.length < 1000) break;
  }

  const sectorStats = await loadSectorStats(supabase);

  // 모든 종목에 valuation 적용
  const valued = all
    .map((s) => {
      const scope = marketScope(s.market);
      if (!s.sector || !scope) return null;
      const stats = getSectorStats(sectorStats, s.sector, scope);
      const v = computeValuation(
        {
          symbol: s.symbol,
          per: s.per ? Number(s.per) : null,
          last_price: s.last_price ? Number(s.last_price) : null,
          market: s.market,
          sector: s.sector,
          fifty_two_week_high: s.fifty_two_week_high
            ? Number(s.fifty_two_week_high)
            : null,
          fifty_two_week_low: s.fifty_two_week_low
            ? Number(s.fifty_two_week_low)
            : null,
        },
        stats,
      );
      if (!v.hasData) return null;
      return { stock: s, v, scope };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null);

  // Strong Buy / Buy (upside 5%+)
  const strongBuys = valued
    .filter((x) => x.v.rating === "strong_buy")
    .sort((a, b) => (b.v.upsidePct ?? 0) - (a.v.upsidePct ?? 0))
    .slice(0, 10);

  // 저평가 가치주 — PER < sector median × 0.7
  const undervalued = valued
    .filter((x) => x.v.currentPer! < (x.v.sectorMedianPer ?? 999) * 0.7)
    .sort((a, b) => a.v.currentPer! - b.v.currentPer!)
    .slice(0, 10);

  // 모멘텀 — 52w 상단권 (position > 0.7)
  const momentum = valued
    .filter((x) => {
      const high = x.stock.fifty_two_week_high
        ? Number(x.stock.fifty_two_week_high)
        : null;
      const low = x.stock.fifty_two_week_low
        ? Number(x.stock.fifty_two_week_low)
        : null;
      const cur = x.v.currentPrice!;
      if (!high || !low || high <= low) return false;
      const pos = (cur - low) / (high - low);
      return pos > 0.7;
    })
    .sort((a, b) => (b.v.upsidePct ?? 0) - (a.v.upsidePct ?? 0))
    .slice(0, 10);

  // Sector list (top 8 by stock count)
  const sectorMap = new Map<string, { kr: number; us: number }>();
  for (const s of all) {
    if (!s.sector) continue;
    const scope = marketScope(s.market);
    if (!scope) continue;
    const slot = sectorMap.get(s.sector) ?? { kr: 0, us: 0 };
    if (scope === "KR") slot.kr++;
    else slot.us++;
    sectorMap.set(s.sector, slot);
  }
  const topSectors = [...sectorMap.entries()]
    .sort(([, a], [, b]) => b.kr + b.us - (a.kr + a.us))
    .slice(0, 10);

  return (
    <div className="max-w-3xl mx-auto p-4 space-y-4">
      <div>
        <h1 className="text-xl font-bold flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" />
          큐레이션
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Sector-relative PER 기반 rule-based 분석. Strong Buy ↔ Strong Sell rating, 적정 주가
          + 목표주가, 기대 수익률.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Award className="h-4 w-4 text-green-500" />
            Strong Buy ({strongBuys.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {strongBuys.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              현재 Strong Buy 등급 종목 없음
            </p>
          ) : (
            <ValuationList rows={strongBuys} />
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Gem className="h-4 w-4 text-blue-500" />
            저평가 가치주 ({undervalued.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {undervalued.length === 0 ? (
            <p className="text-sm text-muted-foreground">없음</p>
          ) : (
            <ValuationList rows={undervalued} />
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-orange-500" />
            모멘텀 (52주 상단권)
          </CardTitle>
        </CardHeader>
        <CardContent>
          {momentum.length === 0 ? (
            <p className="text-sm text-muted-foreground">없음</p>
          ) : (
            <ValuationList rows={momentum} />
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-primary" />
            업종 둘러보기
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {topSectors.map(([sector, cnt]) => (
              <Link
                key={sector}
                href={`/app/sectors/${encodeURIComponent(sector)}?scope=${cnt.kr >= cnt.us ? "KR" : "US"}`}
                className="rounded-lg border p-2 hover:bg-muted/30 hover:border-primary/40"
              >
                <div className="text-sm font-medium truncate">{sector}</div>
                <div className="text-[10px] text-muted-foreground">
                  KR {cnt.kr} · US {cnt.us}
                </div>
              </Link>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="text-xs text-muted-foreground border-t pt-3">
        <p>
          ⚠️ Sector-relative PER 기반 자동 분석. 모멘텀·재무·뉴스를 종합 판단하세요. 시뮬레이션
          용도의 추천이며 금융 자문 아님.
        </p>
      </div>
    </div>
  );
}

function ValuationList({
  rows,
}: {
  rows: { stock: StockRow; v: Valuation; scope: "KR" | "US" }[];
}) {
  return (
    <div className="space-y-1">
      {rows.map(({ stock, v }) => {
        const fmt = stock.currency === "KRW" ? KRW : USD;
        const name = stock.name_ko ?? stock.name;
        const ratingClass = RATING_COLOR[v.rating as Rating];
        return (
          <Link
            key={stock.symbol}
            href={`/app/stocks/${encodeURIComponent(stock.symbol)}/analysis`}
            className="flex items-center justify-between gap-2 rounded-lg p-2 hover:bg-muted/30 transition-colors"
          >
            <div className="min-w-0 flex-1">
              <div className="text-sm font-medium truncate">{name}</div>
              <div className="text-[10px] text-muted-foreground">
                {stock.symbol} · {stock.sector ?? "—"} · PER{" "}
                {v.currentPer!.toFixed(1)}
              </div>
            </div>
            <div className="text-right flex-shrink-0">
              <div className="font-mono text-sm">
                {fmt.format(v.currentPrice!)}
              </div>
              <div
                className={`text-[10px] ${(v.upsidePct ?? 0) >= 0 ? "text-green-500" : "text-red-500"}`}
              >
                목표 {fmt.format(v.targetPrice!)} (
                {(v.upsidePct! >= 0 ? "+" : "") +
                  (v.upsidePct! * 100).toFixed(1)}
                %)
              </div>
            </div>
            <span
              className={`inline-flex items-center rounded border px-1.5 py-0.5 text-[10px] font-bold flex-shrink-0 ${ratingClass}`}
            >
              {RATING_LABEL[v.rating as Rating]}
            </span>
          </Link>
        );
      })}
    </div>
  );
}
