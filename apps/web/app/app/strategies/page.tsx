// Plan #45: 유명 투자 전략 — YG 디자인.

import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/supabase/user";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/yg/page-header";
import { STRATEGIES, type StrategyFilter } from "@/lib/strategies";

type Stock = {
  symbol: string;
  name: string;
  name_ko: string | null;
  market: string;
  per: number | null;
  market_cap: number | null;
  last_price: number | null;
  fifty_two_week_high: number | null;
  fifty_two_week_low: number | null;
  sector: string | null;
  currency: string;
};

function applyFilter(stocks: Stock[], filter: StrategyFilter["filters"]): Stock[] {
  return stocks.filter((s) => {
    if (s.last_price == null) return false;

    if (filter.perMax !== undefined) {
      if (s.per == null || s.per > filter.perMax) return false;
    }
    if (filter.perMin !== undefined) {
      if (s.per == null || s.per < filter.perMin) return false;
    }
    if (filter.mcMin !== undefined) {
      if (s.market_cap == null || s.market_cap < filter.mcMin) return false;
    }
    if (
      filter.near52wLowMax !== undefined &&
      s.fifty_two_week_low != null &&
      s.fifty_two_week_high != null
    ) {
      const range = s.fifty_two_week_high - s.fifty_two_week_low;
      if (range <= 0) return false;
      const posInRange = (s.last_price - s.fifty_two_week_low) / range;
      if (posInRange > filter.near52wLowMax) return false;
    }
    if (
      filter.near52wHighMin !== undefined &&
      s.fifty_two_week_low != null &&
      s.fifty_two_week_high != null
    ) {
      const range = s.fifty_two_week_high - s.fifty_two_week_low;
      if (range <= 0) return false;
      const posInRange = (s.last_price - s.fifty_two_week_low) / range;
      if (posInRange < filter.near52wHighMin) return false;
    }
    return true;
  });
}

export default async function StrategiesPage() {
  const supabase = await createClient();
  const user = await getCurrentUser();
  if (!user) redirect("/auth/login");

  // 모든 활성 종목 가져오기 (전체 스캔 — 시총 큰 종목 우선)
  const { data: stocksRaw } = await supabase
    .from("stocks")
    .select(
      "symbol, name, name_ko, market, per, market_cap, last_price, fifty_two_week_high, fifty_two_week_low, sector, currency",
    )
    .eq("is_active", true)
    .order("market_cap", { ascending: false, nullsFirst: false })
    .limit(2000);

  const stocks = (stocksRaw as Stock[] | null) ?? [];

  return (
    <div style={{ paddingBottom: 24 }}>
      <PageHeader
        title="유명 투자 전략"
        sub="버핏 · 린치 · 역발상 · 모멘텀"
      />
      <div style={{ padding: "8px 20px 0", display: "flex", flexDirection: "column", gap: 12 }}>

      {STRATEGIES.map((strat) => {
        const matched = applyFilter(stocks, strat.filters);
        const top = matched.slice(0, 8);
        return (
          <Card key={strat.id}>
            <CardHeader>
              <CardTitle className="text-base">
                {strat.name}
                <span className="text-xs text-muted-foreground font-normal ml-2">
                  — {strat.author}
                </span>
              </CardTitle>
              <p className="text-xs text-muted-foreground mt-1">
                {strat.description}
              </p>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="text-[10px] grid grid-cols-2 gap-2 text-muted-foreground">
                <div>
                  <div className="font-semibold text-foreground/80 mb-0.5">
                    💡 어떤 종목이 나오나
                  </div>
                  <ul className="list-disc ml-3 space-y-0.5">
                    {strat.highlightPoints.map((p, i) => (
                      <li key={i}>{p}</li>
                    ))}
                  </ul>
                </div>
                <div>
                  <div className="font-semibold text-amber-500/80 mb-0.5">
                    ⚠️ 주의
                  </div>
                  <ul className="list-disc ml-3 space-y-0.5">
                    {strat.warnings.map((p, i) => (
                      <li key={i}>{p}</li>
                    ))}
                  </ul>
                </div>
              </div>

              <div className="border-t pt-2">
                <div className="text-xs text-muted-foreground mb-1.5">
                  매칭된 종목 ({matched.length}개 중 상위 {top.length}):
                </div>
                {top.length === 0 ? (
                  <p className="text-xs text-muted-foreground py-2">
                    조건에 맞는 종목 없음
                  </p>
                ) : (
                  <div className="space-y-1">
                    {top.map((s) => (
                      <Link
                        key={s.symbol}
                        href={`/app/stocks/${encodeURIComponent(s.symbol)}/analysis`}
                        className="flex items-center justify-between text-xs hover:bg-accent rounded px-2 py-1.5"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="font-medium truncate">
                            {s.name_ko ?? s.name}
                          </div>
                          <div className="text-[9px] text-muted-foreground">
                            {s.symbol} · {s.sector ?? "—"}
                          </div>
                        </div>
                        <div className="text-right text-[10px] font-mono">
                          <div>
                            PER {s.per != null ? s.per.toFixed(1) : "—"}
                          </div>
                          <div className="text-muted-foreground">
                            시총{" "}
                            {s.market_cap != null
                              ? s.currency === "KRW"
                                ? `${(s.market_cap / 1_000_000_000_000).toFixed(1)}조`
                                : `$${(s.market_cap / 1_000_000_000).toFixed(0)}B`
                              : "—"}
                          </div>
                        </div>
                        <ArrowRight className="h-3 w-3 text-muted-foreground/50 ml-1" />
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        );
      })}

      <Card>
        <CardContent className="text-xs text-muted-foreground py-3 space-y-2">
          <p className="font-semibold text-foreground">📚 어떤 전략을 따를까?</p>
          <ul className="list-disc ml-4 space-y-1">
            <li>
              <strong>가치투자 (버핏/역발상)</strong>: 인내심 필요. 2-5년 시계.
            </li>
            <li>
              <strong>모멘텀 (린치/Minervini)</strong>: 빠른 회전. 손절 규칙 엄격히.
            </li>
            <li>
              <strong>블루칩</strong>: 시간이 우군. 묻어두고 잊는 방식.
            </li>
            <li>
              하나의 스타일 고수보다 <strong>섞어쓰기</strong>가 일반적으로 더 안정적 (코어-위성 전략).
            </li>
          </ul>
        </CardContent>
      </Card>
      </div>
    </div>
  );
}
