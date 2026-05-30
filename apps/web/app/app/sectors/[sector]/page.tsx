import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ChevronLeft, BarChart3 } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/supabase/user";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { loadSectorStats, getSectorStats } from "@/lib/sector-stats";

const KRW = new Intl.NumberFormat("ko-KR", {
  style: "currency",
  currency: "KRW",
  maximumFractionDigits: 0,
});
const USD = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

type Stock = {
  symbol: string;
  name: string;
  name_ko: string | null;
  market: string;
  currency: string;
  last_price: number | null;
  per: number | null;
  market_cap: number | null;
};

export default async function SectorDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ sector: string }>;
  searchParams: Promise<{ scope?: string }>;
}) {
  const { sector: sectorRaw } = await params;
  const { scope: scopeRaw } = await searchParams;
  const sector = decodeURIComponent(sectorRaw);
  const scope: "KR" | "US" = scopeRaw === "US" ? "US" : "KR";

  const supabase = await createClient();
  const user = await getCurrentUser();
  if (!user) redirect("/auth/login");

  const marketFilter =
    scope === "KR" ? ["KRX_KS", "KRX_KQ"] : ["NYSE", "NASDAQ"];

  // pagination — sector에 수십 개 가능
  const all: Stock[] = [];
  for (let offset = 0; ; offset += 1000) {
    const { data } = await supabase
      .from("stocks")
      .select(
        "symbol, name, name_ko, market, currency, last_price, per, market_cap",
      )
      .eq("sector", sector)
      .in("market", marketFilter)
      .order("market_cap", { ascending: false, nullsFirst: false })
      .range(offset, offset + 999);
    if (!data || data.length === 0) break;
    all.push(...(data as Stock[]));
    if (data.length < 1000) break;
  }

  if (all.length === 0) notFound();

  const sectorStats = await loadSectorStats(supabase);
  const stats = getSectorStats(sectorStats, sector, scope);

  // Top by lowest PE (positive), Top by 시총
  const validPe = all.filter(
    (s) => s.per !== null && Number(s.per) > 0,
  );
  const lowestPer = [...validPe]
    .sort((a, b) => Number(a.per) - Number(b.per))
    .slice(0, 5);
  const topMcap = all
    .filter((s) => s.market_cap)
    .slice(0, 5);

  const fmt = scope === "KR" ? KRW : USD;

  return (
    <div className="max-w-3xl mx-auto p-4 space-y-4">
      <div className="text-xs text-muted-foreground">
        <Link
          href="/app/curation"
          className="hover:underline inline-flex items-center gap-0.5"
        >
          <ChevronLeft className="h-3 w-3" />
          큐레이션
        </Link>
      </div>

      <div className="flex items-start justify-between gap-2 flex-wrap">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-primary" />
            {sector}
          </h1>
          <p className="text-xs text-muted-foreground mt-1">
            {scope === "KR" ? "KOSPI/KOSDAQ" : "NYSE/NASDAQ"} · {all.length}개 종목
          </p>
        </div>
        <div className="flex gap-1">
          <Link
            href={`/app/sectors/${encodeURIComponent(sector)}?scope=KR`}
            className={`text-xs rounded-md border px-2 py-1 ${scope === "KR" ? "bg-primary text-primary-foreground" : "hover:bg-muted/30"}`}
          >
            KR
          </Link>
          <Link
            href={`/app/sectors/${encodeURIComponent(sector)}?scope=US`}
            className={`text-xs rounded-md border px-2 py-1 ${scope === "US" ? "bg-primary text-primary-foreground" : "hover:bg-muted/30"}`}
          >
            US
          </Link>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">섹터 통계</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-3 text-sm">
            <Metric label="구성 종목" value={`${all.length}개`} />
            <Metric
              label="중간 PER"
              value={stats?.medianPer ? stats.medianPer.toFixed(2) : "—"}
              hint={stats ? `${stats.count}개 (양수 PER만)` : undefined}
            />
            <Metric label="평균 PER 적용 분석 종목" value={`${validPe.length}개`} />
          </div>
        </CardContent>
      </Card>

      {topMcap.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">시가총액 상위 5</CardTitle>
          </CardHeader>
          <CardContent>
            <StockList stocks={topMcap} fmt={fmt} />
          </CardContent>
        </Card>
      )}

      {lowestPer.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">저PER Top 5 (가치주 후보)</CardTitle>
          </CardHeader>
          <CardContent>
            <StockList stocks={lowestPer} fmt={fmt} />
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">전체 종목</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-0.5">
            {all.map((s) => (
              <Link
                key={s.symbol}
                href={`/app/stocks/${encodeURIComponent(s.symbol)}/analysis`}
                className="flex items-center justify-between gap-2 rounded p-1.5 hover:bg-muted/30 text-sm"
              >
                <span className="truncate flex-1">
                  {s.name_ko ?? s.name}{" "}
                  <span className="text-xs text-muted-foreground">{s.symbol}</span>
                </span>
                <span className="text-xs text-muted-foreground flex-shrink-0">
                  PER {s.per ? Number(s.per).toFixed(1) : "—"}
                </span>
                <span className="font-mono text-xs flex-shrink-0 w-20 text-right">
                  {s.last_price ? fmt.format(Number(s.last_price)) : "—"}
                </span>
              </Link>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function StockList({
  stocks,
  fmt,
}: {
  stocks: Stock[];
  fmt: Intl.NumberFormat;
}) {
  return (
    <div className="space-y-0.5">
      {stocks.map((s) => (
        <Link
          key={s.symbol}
          href={`/app/stocks/${encodeURIComponent(s.symbol)}/analysis`}
          className="flex items-center justify-between gap-2 rounded p-1.5 hover:bg-muted/30 text-sm"
        >
          <span className="truncate flex-1">
            {s.name_ko ?? s.name}{" "}
            <span className="text-xs text-muted-foreground">{s.symbol}</span>
          </span>
          <span className="text-xs text-muted-foreground flex-shrink-0">
            PER {s.per ? Number(s.per).toFixed(1) : "—"}
          </span>
          <span className="font-mono text-xs flex-shrink-0 w-20 text-right">
            {s.last_price ? fmt.format(Number(s.last_price)) : "—"}
          </span>
        </Link>
      ))}
    </div>
  );
}

function Metric({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="font-mono text-sm font-semibold">{value}</div>
      {hint && (
        <div className="text-[10px] text-muted-foreground mt-0.5">{hint}</div>
      )}
    </div>
  );
}
