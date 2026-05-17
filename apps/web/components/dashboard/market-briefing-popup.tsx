"use client";

// Plan #47: 대시보드 첫 진입 시 시황 popup.
// localStorage `yg_briefing_dismissed_${YYYY-MM-DD}` 로 오늘 dismiss 추적.

import Link from "next/link";
import { useEffect, useState } from "react";

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

type Briefing = {
  date: string;
  summary: string;
  keywords: KeywordGroup[];
  macro_snapshot: MacroSnap;
  source_count: number;
  generated_at: string;
};

const CATEGORY_META: Record<
  string,
  { label: string; emoji: string; bg: string; fg: string }
> = {
  monetary: { label: "금리", emoji: "💰", bg: "var(--yg-bg-tint-ink)", fg: "var(--yg-fg-secondary)" },
  war: { label: "지정학", emoji: "🔥", bg: "var(--yg-bg-tint-red)", fg: "var(--yg-up-deep)" },
  politics: { label: "정치", emoji: "🏛️", bg: "var(--yg-bg-tint-ink)", fg: "var(--yg-fg-secondary)" },
  real_estate: { label: "부동산", emoji: "🏠", bg: "var(--yg-bg-tint-ink)", fg: "var(--yg-fg-secondary)" },
  corporate: { label: "기업", emoji: "🏢", bg: "var(--yg-bg-tint-ink)", fg: "var(--yg-fg-secondary)" },
  tech: { label: "기술", emoji: "💻", bg: "var(--yg-bg-tint-blue)", fg: "var(--yg-down-deep)" },
  global: { label: "해외", emoji: "🌐", bg: "var(--yg-bg-tint-ink)", fg: "var(--yg-fg-secondary)" },
  other: { label: "기타", emoji: "📰", bg: "var(--yg-bg-tint-ink)", fg: "var(--yg-fg-tertiary)" },
};

const MACRO_LABELS: Record<string, { label: string; unit: string }> = {
  KOSPI: { label: "KOSPI", unit: "" },
  KOSDAQ: { label: "KOSDAQ", unit: "" },
  SP500: { label: "S&P500", unit: "" },
  NASDAQ: { label: "NASDAQ", unit: "" },
  USD_KRW: { label: "환율", unit: "원/$" },
  WTI_OIL: { label: "WTI", unit: "$" },
  GOLD: { label: "금", unit: "$" },
  BTC_USD: { label: "비트코인", unit: "$" },
};

function dismissKey(date: string): string {
  return `yg_briefing_dismissed_${date}`;
}

export function MarketBriefingPopup() {
  const [briefing, setBriefing] = useState<Briefing | null>(null);
  const [open, setOpen] = useState(false);
  const [dontShowToday, setDontShowToday] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void fetch("/api/market-briefing/today")
      .then((r) => r.json())
      .then((j: { briefing: Briefing | null }) => {
        if (cancelled || !j.briefing) return;
        // dismiss 체크 (오늘 날짜 기준)
        const today = new Date().toISOString().slice(0, 10);
        const dismissed = localStorage.getItem(dismissKey(today));
        if (dismissed === "1") return;
        // 또는 brief date 자체 기준 (worker가 어제 만들었으면 어제 dismiss 키 사용해도 OK)
        const briefDismissed = localStorage.getItem(dismissKey(j.briefing.date));
        if (briefDismissed === "1") return;

        setBriefing(j.briefing);
        setOpen(true);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const close = () => {
    if (dontShowToday && briefing) {
      localStorage.setItem(dismissKey(briefing.date), "1");
      // 오늘 날짜 키도 같이 (date 다를 수 있음)
      const today = new Date().toISOString().slice(0, 10);
      localStorage.setItem(dismissKey(today), "1");
    }
    setOpen(false);
  };

  if (!open || !briefing) return null;

  const topKeywords = briefing.keywords.slice(0, 6);

  return (
    <div
      onClick={close}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.55)",
        zIndex: 100,
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "center",
        animation: "ygFadeIn 200ms ease",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "var(--yg-bg-card)",
          width: "100%",
          maxWidth: 520,
          borderTopLeftRadius: 24,
          borderTopRightRadius: 24,
          padding: "8px 0 max(20px, env(safe-area-inset-bottom))",
          maxHeight: "85vh",
          overflowY: "auto",
          boxShadow: "var(--yg-shadow-sheet)",
        }}
      >
        {/* Grabber */}
        <div
          style={{
            width: 36,
            height: 4,
            background: "var(--yg-line-strong)",
            borderRadius: 99,
            margin: "6px auto 14px",
          }}
        />

        <div style={{ padding: "0 20px" }}>
          {/* Header */}
          <div style={{ marginBottom: 14 }}>
            <div
              style={{
                fontSize: 12,
                fontWeight: 700,
                color: "var(--yg-up-deep)",
                letterSpacing: "0.04em",
                marginBottom: 4,
              }}
            >
              📊 오늘의 시황
            </div>
            <h2
              style={{
                margin: 0,
                fontSize: 22,
                fontWeight: 800,
                letterSpacing: "-0.025em",
                color: "var(--yg-fg-primary)",
                lineHeight: 1.25,
              }}
            >
              {new Date(briefing.date).toLocaleDateString("ko-KR", {
                month: "long",
                day: "numeric",
                weekday: "short",
              })}{" "}
              시장 브리핑
            </h2>
          </div>

          {/* 요약 */}
          <div
            style={{
              padding: 14,
              background: "var(--yg-bg-sub)",
              borderRadius: 12,
              fontSize: 13.5,
              lineHeight: 1.6,
              fontWeight: 600,
              color: "var(--yg-fg-secondary)",
              marginBottom: 14,
              whiteSpace: "pre-line",
            }}
          >
            {briefing.summary}
          </div>

          {/* Macro snapshot (가로 스크롤) */}
          {Object.keys(briefing.macro_snapshot).length > 0 && (
            <div
              style={{
                display: "flex",
                gap: 8,
                overflowX: "auto",
                paddingBottom: 4,
                marginBottom: 14,
                scrollbarWidth: "none",
              }}
              className="no-scrollbar"
            >
              {Object.entries(briefing.macro_snapshot).map(([k, v]) => {
                const meta = MACRO_LABELS[k] ?? { label: k, unit: "" };
                const up = v.change_pct >= 0;
                return (
                  <div
                    key={k}
                    style={{
                      flex: "0 0 auto",
                      padding: "10px 14px",
                      background: "var(--yg-bg-tint-ink)",
                      borderRadius: 12,
                      minWidth: 92,
                    }}
                  >
                    <div
                      style={{
                        fontSize: 10,
                        fontWeight: 700,
                        color: "var(--yg-fg-tertiary)",
                      }}
                    >
                      {meta.label}
                    </div>
                    <div
                      className="yg-num"
                      style={{
                        fontSize: 13,
                        fontWeight: 800,
                        color: "var(--yg-fg-primary)",
                        marginTop: 2,
                      }}
                    >
                      {v.value.toLocaleString("ko-KR", {
                        maximumFractionDigits: 2,
                      })}
                    </div>
                    <div
                      className="yg-num"
                      style={{
                        fontSize: 10,
                        fontWeight: 700,
                        color: up ? "var(--yg-up-deep)" : "var(--yg-down-deep)",
                        marginTop: 2,
                      }}
                    >
                      {up ? "+" : ""}
                      {v.change_pct.toFixed(2)}%
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* 주요 키워드 */}
          <div style={{ marginBottom: 14 }}>
            <div
              style={{
                fontSize: 11,
                fontWeight: 800,
                color: "var(--yg-fg-tertiary)",
                letterSpacing: "0.04em",
                marginBottom: 8,
              }}
            >
              주요 키워드
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {topKeywords.map((kw) => {
                const c = CATEGORY_META[kw.category] ?? CATEGORY_META.other;
                return (
                  <span
                    key={kw.keyword}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 4,
                      padding: "6px 10px",
                      borderRadius: 99,
                      background: c.bg,
                      color: c.fg,
                      fontSize: 12,
                      fontWeight: 700,
                    }}
                  >
                    <span>{c.emoji}</span>
                    {kw.keyword}
                  </span>
                );
              })}
            </div>
          </div>

          {/* 상세보기 + dismiss */}
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <Link
              href="/app/market-today"
              onClick={() => setOpen(false)}
              className="yg-btn yg-btn-primary"
              style={{
                width: "100%",
                height: 50,
                fontSize: 15,
                textDecoration: "none",
              }}
            >
              상세 보기 →
            </Link>
            <label
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "10px 4px",
                cursor: "pointer",
                fontSize: 13,
                color: "var(--yg-fg-secondary)",
                fontWeight: 600,
              }}
            >
              <input
                type="checkbox"
                checked={dontShowToday}
                onChange={(e) => setDontShowToday(e.target.checked)}
                style={{
                  width: 18,
                  height: 18,
                  accentColor: "var(--yg-brand)",
                  cursor: "pointer",
                }}
              />
              오늘은 다시 보지 않기
            </label>
            <button
              type="button"
              onClick={close}
              className="yg-btn"
              style={{
                width: "100%",
                background: "transparent",
                color: "var(--yg-fg-tertiary)",
                fontSize: 13,
                height: 36,
                fontWeight: 700,
              }}
            >
              닫기
            </button>
          </div>
        </div>
      </div>
      <style jsx>{`
        @keyframes ygFadeIn {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }
      `}</style>
    </div>
  );
}
