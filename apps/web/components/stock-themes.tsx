import Link from "next/link";
import { Tags } from "lucide-react";
import { createClient } from "@/lib/supabase/server";

type StockThemeRow = {
  weight: number;
  themes: {
    id: string;
    slug: string;
    name: string;
    parent_id: string | null;
  } | null;
};

export async function StockThemes({ symbol }: { symbol: string }) {
  const supabase = await createClient();
  const { data: rows } = await supabase
    .from("stock_themes")
    .select(`weight, themes ( id, slug, name, parent_id )`)
    .eq("stock_symbol", symbol);

  const list = (rows as unknown as StockThemeRow[] | null) ?? [];
  const themes = list
    .filter((r) => r.themes)
    .map((r) => ({ ...r.themes!, weight: r.weight }))
    .sort((a, b) => b.weight - a.weight);

  if (themes.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <Tags className="h-3 w-3 text-muted-foreground" />
      <span className="text-xs text-muted-foreground">테마:</span>
      {themes.map((t) => (
        <Link
          key={t.id}
          href={`/app/themes/${t.slug}`}
          className="text-xs rounded-full bg-primary/5 border border-primary/30 px-2 py-0.5 text-primary hover:bg-primary/10"
        >
          {t.name}
          {t.weight < 1 && (
            <span className="ml-1 text-muted-foreground">
              {Math.round(t.weight * 100)}%
            </span>
          )}
        </Link>
      ))}
    </div>
  );
}
