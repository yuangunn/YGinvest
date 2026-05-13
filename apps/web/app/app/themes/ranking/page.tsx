import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronLeft, TrendingUp, TrendingDown } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { computeThemeReturns } from "@/lib/theme-stats";

function pctFormat(ret: number): string {
  return `${ret >= 0 ? "+" : ""}${(ret * 100).toFixed(2)}%`;
}

export default async function ThemeRankingPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const all = await computeThemeReturns(supabase);
  // Show only ROOT (parent_id === null) for top-level theme ranking; subs in detail.
  // Actually, leaf themes are more informative — show only themes that have direct stocks.
  // Use sub-themes (parent_id !== null) since roots have descendants whose stocks should aggregate.
  // We need root-level aggregation too — let's compute it separately by descending.
  const subThemes = all.filter((t) => t.parentId !== null);
  const rootThemes = all.filter((t) => t.parentId === null);
  // Roots have their own direct mappings but most stocks attach to sub-themes;
  // compute root return by averaging sub-theme returns (simple unweighted).
  const rootAgg = new Map<
    string,
    { wsum: number; retsum: number; subs: number; allReturns: number[] }
  >();
  for (const sub of subThemes) {
    if (!sub.parentId) continue;
    const slot = rootAgg.get(sub.parentId) ?? {
      wsum: 0,
      retsum: 0,
      subs: 0,
      allReturns: [],
    };
    slot.wsum += sub.stockCount;
    slot.retsum += sub.avgReturn * sub.stockCount;
    slot.subs++;
    slot.allReturns.push(sub.avgReturn);
    rootAgg.set(sub.parentId, slot);
  }
  const roots = rootThemes
    .map((r) => {
      const agg = rootAgg.get(r.themeId);
      if (!agg || agg.wsum === 0) return null;
      return {
        ...r,
        avgReturn: agg.retsum / agg.wsum,
        stockCount: agg.wsum,
      };
    })
    .filter((r): r is NonNullable<typeof r> => r !== null)
    .sort((a, b) => b.avgReturn - a.avgReturn);

  return (
    <div className="max-w-3xl mx-auto p-4 space-y-4">
      <div className="text-xs text-muted-foreground">
        <Link href="/app/themes" className="hover:underline inline-flex items-center gap-0.5">
          <ChevronLeft className="h-3 w-3" />
          테마
        </Link>
      </div>

      <div>
        <h1 className="text-xl font-bold flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-primary" />
          테마별 등락률 ranking
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          오늘 종가 vs 어제 종가 기준. 종목 weight 가중 평균.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">대분류</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-1">
            {roots.map((r) => (
              <Link
                key={r.themeId}
                href={`/app/themes/${r.themeSlug}`}
                className="flex items-center justify-between gap-2 rounded-lg p-2 hover:bg-muted/30 transition-colors"
              >
                <div>
                  <div className="font-medium text-sm">{r.themeName}</div>
                  <div className="text-[10px] text-muted-foreground">
                    {r.stockCount}개 종목
                  </div>
                </div>
                <div
                  className={`font-mono text-sm font-semibold ${
                    r.avgReturn >= 0 ? "text-green-500" : "text-red-500"
                  }`}
                >
                  {pctFormat(r.avgReturn)}
                </div>
              </Link>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">소분류 (상위 등락)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-1">
            {subThemes.slice(0, 20).map((t) => (
              <Link
                key={t.themeId}
                href={`/app/themes/${t.themeSlug}`}
                className="flex items-center justify-between gap-2 rounded-lg p-2 hover:bg-muted/30 transition-colors"
              >
                <div className="min-w-0">
                  <div className="font-medium text-sm truncate">{t.themeName}</div>
                  <div className="text-[10px] text-muted-foreground flex gap-2">
                    {t.topGainer && (
                      <span>
                        <TrendingUp className="inline h-2.5 w-2.5 text-green-500" />{" "}
                        {t.topGainer.name} {pctFormat(t.topGainer.ret)}
                      </span>
                    )}
                    {t.topLoser && t.topLoser.symbol !== t.topGainer?.symbol && (
                      <span>
                        <TrendingDown className="inline h-2.5 w-2.5 text-red-500" />{" "}
                        {t.topLoser.name} {pctFormat(t.topLoser.ret)}
                      </span>
                    )}
                  </div>
                </div>
                <div
                  className={`font-mono text-sm font-semibold flex-shrink-0 ${
                    t.avgReturn >= 0 ? "text-green-500" : "text-red-500"
                  }`}
                >
                  {pctFormat(t.avgReturn)}
                </div>
              </Link>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
