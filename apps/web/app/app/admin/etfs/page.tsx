// Plan #32: Admin — Yahoo 검색으로 ETF 추가 + 큐레이션 목록 확인.

import { redirect } from "next/navigation";
import { Sparkles, ShieldCheck } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/supabase/user";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getIsAdmin } from "@/lib/auth-admin";
import { EtfSearchClient } from "@/components/etf-search-client";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function AdminEtfsPage() {
  const supabase = await createClient();
  const user = await getCurrentUser();
  if (!user) redirect("/auth/login");
  if (!(await getIsAdmin(supabase, user.id))) {
    redirect("/app/dashboard");
  }

  // 현재 등록된 ETF 목록 (최근 추가된 순)
  const { data: etfs } = await supabase
    .from("stocks")
    .select(
      "symbol, name, name_ko, currency, market, etf_category, fund_family, last_price, expense_ratio, aum, updated_at",
    )
    .eq("instrument_type", "etf")
    .eq("is_active", true)
    .order("updated_at", { ascending: false })
    .limit(200);

  type EtfRow = NonNullable<typeof etfs>[number];
  const etfList: EtfRow[] = etfs ?? [];

  // 카테고리별 카운트
  const byCategory = new Map<string, number>();
  for (const e of etfList) {
    const cat = e.etf_category ?? "uncategorized";
    byCategory.set(cat, (byCategory.get(cat) ?? 0) + 1);
  }

  return (
    <div className="max-w-4xl mx-auto p-4 space-y-4">
      <div className="flex items-center gap-2">
        <ShieldCheck className="h-5 w-5 text-purple-500" />
        <h1 className="text-xl font-bold">ETF 관리</h1>
        <span className="text-[10px] rounded-md border border-purple-500/40 bg-purple-500/10 text-purple-600 dark:text-purple-400 px-1.5 py-0.5 font-semibold">
          ADMIN
        </span>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            Yahoo Finance 검색해서 ETF 추가
          </CardTitle>
          <p className="text-xs text-muted-foreground mt-1">
            티커 또는 ETF 이름으로 검색. 추가 후 다음 새벽 enrich_etfs job이
            운용보수/AUM/holdings 자동 채움.
          </p>
        </CardHeader>
        <CardContent>
          <EtfSearchClient />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">카테고리별 분포</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-sm">
            {Array.from(byCategory.entries())
              .sort((a, b) => b[1] - a[1])
              .map(([cat, count]) => (
                <div
                  key={cat}
                  className="rounded-lg border bg-muted/30 px-3 py-2"
                >
                  <div className="text-xs text-muted-foreground">{cat}</div>
                  <div className="font-semibold tabular-nums">{count}개</div>
                </div>
              ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            등록된 ETF ({etfList.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-muted-foreground border-b">
                  <th className="text-left py-1.5 pr-3">심볼</th>
                  <th className="text-left py-1.5 pr-3">이름</th>
                  <th className="text-left py-1.5 pr-3">시장</th>
                  <th className="text-left py-1.5 pr-3">카테고리</th>
                  <th className="text-right py-1.5 pr-3">운용보수</th>
                  <th className="text-right py-1.5 pr-3">현재가</th>
                </tr>
              </thead>
              <tbody>
                {etfList.map((e) => (
                  <tr key={e.symbol} className="border-b border-muted/40">
                    <td className="py-1.5 pr-3 font-mono text-xs">
                      {e.symbol}
                    </td>
                    <td className="py-1.5 pr-3">
                      {e.name_ko ?? e.name}
                      {e.fund_family && (
                        <span className="text-[10px] text-muted-foreground ml-1">
                          ({e.fund_family})
                        </span>
                      )}
                    </td>
                    <td className="py-1.5 pr-3 text-xs text-muted-foreground">
                      {e.market}
                    </td>
                    <td className="py-1.5 pr-3 text-xs">
                      {e.etf_category ?? "—"}
                    </td>
                    <td className="py-1.5 pr-3 text-right tabular-nums text-xs">
                      {e.expense_ratio
                        ? `${(Number(e.expense_ratio) * 100).toFixed(2)}%`
                        : "—"}
                    </td>
                    <td className="py-1.5 pr-3 text-right tabular-nums font-mono">
                      {e.last_price
                        ? Number(e.last_price).toLocaleString()
                        : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
