"use client";

// Plan #46: 글로벌 리더보드 클라이언트 — 카테고리 탭 + 본인 sticky.

import Link from "next/link";
import { useEffect, useState } from "react";

type Category = "overall" | "return_30d" | "sharpe";

type LeaderboardEntry = {
  rank: number;
  user_id: string | null;
  nickname: string;
  return_overall_pct: number | null;
  return_30d_pct: number | null;
  sharpe_30d: number | null;
  trade_count: number;
  is_me: boolean;
};

type MeEntry = {
  rank: number | null;
  nickname: string;
  return_overall_pct: number | null;
  return_30d_pct: number | null;
  sharpe_30d: number | null;
  trade_count: number;
  qualified: boolean;
};

type Response = {
  category: Category;
  leaderboard: LeaderboardEntry[];
  me: MeEntry | null;
};

const CATEGORIES: { k: Category; l: string; sub: string }[] = [
  { k: "overall", l: "종합", sub: "누적 수익률" },
  { k: "return_30d", l: "이번 달", sub: "30일 수익률" },
  { k: "sharpe", l: "꾸준함", sub: "Sharpe" },
];

function fmtPct(v: number | null): string {
  if (v === null || isNaN(v)) return "—";
  return `${v >= 0 ? "+" : ""}${v.toFixed(2)}%`;
}

function fmtSharpe(v: number | null): string {
  if (v === null || isNaN(v)) return "—";
  return v.toFixed(3);
}

function valueFor(
  e: LeaderboardEntry | MeEntry,
  category: Category,
): { value: string; positive: boolean } {
  if (category === "sharpe") {
    const v = e.sharpe_30d;
    return { value: fmtSharpe(v), positive: (v ?? 0) >= 0 };
  }
  if (category === "return_30d") {
    const v = e.return_30d_pct;
    return { value: fmtPct(v), positive: (v ?? 0) >= 0 };
  }
  const v = e.return_overall_pct;
  return { value: fmtPct(v), positive: (v ?? 0) >= 0 };
}

export function GlobalLeaderboardClient() {
  const [category, setCategory] = useState<Category>("overall");
  const [data, setData] = useState<Response | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    void fetch(`/api/leaderboard/global?category=${category}&limit=100`)
      .then((r) => r.json())
      .then((j: Response) => setData(j))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [category]);

  return (
    <div>
      {/* 카테고리 탭 (handoff pill segmented control) */}
      <div style={{ padding: "8px 20px 0" }}>
        <div
          style={{
            display: "flex",
            background: "var(--yg-bg-tint-ink)",
            borderRadius: 14,
            padding: 4,
          }}
        >
          {CATEGORIES.map((c) => {
            const active = category === c.k;
            return (
              <button
                key={c.k}
                type="button"
                onClick={() => setCategory(c.k)}
                style={{
                  all: "unset",
                  cursor: "pointer",
                  flex: 1,
                  textAlign: "center",
                  padding: "10px 0",
                  borderRadius: 10,
                  background: active ? "var(--yg-bg-card)" : "transparent",
                  color: active
                    ? "var(--yg-fg-primary)"
                    : "var(--yg-fg-tertiary)",
                  fontSize: 13,
                  fontWeight: 800,
                  boxShadow: active
                    ? "0 1px 2px rgba(15,17,21,0.08)"
                    : "none",
                  transition: "background 120ms ease",
                }}
              >
                <div>{c.l}</div>
                <div
                  style={{
                    fontSize: 9,
                    fontWeight: 700,
                    marginTop: 1,
                    opacity: active ? 0.7 : 0.5,
                  }}
                >
                  {c.sub}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* 본인 등수 (sticky 영역) */}
      <div style={{ padding: "12px 20px 0" }}>
        {data?.me ? (
          <MyRow me={data.me} category={category} />
        ) : !loading ? (
          <div
            className="yg-card"
            style={{
              padding: 14,
              background: "var(--yg-bg-tint-ink)",
            }}
          >
            <div
              style={{
                fontSize: 13,
                fontWeight: 700,
                color: "var(--yg-fg-secondary)",
              }}
            >
              아직 리더보드에 참여하지 않았어요
            </div>
            <div
              style={{
                fontSize: 11,
                color: "var(--yg-fg-tertiary)",
                fontWeight: 600,
                marginTop: 2,
                lineHeight: 1.5,
              }}
            >
              자격: 거래 5건 이상, 가입 30일 이상 (이번 달 카테고리는 면제)
            </div>
            <Link
              href="/app/settings"
              style={{
                display: "inline-block",
                marginTop: 10,
                fontSize: 12,
                fontWeight: 700,
                padding: "8px 14px",
                borderRadius: 99,
                background: "var(--yg-brand)",
                color: "var(--yg-fg-on-brand)",
                textDecoration: "none",
              }}
            >
              설정에서 참여하기 →
            </Link>
          </div>
        ) : null}
      </div>

      {/* TOP 100 */}
      <div style={{ padding: "12px 20px 0" }}>
        <div className="yg-card" style={{ padding: 18 }}>
          {loading ? (
            <div
              style={{
                fontSize: 13,
                color: "var(--yg-fg-tertiary)",
                fontWeight: 600,
                textAlign: "center",
                padding: 24,
              }}
            >
              불러오는 중…
            </div>
          ) : !data || data.leaderboard.length === 0 ? (
            <div
              style={{
                fontSize: 13,
                color: "var(--yg-fg-tertiary)",
                fontWeight: 600,
                textAlign: "center",
                padding: 24,
              }}
            >
              아직 자격을 갖춘 사용자가 없어요
              <div
                style={{
                  fontSize: 11,
                  marginTop: 4,
                  color: "var(--yg-fg-tertiary)",
                }}
              >
                매일 04:00 KST 갱신
              </div>
            </div>
          ) : (
            data.leaderboard.map((e, i) => (
              <Row
                key={`${e.rank}-${i}`}
                entry={e}
                category={category}
                isLast={i === data.leaderboard.length - 1}
              />
            ))
          )}
        </div>
      </div>

      <div
        style={{
          fontSize: 11,
          color: "var(--yg-fg-tertiary)",
          fontWeight: 600,
          textAlign: "center",
          padding: "16px 20px 24px",
          lineHeight: 1.6,
        }}
      >
        매일 04:00 KST 갱신 · opt-in 사용자만 표시
        <br />
        자격: 거래 5건 이상 + 가입 30일 이상 (이번 달 면제)
      </div>
    </div>
  );
}

function MyRow({ me, category }: { me: MeEntry; category: Category }) {
  const v = valueFor(me, category);
  return (
    <div
      className="yg-card"
      style={{
        padding: 14,
        background: "var(--yg-brand)",
        color: "var(--yg-fg-on-brand)",
        display: "flex",
        alignItems: "center",
        gap: 12,
      }}
    >
      <div
        style={{
          width: 36,
          height: 36,
          borderRadius: 99,
          background: "rgba(255,255,255,0.18)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontWeight: 800,
          fontSize: 13,
        }}
      >
        {me.rank ?? "—"}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 11, opacity: 0.7, fontWeight: 700 }}>
          내 순위
        </div>
        <div
          style={{
            fontSize: 14,
            fontWeight: 800,
            letterSpacing: "-0.01em",
          }}
        >
          {me.nickname}
          {!me.qualified && (
            <span
              style={{
                fontSize: 10,
                marginLeft: 6,
                padding: "2px 6px",
                background: "rgba(255,255,255,0.18)",
                borderRadius: 4,
                fontWeight: 700,
              }}
            >
              자격 미달
            </span>
          )}
        </div>
      </div>
      <div
        className="yg-num"
        style={{
          fontSize: 18,
          fontWeight: 800,
          letterSpacing: "-0.02em",
        }}
      >
        {v.value}
      </div>
    </div>
  );
}

function Row({
  entry,
  category,
  isLast,
}: {
  entry: LeaderboardEntry;
  category: Category;
  isLast: boolean;
}) {
  const v = valueFor(entry, category);
  const top3 = entry.rank <= 3;
  const medal = entry.rank === 1 ? "🥇" : entry.rank === 2 ? "🥈" : entry.rank === 3 ? "🥉" : null;

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "12px 0",
        borderBottom: isLast ? 0 : "1px solid var(--yg-line-faint)",
        background: entry.is_me ? "var(--yg-bg-tint-red)" : "transparent",
        borderRadius: entry.is_me ? 10 : 0,
        margin: entry.is_me ? "0 -8px" : 0,
        paddingLeft: entry.is_me ? 8 : 0,
        paddingRight: entry.is_me ? 8 : 0,
      }}
    >
      <div
        style={{
          width: 32,
          height: 32,
          borderRadius: 8,
          background: top3
            ? "transparent"
            : entry.is_me
              ? "var(--yg-up)"
              : "var(--yg-bg-tint-ink)",
          color: top3
            ? "var(--yg-fg-primary)"
            : entry.is_me
              ? "#fff"
              : "var(--yg-fg-secondary)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: top3 ? 20 : 13,
          fontWeight: 800,
        }}
      >
        {medal ?? entry.rank}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: 14,
            fontWeight: 800,
            letterSpacing: "-0.01em",
            color: "var(--yg-fg-primary)",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {entry.nickname}
          {entry.is_me && (
            <span
              style={{
                fontSize: 9,
                marginLeft: 6,
                padding: "2px 5px",
                background: "var(--yg-up)",
                color: "#fff",
                borderRadius: 4,
                fontWeight: 800,
                letterSpacing: "0.04em",
              }}
            >
              ME
            </span>
          )}
        </div>
        <div
          className="yg-num"
          style={{
            fontSize: 10,
            color: "var(--yg-fg-tertiary)",
            fontWeight: 600,
            marginTop: 2,
          }}
        >
          거래 {entry.trade_count}건
        </div>
      </div>
      <div
        className="yg-num"
        style={{
          fontSize: 15,
          fontWeight: 800,
          letterSpacing: "-0.02em",
          color: v.positive ? "var(--yg-up-deep)" : "var(--yg-down-deep)",
        }}
      >
        {v.value}
      </div>
    </div>
  );
}
