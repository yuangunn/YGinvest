// Plan #47: 오늘의 시황 상세 페이지 — 키워드별 뉴스 + 매크로 + AI 요약.

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/yg/page-header";

type KeywordGroup = {
  keyword: string;
  category: string;
  headline_count: number;
  articles: Array<{
    title: string;
    url: string;
    source: string;
    published_at: string | null;
  }>;
};

type MacroSnap = Record<
  string,
  { value: number; change_pct: number; ts: string }
>;

const CATEGORY_META: Record<
  string,
  { label: string; emoji: string; bg: string; fg: string; tint: string }
> = {
  monetary: {
    label: "금리/통화",
    emoji: "💰",
    bg: "var(--yg-bg-tint-ink)",
    fg: "var(--yg-fg-secondary)",
    tint: "#F4F1E8",
  },
  war: {
    label: "전쟁/지정학",
    emoji: "🔥",
    bg: "var(--yg-bg-tint-red)",
    fg: "var(--yg-up-deep)",
    tint: "#FEEFEF",
  },
  politics: {
    label: "정치/규제",
    emoji: "🏛️",
    bg: "var(--yg-bg-tint-ink)",
    fg: "var(--yg-fg-secondary)",
    tint: "#F2F3F5",
  },
  real_estate: {
    label: "부동산",
    emoji: "🏠",
    bg: "var(--yg-bg-tint-ink)",
    fg: "var(--yg-fg-secondary)",
    tint: "#F0F4F1",
  },
  corporate: {
    label: "기업/실적",
    emoji: "🏢",
    bg: "var(--yg-bg-tint-ink)",
    fg: "var(--yg-fg-secondary)",
    tint: "#F2F3F5",
  },
  tech: {
    label: "기술/AI",
    emoji: "💻",
    bg: "var(--yg-bg-tint-blue)",
    fg: "var(--yg-down-deep)",
    tint: "#EEF3FE",
  },
  global: {
    label: "해외 시장",
    emoji: "🌐",
    bg: "var(--yg-bg-tint-ink)",
    fg: "var(--yg-fg-secondary)",
    tint: "#F2F3F5",
  },
  other: {
    label: "기타",
    emoji: "📰",
    bg: "var(--yg-bg-tint-ink)",
    fg: "var(--yg-fg-tertiary)",
    tint: "#F2F3F5",
  },
};

const MACRO_LABELS: Record<string, { label: string; unit: string }> = {
  KOSPI: { label: "KOSPI", unit: "" },
  KOSDAQ: { label: "KOSDAQ", unit: "" },
  SP500: { label: "S&P 500", unit: "" },
  NASDAQ: { label: "NASDAQ", unit: "" },
  USDKRW: { label: "원/달러 환율", unit: "원" },
  OIL_WTI: { label: "WTI 유가", unit: "$" },
  GOLD: { label: "금 시세", unit: "$" },
  BTC_USD: { label: "비트코인", unit: "$" },
  DXY: { label: "달러 인덱스", unit: "" },
  VIX: { label: "VIX 공포지수", unit: "" },
  TNX10Y: { label: "美 10년물 금리", unit: "%" },
  FED_FUNDS: { label: "美 기준금리", unit: "%" },
};

function relTime(iso: string): string {
  const d = new Date(iso);
  const ms = Date.now() - d.getTime();
  const min = Math.floor(ms / 60000);
  if (min < 60) return `${min}분 전`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}시간 전`;
  return d.toLocaleDateString("ko-KR", { month: "numeric", day: "numeric" });
}

export default async function MarketTodayPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const { data } = await supabase
    .from("market_briefing")
    .select("date, summary, keywords, macro_snapshot, source_count, generated_at")
    .order("date", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!data) {
    return (
      <div style={{ paddingBottom: 24 }}>
        <PageHeader title="오늘의 시황" sub="아직 생성된 브리핑 없음" />
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
            오늘의 시황은 매일 오전 06:30에 생성돼요.
            <div style={{ fontSize: 11, marginTop: 6 }}>
              조금 후에 다시 와주세요.
            </div>
          </div>
        </div>
      </div>
    );
  }

  const keywords = (data.keywords ?? []) as KeywordGroup[];
  const macro = (data.macro_snapshot ?? {}) as MacroSnap;

  const dateLabel = new Date(data.date as string).toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "long",
  });
  const generatedLabel = relTime(data.generated_at as string);

  return (
    <div style={{ paddingBottom: 24 }}>
      <PageHeader title="오늘의 시황" sub={`${dateLabel} · ${generatedLabel} 갱신`} />

      {/* AI 요약 hero */}
      <div style={{ padding: "8px 20px 0" }}>
        <div
          className="yg-card yg-card-lg"
          style={{
            padding: 22,
            background:
              "linear-gradient(180deg, var(--yg-grad-elev-start) 0%, var(--yg-grad-elev-end) 100%)",
          }}
        >
          <div
            style={{
              fontSize: 11,
              fontWeight: 800,
              color: "var(--yg-up-deep)",
              letterSpacing: "0.04em",
              marginBottom: 8,
            }}
          >
            🤖 AI 시장 요약
          </div>
          <div
            style={{
              fontSize: 14,
              lineHeight: 1.65,
              color: "var(--yg-fg-primary)",
              fontWeight: 600,
              whiteSpace: "pre-line",
            }}
          >
            {data.summary as string}
          </div>
          <div
            style={{
              marginTop: 12,
              fontSize: 10,
              color: "var(--yg-fg-tertiary)",
              fontWeight: 600,
            }}
          >
            {data.source_count}개 헤드라인 분석
          </div>
        </div>
      </div>

      {/* 매크로 지수 */}
      {Object.keys(macro).length > 0 && (
        <div style={{ padding: "16px 20px 0" }}>
          <h3
            style={{
              margin: "0 4px 10px",
              fontSize: 14,
              fontWeight: 800,
              color: "var(--yg-fg-tertiary)",
              letterSpacing: "0.04em",
            }}
          >
            매크로 지수
          </h3>
          <div className="yg-card" style={{ padding: 18 }}>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 12,
              }}
            >
              {Object.entries(macro).map(([k, v]) => {
                const meta = MACRO_LABELS[k] ?? { label: k, unit: "" };
                const up = v.change_pct >= 0;
                return (
                  <div
                    key={k}
                    style={{
                      padding: "10px 12px",
                      background: "var(--yg-bg-sub)",
                      borderRadius: 10,
                    }}
                  >
                    <div
                      style={{
                        fontSize: 11,
                        fontWeight: 700,
                        color: "var(--yg-fg-tertiary)",
                      }}
                    >
                      {meta.label}
                    </div>
                    <div
                      className="yg-num"
                      style={{
                        fontSize: 18,
                        fontWeight: 800,
                        color: "var(--yg-fg-primary)",
                        letterSpacing: "-0.02em",
                        marginTop: 2,
                      }}
                    >
                      {v.value.toLocaleString("ko-KR", {
                        maximumFractionDigits: 2,
                      })}
                      {meta.unit && (
                        <span
                          style={{
                            fontSize: 11,
                            fontWeight: 700,
                            color: "var(--yg-fg-tertiary)",
                            marginLeft: 3,
                          }}
                        >
                          {meta.unit}
                        </span>
                      )}
                    </div>
                    <div
                      className="yg-num"
                      style={{
                        fontSize: 11,
                        fontWeight: 800,
                        color: up ? "var(--yg-up-deep)" : "var(--yg-down-deep)",
                        marginTop: 2,
                      }}
                    >
                      {up ? "▲" : "▼"} {Math.abs(v.change_pct).toFixed(2)}%
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* 키워드별 뉴스 그룹 */}
      <div style={{ padding: "20px 20px 0" }}>
        <h3
          style={{
            margin: "0 4px 10px",
            fontSize: 14,
            fontWeight: 800,
            color: "var(--yg-fg-tertiary)",
            letterSpacing: "0.04em",
          }}
        >
          주요 키워드 ({keywords.length})
        </h3>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {keywords.map((kw) => {
            const meta = CATEGORY_META[kw.category] ?? CATEGORY_META.other;
            return (
              <div key={kw.keyword} className="yg-card" style={{ padding: 18 }}>
                {/* 키워드 헤더 */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    marginBottom: 12,
                  }}
                >
                  <div
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: 10,
                      background: meta.bg,
                      color: meta.fg,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 18,
                    }}
                  >
                    {meta.emoji}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        fontSize: 16,
                        fontWeight: 800,
                        letterSpacing: "-0.02em",
                        color: "var(--yg-fg-primary)",
                      }}
                    >
                      #{kw.keyword}
                    </div>
                    <div
                      style={{
                        fontSize: 11,
                        fontWeight: 700,
                        color: meta.fg,
                        marginTop: 2,
                      }}
                    >
                      {meta.label} · {kw.headline_count}건
                    </div>
                  </div>
                </div>

                {/* 관련 뉴스 */}
                {kw.articles.length === 0 ? (
                  <div
                    style={{
                      fontSize: 12,
                      color: "var(--yg-fg-tertiary)",
                      fontWeight: 600,
                    }}
                  >
                    관련 기사 없음
                  </div>
                ) : (
                  kw.articles.map((a, i) => (
                    <a
                      key={`${a.url}-${i}`}
                      href={a.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="yg-tap"
                      style={{
                        display: "block",
                        padding: "12px 0",
                        borderBottom:
                          i === kw.articles.length - 1
                            ? 0
                            : "1px solid var(--yg-line-faint)",
                        textDecoration: "none",
                        color: "var(--yg-fg-primary)",
                      }}
                    >
                      <div
                        style={{
                          fontSize: 13.5,
                          fontWeight: 700,
                          lineHeight: 1.45,
                          letterSpacing: "-0.01em",
                        }}
                      >
                        {a.title}
                      </div>
                      <div
                        style={{
                          fontSize: 10.5,
                          color: "var(--yg-fg-tertiary)",
                          fontWeight: 600,
                          marginTop: 4,
                        }}
                      >
                        {a.source}
                        {a.published_at && ` · ${relTime(a.published_at)}`}
                      </div>
                    </a>
                  ))
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* 출처/주의 */}
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
        ℹ️ RSS feed (연합/한겨레/매경/한경/경향) + Yahoo Finance 헤드라인 기반.
        <br />
        AI 요약은 객관적 사실 정리 목적이며 투자 자문이 아닙니다.
      </div>
    </div>
  );
}
