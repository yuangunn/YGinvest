// Plan #32: 테마 페이지에 관련 ETF 표시.
//
// 사용자가 "AI 테마에 관심" → 종목 고르기 부담 → ETF 한 종목으로 분산 투자.

import Link from "next/link";
import { PieChart } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";
import { getEtfsForTheme } from "@/lib/theme-etf-map";
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

type Props = {
  themeSlug: string;
};

export async function ThemeEtfSection({ themeSlug }: Props) {
  const etfSymbols = getEtfsForTheme(themeSlug);
  if (etfSymbols.length === 0) return null;

  const supabase = await createClient();
  const { data: etfs } = await supabase
    .from("stocks")
    .select(
      "symbol, name, name_ko, currency, market, etf_category, expense_ratio, last_price, fund_family, underlying_index",
    )
    .in("symbol", etfSymbols)
    .eq("instrument_type", "etf")
    .eq("is_active", true);

  type Etf = NonNullable<typeof etfs>[number];
  const list: Etf[] = etfs ?? [];

  if (list.length === 0) return null;

  // etfSymbols 순서 유지
  const ordered = etfSymbols
    .map((sym) => list.find((e) => e.symbol === sym))
    .filter((e): e is Etf => e !== undefined);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <PieChart className="h-4 w-4 text-primary" />이 테마 관련 ETF (
          {ordered.length})
        </CardTitle>
        <p className="text-xs text-muted-foreground mt-1">
          개별 종목 선택이 부담스럽다면 ETF로 분산 투자
        </p>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {ordered.map((e) => {
            const fmt = e.currency === "KRW" ? KRW : USD;
            return (
              <Link
                key={e.symbol}
                href={`/app/trade/${encodeURIComponent(e.symbol)}`}
                className="block rounded-md border bg-muted/20 hover:bg-accent hover:border-primary/40 p-2.5 transition-colors"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-medium text-sm">
                        {e.name_ko ?? e.name}
                      </span>
                      <span className="font-mono text-[10px] text-muted-foreground">
                        {e.symbol}
                      </span>
                      {e.etf_category && (
                        <span
                          className={`text-[10px] rounded border px-1.5 py-0.5 ${ETF_CATEGORY_COLOR[e.etf_category] ?? ""}`}
                        >
                          {ETF_CATEGORY_LABEL[e.etf_category] ?? e.etf_category}
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-muted-foreground mt-0.5">
                      {e.fund_family ?? "—"}
                      {e.underlying_index && <> · 추종: {e.underlying_index}</>}
                      {" · 운용보수 "}
                      {formatExpenseRatio(
                        e.expense_ratio ? Number(e.expense_ratio) : null,
                      )}
                    </div>
                  </div>
                  <div className="font-mono text-sm tabular-nums flex-shrink-0">
                    {e.last_price ? fmt.format(Number(e.last_price)) : "—"}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
