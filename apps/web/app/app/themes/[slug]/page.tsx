import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ChevronLeft, Tags } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ThemeFavoriteButton } from "@/components/theme-favorite-button";
import { ThemeRelationsSection } from "@/components/theme-relations-section";

type Theme = {
  id: string;
  parent_id: string | null;
  slug: string;
  name: string;
  name_en: string | null;
  description: string | null;
};

type StockTheme = {
  theme_id: string;
  weight: number;
  stocks: {
    symbol: string;
    name: string;
    name_ko: string | null;
    currency: string;
    last_price: number | null;
    market: string;
    market_cap: number | null;
    sector: string | null;
  } | null;
};

const KRW = new Intl.NumberFormat("ko-KR", {
  style: "currency",
  currency: "KRW",
  maximumFractionDigits: 0,
});
const USD = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

export default async function ThemeDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const { data: theme } = await supabase
    .from("themes")
    .select("id, parent_id, slug, name, name_en, description")
    .eq("slug", slug)
    .maybeSingle();
  if (!theme) notFound();
  const t = theme as Theme;

  // descendants — adjacency list recursive 흉내 (depth 2이면 1 hop으로 충분)
  const { data: children } = await supabase
    .from("themes")
    .select("id, parent_id, slug, name, name_en, description")
    .eq("parent_id", t.id)
    .order("name", { ascending: true });
  const childList = (children as Theme[] | null) ?? [];

  // 부모도 가져오기 (breadcrumb)
  let parent: Theme | null = null;
  if (t.parent_id) {
    const { data } = await supabase
      .from("themes")
      .select("id, parent_id, slug, name, name_en, description")
      .eq("id", t.parent_id)
      .maybeSingle();
    parent = data as Theme | null;
  }

  // 즐겨찾기 여부
  const { data: fav } = await supabase
    .from("theme_favorites")
    .select("theme_id")
    .eq("user_id", user.id)
    .eq("theme_id", t.id)
    .maybeSingle();

  // 이 테마(+ 자식 테마)에 속한 stocks
  const themeIds = [t.id, ...childList.map((c) => c.id)];
  const { data: stRows } = await supabase
    .from("stock_themes")
    .select(
      `theme_id, weight, stocks ( symbol, name, name_ko, currency, last_price, market, market_cap, sector )`,
    )
    .in("theme_id", themeIds);

  // Dedupe by symbol (한 종목이 여러 sub-theme에 속할 수 있음 — 최대 weight)
  const stockBySymbol = new Map<
    string,
    { row: StockTheme; bestWeight: number; themeId: string }
  >();
  for (const row of (stRows as unknown as StockTheme[] | null) ?? []) {
    if (!row.stocks) continue;
    const sym = row.stocks.symbol;
    const existing = stockBySymbol.get(sym);
    if (!existing || row.weight > existing.bestWeight) {
      stockBySymbol.set(sym, {
        row,
        bestWeight: row.weight,
        themeId: row.theme_id,
      });
    }
  }
  // 정렬: market_cap DESC (큰 종목 먼저)
  const stocksAll = [...stockBySymbol.values()].sort((a, b) => {
    const aCap = a.row.stocks?.market_cap ?? 0;
    const bCap = b.row.stocks?.market_cap ?? 0;
    return Number(bCap) - Number(aCap);
  });

  const themeNameById = new Map<string, string>();
  themeNameById.set(t.id, t.name);
  for (const c of childList) themeNameById.set(c.id, c.name);

  // Plan #30: 관련주 섹션용 — 전체 테마 메타 (slug → name)
  const { data: allThemesRaw } = await supabase
    .from("themes")
    .select("slug, name");
  const themeMetas =
    (allThemesRaw as { slug: string; name: string }[] | null) ?? [];

  return (
    <div className="max-w-3xl mx-auto p-4 space-y-4">
      {/* Breadcrumb */}
      <div className="text-xs text-muted-foreground flex items-center gap-1">
        <Link href="/app/themes" className="hover:underline">
          <span className="inline-flex items-center gap-0.5">
            <ChevronLeft className="h-3 w-3" />
            테마
          </span>
        </Link>
        {parent && (
          <>
            <span>·</span>
            <Link
              href={`/app/themes/${parent.slug}`}
              className="hover:underline"
            >
              {parent.name}
            </Link>
          </>
        )}
      </div>

      <div className="flex items-start justify-between gap-2">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <Tags className="h-5 w-5 text-primary" />
            {t.name}
          </h1>
          {t.description && (
            <p className="text-sm text-muted-foreground mt-1">{t.description}</p>
          )}
        </div>
        <ThemeFavoriteButton
          themeId={t.id}
          themeName={t.name}
          initialFavorited={!!fav}
        />
      </div>

      {/* Sub-themes */}
      {childList.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">소분류</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {childList.map((c) => (
                <Link
                  key={c.id}
                  href={`/app/themes/${c.slug}`}
                  className="flex flex-col rounded-lg border p-2 hover:bg-muted/30 hover:border-primary/40 transition-colors"
                >
                  <span className="text-sm font-medium">{c.name}</span>
                  {c.name_en && (
                    <span className="text-[10px] text-muted-foreground">
                      {c.name_en}
                    </span>
                  )}
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Plan #30: 관련주 섹션 — 이 테마가 견인하는 후속 / 견인받는 상위 테마 */}
      <ThemeRelationsSection slug={t.slug} themeMetas={themeMetas} />

      {/* Stocks in this theme + descendants */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            관련 종목 ({stocksAll.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {stocksAll.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              아직 매핑된 종목이 없어요
            </p>
          ) : (
            <div className="space-y-1">
              {stocksAll.map(({ row, themeId }) => {
                const s = row.stocks!;
                const fmt = s.currency === "KRW" ? KRW : USD;
                const name = s.name_ko ?? s.name;
                const price = s.last_price ? fmt.format(Number(s.last_price)) : "—";
                const subThemeName = themeNameById.get(themeId);
                return (
                  <Link
                    key={s.symbol}
                    href={`/app/trade/${encodeURIComponent(s.symbol)}`}
                    className="flex items-center justify-between gap-2 rounded-lg p-2 hover:bg-muted/30 transition-colors"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm truncate">{name}</span>
                        {subThemeName && subThemeName !== t.name && (
                          <span className="text-[10px] rounded-full bg-muted px-1.5 py-0.5 text-muted-foreground flex-shrink-0">
                            {subThemeName}
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {s.symbol} · {s.market}
                        {row.weight < 1 && (
                          <> · 비중 {Math.round(row.weight * 100)}%</>
                        )}
                      </div>
                    </div>
                    <div className="font-mono text-sm flex-shrink-0">{price}</div>
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
