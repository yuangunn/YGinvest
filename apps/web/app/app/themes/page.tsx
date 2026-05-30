// Plan #45: 테마 — YG 디자인 (handoff pages-themes.jsx 패턴).

import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/supabase/user";
import { PageHeader } from "@/components/yg/page-header";

type Theme = {
  id: string;
  parent_id: string | null;
  slug: string;
  name: string;
  name_en: string | null;
  description: string | null;
};

// 핸드오프 컬러 매핑 — slug → 브랜드 컬러 (4-5개 표시)
const THEME_COLORS: Record<string, string> = {
  ai: "#5B47FB",
  battery: "#0E7C66",
  bio: "#B45309",
  green: "#16A34A",
  defense: "#0F1115",
  consumer: "#DC2626",
};
function colorFor(slug: string): string {
  // hash-based fallback
  if (THEME_COLORS[slug]) return THEME_COLORS[slug];
  let h = 0;
  for (let i = 0; i < slug.length; i++) h = (h * 31 + slug.charCodeAt(i)) | 0;
  const palette = ["#5B47FB", "#0E7C66", "#B45309", "#16A34A", "#DC2626", "#2563EB"];
  return palette[Math.abs(h) % palette.length];
}

export default async function ThemesPage() {
  const supabase = await createClient();
  const user = await getCurrentUser();
  if (!user) redirect("/auth/login");

  const [{ data: themes }, { data: favRows }, { data: stockThemes }] =
    await Promise.all([
      supabase
        .from("themes")
        .select("id, parent_id, slug, name, name_en, description")
        .order("name", { ascending: true }),
      supabase
        .from("theme_favorites")
        .select("theme_id")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false }),
      supabase.from("stock_themes").select("theme_id"),
    ]);

  const allThemes = (themes as Theme[] | null) ?? [];
  const roots = allThemes.filter((t) => t.parent_id === null);
  const themesById = new Map(allThemes.map((t) => [t.id, t]));

  const childCount = new Map<string, number>();
  for (const t of allThemes) {
    if (t.parent_id) {
      childCount.set(t.parent_id, (childCount.get(t.parent_id) ?? 0) + 1);
    }
  }

  const stockCount = new Map<string, number>();
  for (const row of (stockThemes as { theme_id: string }[] | null) ?? []) {
    stockCount.set(row.theme_id, (stockCount.get(row.theme_id) ?? 0) + 1);
  }

  const favoriteThemes = ((favRows as { theme_id: string }[] | null) ?? [])
    .map((r) => themesById.get(r.theme_id))
    .filter((t): t is Theme => t !== undefined);

  return (
    <div style={{ paddingBottom: 24 }}>
      <PageHeader
        title="테마"
        sub={`${allThemes.length}개 테마 · ${roots.length}개 대분류`}
      />

      {favoriteThemes.length > 0 && (
        <div style={{ padding: "8px 20px 0" }}>
          <div className="yg-card" style={{ padding: 18 }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: 10,
              }}
            >
              <h3
                style={{
                  margin: 0,
                  fontSize: 16,
                  fontWeight: 800,
                  letterSpacing: "-0.02em",
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                <span style={{ color: "var(--yg-up)" }}>★</span>
                즐겨찾기
              </h3>
              <span
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  color: "var(--yg-fg-tertiary)",
                }}
              >
                {favoriteThemes.length}개
              </span>
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {favoriteThemes.map((t) => (
                <Link
                  key={t.id}
                  href={`/app/themes/${t.slug}`}
                  className="yg-chip"
                  style={{
                    background: "var(--yg-brand-soft)",
                    color: "var(--yg-fg-primary)",
                    border: "1px solid var(--yg-line)",
                    textDecoration: "none",
                    fontSize: 12,
                    padding: "6px 10px",
                  }}
                >
                  #{t.name}
                </Link>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 대분류 grid */}
      <div style={{ padding: "12px 20px 0" }}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 12,
          }}
        >
          {roots.map((root) => {
            const children = allThemes.filter((t) => t.parent_id === root.id);
            const totalStocks = children.reduce(
              (s, c) => s + (stockCount.get(c.id) ?? 0),
              stockCount.get(root.id) ?? 0,
            );
            const c = colorFor(root.slug);
            return (
              <Link
                key={root.id}
                href={`/app/themes/${root.slug}`}
                className="yg-card yg-tap"
                style={{
                  padding: 16,
                  display: "flex",
                  flexDirection: "column",
                  gap: 10,
                  textDecoration: "none",
                  color: "var(--yg-fg-primary)",
                  position: "relative",
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 12,
                    background: c,
                    color: "#fff",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontWeight: 800,
                    fontSize: 14,
                  }}
                >
                  #
                </div>
                <div
                  style={{
                    fontSize: 16,
                    fontWeight: 800,
                    letterSpacing: "-0.02em",
                  }}
                >
                  {root.name}
                </div>
                <div
                  style={{
                    fontSize: 11,
                    fontWeight: 600,
                    color: "var(--yg-fg-tertiary)",
                  }}
                >
                  {childCount.get(root.id) ?? 0}개 · 종목 {totalStocks}
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                  {children.slice(0, 3).map((cc) => (
                    <span
                      key={cc.id}
                      style={{
                        fontSize: 10,
                        fontWeight: 700,
                        background: "var(--yg-bg-tint-ink)",
                        color: "var(--yg-fg-secondary)",
                        padding: "3px 7px",
                        borderRadius: 99,
                      }}
                    >
                      {cc.name}
                    </span>
                  ))}
                  {children.length > 3 && (
                    <span
                      style={{
                        fontSize: 10,
                        fontWeight: 700,
                        color: "var(--yg-fg-tertiary)",
                      }}
                    >
                      +{children.length - 3}
                    </span>
                  )}
                </div>
              </Link>
            );
          })}
        </div>
      </div>

      {/* Ranking CTA card */}
      <div style={{ padding: "12px 20px 0" }}>
        <Link
          href="/app/themes/ranking"
          className="yg-card yg-tap"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            padding: 18,
            textDecoration: "none",
            color: "var(--yg-fg-primary)",
          }}
        >
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: 12,
              background: "var(--yg-bg-tint-red)",
              color: "var(--yg-up-deep)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 20,
            }}
          >
            🏆
          </div>
          <div style={{ flex: 1 }}>
            <div
              style={{
                fontSize: 14,
                fontWeight: 800,
                letterSpacing: "-0.01em",
              }}
            >
              테마 순위 보기
            </div>
            <div
              style={{
                fontSize: 11,
                color: "var(--yg-fg-tertiary)",
                fontWeight: 600,
              }}
            >
              1주 / 1개월 / 3개월 수익률 랭킹
            </div>
          </div>
          <span style={{ color: "var(--yg-fg-tertiary)", fontWeight: 700 }}>
            ›
          </span>
        </Link>
      </div>
    </div>
  );
}
