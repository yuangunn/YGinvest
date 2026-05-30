import Link from "next/link";
import { redirect } from "next/navigation";
import { Activity } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/supabase/user";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const CATEGORY_LABEL: Record<string, string> = {
  top_gainers: "급등 종목",
  top_losers: "급락 종목",
  volume_surge: "거래량 급증",
  near_52w_high: "52주 신고가",
  low_per_value: "저PER 가치",
  personalized: "당신을 위한 추천",
};

type ClickRow = {
  id: number;
  category: string;
  market_scope: string | null;
  symbol: string;
  rank: number | null;
  clicked_at: string;
};

type StockMeta = { symbol: string; name: string; name_ko: string | null };

export default async function ClicksHistoryPage() {
  const supabase = await createClient();
  const user = await getCurrentUser();
  if (!user) redirect("/auth/login");

  const { data: rows } = await supabase
    .from("recommendation_clicks")
    .select("id, category, market_scope, symbol, rank, clicked_at")
    .eq("user_id", user.id)
    .order("clicked_at", { ascending: false })
    .limit(200);
  const clicks = (rows as ClickRow[] | null) ?? [];

  // dedupe symbols for stock metadata
  const symbols = Array.from(new Set(clicks.map((c) => c.symbol)));
  const { data: stocks } = symbols.length
    ? await supabase
        .from("stocks")
        .select("symbol, name, name_ko")
        .in("symbol", symbols)
    : { data: [] };
  const stockBySym = new Map<string, StockMeta>(
    ((stocks as StockMeta[] | null) ?? []).map((s) => [s.symbol, s]),
  );

  // Aggregate
  const bySymbol = new Map<string, number>();
  const byCategory = new Map<string, number>();
  for (const c of clicks) {
    bySymbol.set(c.symbol, (bySymbol.get(c.symbol) ?? 0) + 1);
    byCategory.set(c.category, (byCategory.get(c.category) ?? 0) + 1);
  }
  const topSymbols = [...bySymbol.entries()]
    .sort(([, a], [, b]) => b - a)
    .slice(0, 10);
  const topCategories = [...byCategory.entries()].sort(
    ([, a], [, b]) => b - a,
  );

  return (
    <div className="max-w-3xl mx-auto p-4 space-y-4">
      <div>
        <h1 className="text-xl font-bold flex items-center gap-2">
          <Activity className="h-5 w-5 text-primary" />
          추천 클릭 history
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          최근 200건 분석. 향후 개인화 추천에 활용됩니다.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              자주 본 종목 (Top {Math.min(topSymbols.length, 10)})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {topSymbols.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                아직 추천 클릭이 없어요
              </p>
            ) : (
              <div className="space-y-1">
                {topSymbols.map(([sym, cnt]) => {
                  const meta = stockBySym.get(sym);
                  return (
                    <Link
                      key={sym}
                      href={`/app/trade/${encodeURIComponent(sym)}`}
                      className="flex items-center justify-between rounded p-1.5 hover:bg-muted/30"
                    >
                      <span className="text-sm">
                        {meta?.name_ko ?? meta?.name ?? sym}
                        <span className="text-xs text-muted-foreground ml-1">
                          {sym}
                        </span>
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {cnt}회
                      </span>
                    </Link>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">관심 카테고리</CardTitle>
          </CardHeader>
          <CardContent>
            {topCategories.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                아직 추천 클릭이 없어요
              </p>
            ) : (
              <div className="space-y-1">
                {topCategories.map(([cat, cnt]) => (
                  <div
                    key={cat}
                    className="flex items-center justify-between text-sm"
                  >
                    <span>{CATEGORY_LABEL[cat] ?? cat}</span>
                    <span className="text-xs text-muted-foreground">
                      {cnt}회
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">최근 클릭</CardTitle>
        </CardHeader>
        <CardContent>
          {clicks.length === 0 ? (
            <p className="text-sm text-muted-foreground">아직 클릭 없음</p>
          ) : (
            <div className="space-y-1">
              {clicks.slice(0, 30).map((c) => {
                const meta = stockBySym.get(c.symbol);
                return (
                  <Link
                    key={c.id}
                    href={`/app/trade/${encodeURIComponent(c.symbol)}`}
                    className="flex items-center justify-between gap-2 rounded p-1.5 hover:bg-muted/30 text-sm"
                  >
                    <div className="min-w-0">
                      <div className="truncate">
                        {meta?.name_ko ?? meta?.name ?? c.symbol}
                      </div>
                      <div className="text-[10px] text-muted-foreground">
                        {CATEGORY_LABEL[c.category] ?? c.category}
                        {c.market_scope && ` · ${c.market_scope}`}
                        {c.rank && ` · #${c.rank}`}
                      </div>
                    </div>
                    <span className="text-[10px] text-muted-foreground flex-shrink-0">
                      {new Date(c.clicked_at).toLocaleString("ko-KR", {
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </Link>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
