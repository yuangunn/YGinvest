// Plan #45: 큐레이션 — YG 디자인 wrapping.

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
import { getCurrentUser } from "@/lib/supabase/user";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/yg/page-header";
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
  const user = await getCurrentUser();
  if (!user) redirect("/auth/login");

  // Top 1500 by market_cap 만 — 시총 작은 종목은 데이터 부실 확률 ↑ + 페이지 무거워짐
  // PER이 있는 종목이 558개라 1500개 한도면 충분히 cover
  const all: StockRow[] = [];
  for (let offset = 0; offset < 1500; offset += 1000) {
    const { data } = await supabase
      .from("stocks")
      .select(
        "symbol, name, name_ko, market, currency, sector, last_price, per, market_cap, fifty_two_week_high, fifty_two_week_low",
      )
      .eq("is_active", true)
      .order("market_cap", { ascending: false, nullsFirst: false })
      .range(offset, Math.min(offset + 999, 1499));
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

  // Strong Buy / Buy (upside 5%+) — raw upside로 정렬 (capped는 동일값 많음)
  const strongBuys = valued
    .filter((x) => x.v.rating === "strong_buy")
    .sort((a, b) => (b.v.upsidePctRaw ?? 0) - (a.v.upsidePctRaw ?? 0))
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
    .sort((a, b) => (b.v.upsidePctRaw ?? 0) - (a.v.upsidePctRaw ?? 0))
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

  // 진단: 왜 빈 결과가 나오는지 사용자에게 명확히 알리기
  const totalActive = all.length;
  const withSector = all.filter((s) => s.sector).length;
  const withPer = all.filter((s) => s.per && Number(s.per) > 0).length;
  const valuedCount = valued.length;

  return (
    <div style={{ paddingBottom: 24 }}>
      <PageHeader
        title="큐레이션"
        sub="Sector-relative PER · Strong Buy ↔ Sell"
        right={<Sparkles className="h-5 w-5" style={{ color: "var(--yg-fg-secondary)" }} />}
      />
      <div style={{ padding: "8px 20px 0", display: "flex", flexDirection: "column", gap: 12 }}>

      {valuedCount === 0 && (
        <Card className="border-yellow-500/40 bg-yellow-500/5">
          <CardHeader>
            <CardTitle className="text-base text-yellow-600 dark:text-yellow-500">
              ⚠️ 분석 가능한 종목 없음
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              현재 {totalActive}개 종목 중 분석에 필요한 데이터가 갖춰진 종목이 없습니다.
            </p>
            <div className="grid grid-cols-3 gap-2 mt-3 text-xs">
              <div className="rounded bg-background p-2">
                <div className="text-muted-foreground">전체 종목</div>
                <div className="font-bold text-base">{totalActive}</div>
              </div>
              <div className="rounded bg-background p-2">
                <div className="text-muted-foreground">섹터 있음</div>
                <div className="font-bold text-base">{withSector}</div>
              </div>
              <div className="rounded bg-background p-2">
                <div className="text-muted-foreground">PER 있음</div>
                <div className="font-bold text-base">{withPer}</div>
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-3">
              데이터 수집은 매일 05:30 KST에 yfinance에서 자동 갱신됩니다. 즉시 갱신하려면
              관리자가 <code className="font-mono">POST /api/admin/enrich-stocks</code> 호출 가능.
            </p>
          </CardContent>
        </Card>
      )}

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

        <div
          style={{
            fontSize: 11,
            color: "var(--yg-fg-tertiary)",
            fontWeight: 600,
            paddingTop: 12,
            borderTop: "1px solid var(--yg-line-faint)",
            marginTop: 8,
          }}
        >
          ⚠️ Sector-relative PER 기반 자동 분석. 종합 판단하세요. 시뮬레이션 추천이며 금융 자문 아님.
        </div>
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
