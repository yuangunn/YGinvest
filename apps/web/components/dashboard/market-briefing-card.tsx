// Plan #47.2: 대시보드에 항상 표시되는 시황 카드.
// popup을 닫아도 여기서 다시 볼 수 있음. 클릭하면 /app/market-today.

import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

type Keyword = {
  keyword: string;
  category: string;
  headline_count: number;
};

const CATEGORY_META: Record<
  string,
  { emoji: string; bg: string; fg: string }
> = {
  monetary: { emoji: "💰", bg: "var(--yg-bg-tint-ink)", fg: "var(--yg-fg-secondary)" },
  war: { emoji: "🔥", bg: "var(--yg-bg-tint-red)", fg: "var(--yg-up-deep)" },
  politics: { emoji: "🏛️", bg: "var(--yg-bg-tint-ink)", fg: "var(--yg-fg-secondary)" },
  real_estate: { emoji: "🏠", bg: "var(--yg-bg-tint-ink)", fg: "var(--yg-fg-secondary)" },
  corporate: { emoji: "🏢", bg: "var(--yg-bg-tint-ink)", fg: "var(--yg-fg-secondary)" },
  tech: { emoji: "💻", bg: "var(--yg-bg-tint-blue)", fg: "var(--yg-down-deep)" },
  global: { emoji: "🌐", bg: "var(--yg-bg-tint-ink)", fg: "var(--yg-fg-secondary)" },
  other: { emoji: "📰", bg: "var(--yg-bg-tint-ink)", fg: "var(--yg-fg-tertiary)" },
};

function firstLine(summary: string): string {
  const lines = summary.split("\n").map((l) => l.trim()).filter(Boolean);
  return lines[0] ?? "";
}

const SLOT_LABEL: Record<string, { label: string; emoji: string }> = {
  morning: { label: "오전 시황", emoji: "🌅" },
  noon: { label: "오전장 정리", emoji: "☀️" },
};

export async function MarketBriefingCard() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("market_briefing")
    .select("date, slot, summary, keywords, generated_at")
    .order("date", { ascending: false })
    .order("slot", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!data) return null;

  const summary = (data.summary as string) ?? "";
  const headline = firstLine(summary);
  const keywords = ((data.keywords ?? []) as Keyword[]).slice(0, 5);
  const slot = (data.slot as string) ?? "morning";
  const slotMeta = SLOT_LABEL[slot] ?? SLOT_LABEL.morning;
  const dateLabel = new Date(data.date as string).toLocaleDateString("ko-KR", {
    month: "numeric",
    day: "numeric",
    weekday: "short",
  });

  return (
    <Link
      href="/app/market-today"
      className="yg-card yg-tap"
      style={{
        display: "block",
        padding: 18,
        textDecoration: "none",
        color: "var(--yg-fg-primary)",
        background:
          "linear-gradient(180deg, var(--yg-grad-elev-start) 0%, var(--yg-grad-elev-end) 100%)",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 10,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
          }}
        >
          <span
            style={{
              fontSize: 11,
              fontWeight: 800,
              color: "var(--yg-up-deep)",
              letterSpacing: "0.04em",
            }}
          >
            {slotMeta.emoji} {slotMeta.label}
          </span>
          <span
            style={{
              fontSize: 11,
              fontWeight: 700,
              color: "var(--yg-fg-tertiary)",
            }}
          >
            · {dateLabel}
          </span>
        </div>
        <span
          style={{
            fontSize: 12,
            fontWeight: 700,
            color: "var(--yg-fg-tertiary)",
          }}
        >
          상세 ›
        </span>
      </div>

      {headline && (
        <div
          style={{
            fontSize: 15,
            fontWeight: 800,
            letterSpacing: "-0.015em",
            color: "var(--yg-fg-primary)",
            lineHeight: 1.4,
            marginBottom: 10,
            overflow: "hidden",
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
          }}
        >
          {headline}
        </div>
      )}

      {keywords.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
          {keywords.map((kw) => {
            const meta = CATEGORY_META[kw.category] ?? CATEGORY_META.other;
            return (
              <span
                key={kw.keyword}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 3,
                  padding: "4px 8px",
                  borderRadius: 99,
                  background: meta.bg,
                  color: meta.fg,
                  fontSize: 11,
                  fontWeight: 700,
                }}
              >
                <span style={{ fontSize: 10 }}>{meta.emoji}</span>
                {kw.keyword}
              </span>
            );
          })}
        </div>
      )}
    </Link>
  );
}
