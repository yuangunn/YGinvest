// Plan #32: 대시보드 ETF 카테고리별 추천 섹션 (server component).

import Link from "next/link";
import { PieChart, ArrowRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";
import {
  ETF_CATEGORY_LABEL,
  ETF_CATEGORY_COLOR,
  formatExpenseRatio,
} from "@/lib/etf-labels";

const KRW = new Intl.NumberFormat("ko-KR", {
  style: "currency",
  currency: "KRW",
  maximumFractionDigits: 0,
});
const USD = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });

// 대시보드에 노출할 카테고리 (관심도 순)
const FEATURED_CATEGORIES = [
  "broad_market",
  "dividend",
  "sector",
  "thematic",
] as const;

export async function EtfCurationSection() {
  const supabase = await createClient();

  // 카테고리별 Top 3 ETF (AUM 기준)
  const { data: etfs } = await supabase
    .from("stocks")
    .select(
      "symbol, name, name_ko, currency, market, etf_category, expense_ratio, last_price, fund_family",
    )
    .eq("instrument_type", "etf")
    .eq("is_active", true)
    .in("etf_category", FEATURED_CATEGORIES as unknown as string[])
    .order("aum", { ascending: false, nullsFirst: false })
    .limit(40);

  type Etf = NonNullable<typeof etfs>[number];
  const list: Etf[] = etfs ?? [];

  if (list.length === 0) return null;

  // 카테고리별로 그룹화 (최대 3개씩)
  const grouped = new Map<string, Etf[]>();
  for (const e of list) {
    if (!e.etf_category) continue;
    const arr = grouped.get(e.etf_category) ?? [];
    if (arr.length < 3) {
      arr.push(e);
      grouped.set(e.etf_category, arr);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center justify-between">
          <span className="inline-flex items-center gap-2">
            <PieChart className="h-4 w-4 text-primary" />
            ETF 추천
          </span>
          <Link
            href="/app/trade/search?instrument=etf"
            className="text-xs text-primary hover:underline inline-flex items-center gap-0.5"
          >
            전체 ETF <ArrowRight className="h-3 w-3" />
          </Link>
        </CardTitle>
        <p className="text-xs text-muted-foreground mt-1">
          종목 고르기 어렵다면 ETF로 분산 투자 — 한 번에 수십~수백 종목
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        {FEATURED_CATEGORIES.map((cat) => {
          const items = grouped.get(cat) ?? [];
          if (items.length === 0) return null;
          return (
            <div key={cat}>
              <h3 className="text-xs font-semibold mb-1.5 flex items-center gap-1.5">
                <span
                  className={`inline-block rounded border px-1.5 py-0.5 ${ETF_CATEGORY_COLOR[cat] ?? ""}`}
                >
                  {ETF_CATEGORY_LABEL[cat] ?? cat}
                </span>
              </h3>
              <div className="flex gap-2 overflow-x-auto pb-1.5">
                {items.map((e) => {
                  const fmt = e.currency === "KRW" ? KRW : USD;
                  return (
                    <Link
                      key={e.symbol}
                      href={`/app/trade/${encodeURIComponent(e.symbol)}`}
                      className="flex-shrink-0 w-44 border rounded-lg p-2.5 hover:bg-accent hover:border-primary/40 transition-colors"
                    >
                      <div className="text-[10px] text-muted-foreground font-mono">
                        {e.symbol}
                      </div>
                      <div className="text-sm font-medium truncate mt-0.5">
                        {e.name_ko ?? e.name}
                      </div>
                      <div className="text-[10px] text-muted-foreground mt-0.5">
                        {e.fund_family ?? "—"}
                      </div>
                      <div className="flex items-center justify-between mt-1.5">
                        <span className="font-mono text-sm tabular-nums">
                          {e.last_price ? fmt.format(Number(e.last_price)) : "—"}
                        </span>
                        <span className="text-[10px] text-muted-foreground">
                          {formatExpenseRatio(
                            e.expense_ratio ? Number(e.expense_ratio) : null,
                          )}
                        </span>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
