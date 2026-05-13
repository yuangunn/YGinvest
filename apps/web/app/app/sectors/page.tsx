import Link from "next/link";
import { redirect } from "next/navigation";
import { BarChart3 } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Term } from "@/components/term";

type StockRow = {
  symbol: string;
  market: string;
  sector: string | null;
  market_cap: number | null;
};

type BarRow = {
  symbol: string;
  ts: string;
  close: number;
};

function scope(market: string): "KR" | "US" | null {
  if (market.startsWith("KRX_")) return "KR";
  if (market === "NYSE" || market === "NASDAQ") return "US";
  return null;
}

function heatClass(ret: number): string {
  // ret ∈ [-0.05, 0.05] 정도 가정
  if (ret >= 0.05) return "bg-green-600 text-white";
  if (ret >= 0.03) return "bg-green-500 text-white";
  if (ret >= 0.01) return "bg-green-400/70 text-white";
  if (ret >= 0.003) return "bg-green-300/50 text-foreground";
  if (ret >= -0.003) return "bg-muted text-foreground";
  if (ret >= -0.01) return "bg-red-300/50 text-foreground";
  if (ret >= -0.03) return "bg-red-400/70 text-white";
  if (ret >= -0.05) return "bg-red-500 text-white";
  return "bg-red-600 text-white";
}

export default async function SectorsHeatmapPage({
  searchParams,
}: {
  searchParams: Promise<{ scope?: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const params = await searchParams;
  const view: "KR" | "US" = params.scope === "US" ? "US" : "KR";
  const markets =
    view === "KR" ? ["KRX_KS", "KRX_KQ"] : ["NYSE", "NASDAQ"];

  // 모든 active stocks 가져오기 (paginated)
  const allStocks: StockRow[] = [];
  for (let offset = 0; ; offset += 1000) {
    const { data } = await supabase
      .from("stocks")
      .select("symbol, market, sector, market_cap")
      .eq("is_active", true)
      .not("sector", "is", null)
      .in("market", markets)
      .range(offset, offset + 999);
    if (!data || data.length === 0) break;
    allStocks.push(...(data as StockRow[]));
    if (data.length < 1000) break;
  }

  // 최근 2 일봉 fetch (pagination)
  const symbols = allStocks.map((s) => s.symbol);
  const closesBySymbol = new Map<string, number[]>();
  for (let offset = 0; ; offset += 1000) {
    const { data: bars } = await supabase
      .from("stock_bars")
      .select("symbol, ts, close")
      .in("symbol", symbols.slice(0, Math.min(symbols.length, 1500))) // PostgREST IN limit
      .eq("interval", "1d")
      .order("ts", { ascending: false })
      .range(offset, offset + 999);
    if (!bars || bars.length === 0) break;
    for (const b of bars as BarRow[]) {
      const arr = closesBySymbol.get(b.symbol) ?? [];
      if (arr.length < 2) {
        arr.push(b.close);
        closesBySymbol.set(b.symbol, arr);
      }
    }
    if (bars.length < 1000) break;
  }

  // sector별 weighted average return (by market cap)
  type Agg = { totalMcap: number; weightedRet: number; count: number };
  const agg = new Map<string, Agg>();
  for (const s of allStocks) {
    if (!s.sector || scope(s.market) !== view) continue;
    const closes = closesBySymbol.get(s.symbol);
    if (!closes || closes.length < 2 || closes[1] === 0) continue;
    const ret = (closes[0] - closes[1]) / closes[1];
    const mcap = s.market_cap ? Number(s.market_cap) : 1;
    const slot = agg.get(s.sector) ?? { totalMcap: 0, weightedRet: 0, count: 0 };
    slot.totalMcap += mcap;
    slot.weightedRet += ret * mcap;
    slot.count += 1;
    agg.set(s.sector, slot);
  }

  const heat = [...agg.entries()]
    .map(([sector, a]) => ({
      sector,
      ret: a.totalMcap > 0 ? a.weightedRet / a.totalMcap : 0,
      count: a.count,
    }))
    .filter((x) => x.count >= 2)
    .sort((a, b) => b.ret - a.ret);

  return (
    <div className="max-w-3xl mx-auto p-4 space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-primary" />
            <Term k="sector">섹터</Term> Heatmap
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            오늘 종가 vs 어제 종가 시가총액 가중 평균 등락률
          </p>
        </div>
        <div className="flex gap-1">
          <Link
            href="/app/sectors?scope=KR"
            className={`text-xs rounded-md border px-2.5 py-1.5 ${view === "KR" ? "bg-primary text-primary-foreground" : "hover:bg-muted/30"}`}
          >
            KR
          </Link>
          <Link
            href="/app/sectors?scope=US"
            className={`text-xs rounded-md border px-2.5 py-1.5 ${view === "US" ? "bg-primary text-primary-foreground" : "hover:bg-muted/30"}`}
          >
            US
          </Link>
        </div>
      </div>

      {heat.length === 0 ? (
        <Card>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              일봉 데이터가 부족합니다 (어제/오늘 종가 필요).
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">섹터별 등락 ({heat.length}개)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
              {heat.map((h) => (
                <Link
                  key={h.sector}
                  href={`/app/sectors/${encodeURIComponent(h.sector)}?scope=${view}`}
                  className={`block rounded-lg p-3 text-center lift ${heatClass(h.ret)}`}
                >
                  <div className="text-xs font-medium truncate">{h.sector}</div>
                  <div className="text-base font-bold mt-1 tabular-nums">
                    {h.ret >= 0 ? "+" : ""}
                    {(h.ret * 100).toFixed(2)}%
                  </div>
                  <div className="text-[10px] opacity-75 mt-1">
                    {h.count}개 종목
                  </div>
                </Link>
              ))}
            </div>
            <p className="text-xs text-muted-foreground mt-4 text-center">
              ⬛ 색이 진할수록 큰 등락. 클릭 시 해당 섹터 종목 리스트로.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
