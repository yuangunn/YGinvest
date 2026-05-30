// Plan #45: 섹터 Heatmap — YG 디자인 (KR convention: red↑ blue↓).

import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/supabase/user";
import { Term } from "@/components/term";
import { PageHeader } from "@/components/yg/page-header";

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

// KR convention: 빨강 = ↑, 파랑 = ↓
function heatStyle(ret: number): {
  background: string;
  color: string;
} {
  if (ret >= 0.05) return { background: "#C7384A", color: "#fff" };
  if (ret >= 0.03) return { background: "#E84B5A", color: "#fff" };
  if (ret >= 0.01) return { background: "#FB7E89", color: "#fff" };
  if (ret >= 0.003) return { background: "#FEEFEF", color: "#C7384A" };
  if (ret >= -0.003)
    return { background: "var(--yg-bg-tint-ink)", color: "var(--yg-fg-secondary)" };
  if (ret >= -0.01) return { background: "#EEF3FE", color: "#1B4FC3" };
  if (ret >= -0.03) return { background: "#6E92F5", color: "#fff" };
  if (ret >= -0.05) return { background: "#2563EB", color: "#fff" };
  return { background: "#1B4FC3", color: "#fff" };
}

export default async function SectorsHeatmapPage({
  searchParams,
}: {
  searchParams: Promise<{ scope?: string }>;
}) {
  const supabase = await createClient();
  const user = await getCurrentUser();
  if (!user) redirect("/auth/login");

  const params = await searchParams;
  const view: "KR" | "US" = params.scope === "US" ? "US" : "KR";
  const markets = view === "KR" ? ["KRX_KS", "KRX_KQ"] : ["NYSE", "NASDAQ"];

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

  const symbols = allStocks.map((s) => s.symbol);
  const closesBySymbol = new Map<string, number[]>();
  const CHUNK = 1000;
  for (let ci = 0; ci < symbols.length; ci += CHUNK) {
    const symChunk = symbols.slice(ci, ci + CHUNK);
    for (let offset = 0; ; offset += 1000) {
      const { data: bars } = await supabase
        .from("stock_bars")
        .select("symbol, ts, close")
        .in("symbol", symChunk)
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
  }

  type Agg = { totalMcap: number; weightedRet: number; count: number };
  const agg = new Map<string, Agg>();
  for (const s of allStocks) {
    if (!s.sector || scope(s.market) !== view) continue;
    const closes = closesBySymbol.get(s.symbol);
    if (!closes || closes.length < 2 || closes[1] === 0) continue;
    const ret = (closes[0] - closes[1]) / closes[1];
    const mcap = s.market_cap ? Number(s.market_cap) : 1;
    const slot = agg.get(s.sector) ?? {
      totalMcap: 0,
      weightedRet: 0,
      count: 0,
    };
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
    <div style={{ paddingBottom: 24 }}>
      <PageHeader
        title={<><Term k="sector">섹터</Term> Heatmap</>}
        sub="오늘 종가 vs 어제 종가 시가총액 가중 평균"
        right={
          <div style={{ display: "flex", gap: 4 }}>
            <Link
              href="/app/sectors?scope=KR"
              className="yg-chip"
              style={{
                textDecoration: "none",
                fontSize: 11,
                background:
                  view === "KR" ? "var(--yg-brand)" : "var(--yg-bg-tint-ink)",
                color:
                  view === "KR"
                    ? "var(--yg-fg-on-brand)"
                    : "var(--yg-fg-secondary)",
              }}
            >
              KR
            </Link>
            <Link
              href="/app/sectors?scope=US"
              className="yg-chip"
              style={{
                textDecoration: "none",
                fontSize: 11,
                background:
                  view === "US" ? "var(--yg-brand)" : "var(--yg-bg-tint-ink)",
                color:
                  view === "US"
                    ? "var(--yg-fg-on-brand)"
                    : "var(--yg-fg-secondary)",
              }}
            >
              US
            </Link>
          </div>
        }
      />

      <div style={{ padding: "8px 20px 0" }}>
        {heat.length === 0 ? (
          <div
            className="yg-card"
            style={{
              padding: 36,
              textAlign: "center",
              fontSize: 13,
              color: "var(--yg-fg-tertiary)",
              fontWeight: 700,
            }}
          >
            일봉 데이터가 부족합니다 (어제/오늘 종가 필요)
          </div>
        ) : (
          <div className="yg-card" style={{ padding: 18 }}>
            <div
              style={{
                fontSize: 16,
                fontWeight: 800,
                letterSpacing: "-0.02em",
                marginBottom: 12,
              }}
            >
              섹터별 등락 ({heat.length}개)
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 8,
              }}
            >
              {heat.map((h) => {
                const s = heatStyle(h.ret);
                return (
                  <Link
                    key={h.sector}
                    href={`/app/sectors/${encodeURIComponent(
                      h.sector,
                    )}?scope=${view}`}
                    className="yg-tap"
                    style={{
                      padding: "12px 10px",
                      borderRadius: 12,
                      textAlign: "center",
                      textDecoration: "none",
                      background: s.background,
                      color: s.color,
                    }}
                  >
                    <div
                      style={{
                        fontSize: 12,
                        fontWeight: 800,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {h.sector}
                    </div>
                    <div
                      className="yg-num"
                      style={{
                        fontSize: 16,
                        fontWeight: 800,
                        marginTop: 4,
                        letterSpacing: "-0.02em",
                      }}
                    >
                      {h.ret >= 0 ? "+" : ""}
                      {(h.ret * 100).toFixed(2)}%
                    </div>
                    <div
                      style={{
                        fontSize: 10,
                        opacity: 0.75,
                        marginTop: 2,
                        fontWeight: 700,
                      }}
                    >
                      {h.count}개 종목
                    </div>
                  </Link>
                );
              })}
            </div>
            <div
              style={{
                fontSize: 11,
                color: "var(--yg-fg-tertiary)",
                fontWeight: 600,
                marginTop: 14,
                textAlign: "center",
              }}
            >
              ⬛ 색이 진할수록 큰 등락 · 빨강↑ 파랑↓ (KR 관례)
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
