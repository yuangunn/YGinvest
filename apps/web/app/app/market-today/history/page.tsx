// Plan #47.4: 시황 아카이브 — 최근 30개 brief 목록.

import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/yg/page-header";

type Keyword = {
  keyword: string;
  category: string;
};

const CATEGORY_EMOJI: Record<string, string> = {
  monetary: "💰",
  war: "🔥",
  politics: "🏛️",
  real_estate: "🏠",
  corporate: "🏢",
  tech: "💻",
  global: "🌐",
  other: "📰",
};

const SLOT_LABEL: Record<string, { label: string; emoji: string; color: string }> = {
  morning: { label: "오전 06:30 · 장 시작 전", emoji: "🌅", color: "var(--yg-up-deep)" },
  noon: { label: "정오 12:30 · 오전장 정리", emoji: "☀️", color: "var(--yg-down-deep)" },
};

function firstLine(summary: string): string {
  return (summary.split("\n").map((l) => l.trim()).filter(Boolean)[0] ?? "");
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("ko-KR", {
    month: "long",
    day: "numeric",
    weekday: "short",
  });
}

function relTime(iso: string): string {
  const d = new Date(iso);
  const ms = Date.now() - d.getTime();
  const min = Math.floor(ms / 60000);
  if (min < 60) return `${min}분 전`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}시간 전`;
  const days = Math.floor(h / 24);
  if (days < 30) return `${days}일 전`;
  return d.toLocaleDateString("ko-KR", { month: "numeric", day: "numeric" });
}

export default async function MarketHistoryPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const { data } = await supabase
    .from("market_briefing")
    .select("date, slot, summary, keywords, generated_at, source_count")
    .order("date", { ascending: false })
    .order("slot", { ascending: false })
    .limit(60);

  const briefings = (data ?? []).map((b) => ({
    date: b.date as string,
    slot: b.slot as "morning" | "noon",
    headline: firstLine((b.summary as string) ?? ""),
    keywords: ((b.keywords ?? []) as Keyword[]).slice(0, 5),
    generated_at: b.generated_at as string,
    source_count: b.source_count as number,
  }));

  // 날짜별로 그룹핑 (morning + noon 같이)
  const groupedByDate = new Map<
    string,
    typeof briefings
  >();
  for (const b of briefings) {
    if (!groupedByDate.has(b.date)) groupedByDate.set(b.date, []);
    groupedByDate.get(b.date)!.push(b);
  }

  return (
    <div style={{ paddingBottom: 24 }}>
      <PageHeader
        title="시황 아카이브"
        sub={`최근 ${briefings.length}건 · 평일 06:30 / 12:30 KST`}
        right={
          <Link
            href="/app/market-today"
            className="yg-chip"
            style={{
              fontSize: 11,
              fontWeight: 700,
              textDecoration: "none",
            }}
          >
            오늘 시황
          </Link>
        }
      />

      {briefings.length === 0 ? (
        <div style={{ padding: "16px 20px 0" }}>
          <div
            className="yg-card"
            style={{
              padding: 36,
              textAlign: "center",
              fontSize: 14,
              color: "var(--yg-fg-tertiary)",
              fontWeight: 600,
            }}
          >
            아직 생성된 시황이 없습니다
          </div>
        </div>
      ) : (
        <div style={{ padding: "8px 20px 0", display: "flex", flexDirection: "column", gap: 16 }}>
          {[...groupedByDate.entries()].map(([date, items]) => (
            <div key={date}>
              <h3
                style={{
                  margin: "0 4px 8px",
                  fontSize: 13,
                  fontWeight: 800,
                  color: "var(--yg-fg-tertiary)",
                  letterSpacing: "0.02em",
                }}
              >
                {formatDate(date)}
              </h3>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {items.map((b) => {
                  const slot = SLOT_LABEL[b.slot] ?? SLOT_LABEL.morning;
                  return (
                    <Link
                      key={`${b.date}-${b.slot}`}
                      href={`/app/market-today?date=${b.date}&slot=${b.slot}`}
                      className="yg-card yg-tap"
                      style={{
                        padding: 16,
                        textDecoration: "none",
                        color: "var(--yg-fg-primary)",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 6,
                          marginBottom: 8,
                        }}
                      >
                        <span style={{ fontSize: 14 }}>{slot.emoji}</span>
                        <span
                          style={{
                            fontSize: 11,
                            fontWeight: 800,
                            color: slot.color,
                            letterSpacing: "0.02em",
                          }}
                        >
                          {slot.label}
                        </span>
                        <span
                          style={{
                            marginLeft: "auto",
                            fontSize: 10,
                            color: "var(--yg-fg-tertiary)",
                            fontWeight: 600,
                          }}
                        >
                          {relTime(b.generated_at)}
                        </span>
                      </div>

                      <div
                        style={{
                          fontSize: 14,
                          fontWeight: 800,
                          letterSpacing: "-0.015em",
                          lineHeight: 1.4,
                          color: "var(--yg-fg-primary)",
                          marginBottom: 8,
                        }}
                      >
                        {b.headline}
                      </div>

                      {b.keywords.length > 0 && (
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                          {b.keywords.map((kw) => (
                            <span
                              key={kw.keyword}
                              style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: 3,
                                padding: "3px 7px",
                                borderRadius: 99,
                                background: "var(--yg-bg-tint-ink)",
                                color: "var(--yg-fg-secondary)",
                                fontSize: 10,
                                fontWeight: 700,
                              }}
                            >
                              <span>
                                {CATEGORY_EMOJI[kw.category] ?? "📰"}
                              </span>
                              {kw.keyword}
                            </span>
                          ))}
                        </div>
                      )}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      <div
        style={{
          padding: "20px 20px 0",
          fontSize: 11,
          color: "var(--yg-fg-tertiary)",
          fontWeight: 600,
          textAlign: "center",
          lineHeight: 1.6,
        }}
      >
        평일 06:30 / 12:30 KST 자동 생성 · 주말 휴장
      </div>
    </div>
  );
}
