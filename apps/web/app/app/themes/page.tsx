import Link from "next/link";
import { redirect } from "next/navigation";
import { Tags, ChevronRight } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type Theme = {
  id: string;
  parent_id: string | null;
  slug: string;
  name: string;
  name_en: string | null;
  description: string | null;
};

export default async function ThemesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const { data: themes } = await supabase
    .from("themes")
    .select("id, parent_id, slug, name, name_en, description")
    .order("name", { ascending: true });

  const allThemes = (themes as Theme[] | null) ?? [];
  const roots = allThemes.filter((t) => t.parent_id === null);

  // child count per root
  const childCount = new Map<string, number>();
  for (const t of allThemes) {
    if (t.parent_id) {
      childCount.set(t.parent_id, (childCount.get(t.parent_id) ?? 0) + 1);
    }
  }

  // stock count per theme (for sub-themes display) — single query
  const { data: stockThemes } = await supabase
    .from("stock_themes")
    .select("theme_id");
  const stockCount = new Map<string, number>();
  for (const row of (stockThemes as { theme_id: string }[] | null) ?? []) {
    stockCount.set(row.theme_id, (stockCount.get(row.theme_id) ?? 0) + 1);
  }

  return (
    <div className="max-w-3xl mx-auto p-4 space-y-4">
      <div>
        <h1 className="text-xl font-bold flex items-center gap-2">
          <Tags className="h-5 w-5 text-primary" />
          테마주
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          반도체 · 2차전지 · AI · 바이오 · K-방산 등 한국 시장 핵심 테마
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {roots.map((root) => {
          const children = allThemes.filter((t) => t.parent_id === root.id);
          const totalStocks = children.reduce(
            (s, c) => s + (stockCount.get(c.id) ?? 0),
            stockCount.get(root.id) ?? 0,
          );
          return (
            <Link
              key={root.id}
              href={`/app/themes/${root.slug}`}
              className="block"
            >
              <Card className="h-full hover:border-primary/40 transition-colors">
                <CardHeader>
                  <CardTitle className="text-base flex items-center justify-between">
                    <span>{root.name}</span>
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-xs text-muted-foreground">
                    {childCount.get(root.id) ?? 0}개 소분류 · {totalStocks}개 종목
                  </div>
                  {root.description && (
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                      {root.description}
                    </p>
                  )}
                  <div className="flex flex-wrap gap-1 mt-2">
                    {children.slice(0, 4).map((c) => (
                      <span
                        key={c.id}
                        className="text-[10px] rounded-full bg-muted px-2 py-0.5 text-muted-foreground"
                      >
                        {c.name}
                      </span>
                    ))}
                    {children.length > 4 && (
                      <span className="text-[10px] text-muted-foreground py-0.5">
                        +{children.length - 4}
                      </span>
                    )}
                  </div>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
