"use client";

// Plan #44: YG 종목 검색 — Toss 스타일 trending + 인풋 + 결과.

import { useEffect, useState } from "react";
import Link from "next/link";
import { YGIcon } from "@/components/yg/icon";
import { PillTabs } from "@/components/yg/pill-tabs";
import { TickerBadge } from "@/components/yg/ticker-badge";
import { fmt } from "@/lib/yg-fmt";
import type { TradingLeader } from "@/lib/trading-leaders";

type SearchResult = {
  symbol: string;
  name: string;
  name_ko: string | null;
  market: string;
  currency: string;
  last_price: number | null;
  instrument_type?: "stock" | "etf";
  etf_category?: string | null;
  fund_family?: string | null;
};

type TrendingData = {
  all: {
    krStock: TradingLeader[];
    usStock: TradingLeader[];
    krEtf: TradingLeader[];
    usEtf: TradingLeader[];
  };
  stock: { kr: TradingLeader[]; us: TradingLeader[] };
  etf: { kr: TradingLeader[]; us: TradingLeader[] };
};

const FILTER_TABS = [
  { k: "all", l: "전체" },
  { k: "stock", l: "주식" },
  { k: "etf", l: "ETF" },
] as const;

export function YGStockSearch({ trending }: { trending: TrendingData }) {
  const [q, setQ] = useState("");
  const [instrument, setInstrument] = useState<"all" | "stock" | "etf">("all");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [showLookup, setShowLookup] = useState(false);

  useEffect(() => {
    const trimmed = q.trim();
    if (trimmed.length === 0) return;
    let cancelled = false;
    const t = setTimeout(async () => {
      if (cancelled) return;
      setLoading(true);
      try {
        const res = await fetch(
          `/api/stocks/search?q=${encodeURIComponent(trimmed)}&instrument=${instrument}`,
        );
        const json = await res.json();
        if (cancelled) return;
        setResults(json.results ?? []);
        setShowLookup((json.results ?? []).length === 0);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [q, instrument]);

  async function adHocLookup() {
    setLoading(true);
    try {
      const res = await fetch("/api/stocks/lookup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ symbol: q.trim() }),
      });
      if (res.ok) {
        const r = (await res.json()) as SearchResult;
        setResults([r]);
        setShowLookup(false);
      }
    } finally {
      setLoading(false);
    }
  }

  const isSearching = q.trim().length > 0;

  return (
    <div>
      {/* 검색 인풋 (큰 yg-sub 패널) */}
      <div style={{ padding: "12px 16px 0" }}>
        <div
          style={{
            background: "var(--yg-bg-tint-ink)",
            borderRadius: 14,
            padding: "14px 16px",
            display: "flex",
            alignItems: "center",
            gap: 10,
          }}
        >
          <YGIcon.Search s={20} c="var(--yg-fg-tertiary)" />
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="종목명 또는 티커"
            autoFocus
            style={{
              all: "unset",
              flex: 1,
              fontSize: 15,
              fontWeight: 600,
              color: "var(--yg-fg-primary)",
              letterSpacing: "-0.01em",
            }}
          />
          {q && (
            <button
              type="button"
              onClick={() => setQ("")}
              style={{
                all: "unset",
                cursor: "pointer",
                color: "var(--yg-fg-tertiary)",
                display: "inline-flex",
              }}
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* 필터 탭 */}
      <div style={{ padding: "14px 20px 4px" }}>
        <PillTabs
          items={FILTER_TABS}
          value={instrument}
          onChange={(k) => setInstrument(k as "all" | "stock" | "etf")}
        />
      </div>

      {loading && (
        <div
          style={{
            padding: "12px 20px",
            fontSize: 13,
            color: "var(--yg-fg-tertiary)",
          }}
        >
          검색 중…
        </div>
      )}

      {/* 검색 결과 */}
      {isSearching && results.length > 0 && (
        <div style={{ padding: "12px 16px 0" }}>
          <div className="yg-card" style={{ padding: 18 }}>
            {results.map((r, i) => {
              const name = r.name_ko ?? r.name;
              const isLast = i === results.length - 1;
              return (
                <Link
                  key={r.symbol}
                  href={`/app/trade/${encodeURIComponent(r.symbol)}`}
                  className="yg-row yg-tap"
                  style={{
                    borderBottom: isLast ? 0 : "1px solid var(--yg-line-faint)",
                    textDecoration: "none",
                    color: "var(--yg-fg-primary)",
                  }}
                >
                  <TickerBadge symbol={r.symbol.slice(0, 3)} size={36} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        fontSize: 14,
                        fontWeight: 700,
                        letterSpacing: "-0.01em",
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                      }}
                    >
                      {name}
                      {r.instrument_type === "etf" && (
                        <span
                          style={{
                            fontSize: 9,
                            fontWeight: 800,
                            background: "var(--yg-bg-tint-ink)",
                            padding: "2px 5px",
                            borderRadius: 4,
                            color: "var(--yg-fg-tertiary)",
                            letterSpacing: "0.04em",
                          }}
                        >
                          ETF
                        </span>
                      )}
                    </div>
                    <div
                      className="yg-num"
                      style={{
                        fontSize: 11,
                        color: "var(--yg-fg-tertiary)",
                        fontWeight: 600,
                        marginTop: 2,
                      }}
                    >
                      {r.symbol} · {r.market}
                      {r.fund_family && <> · {r.fund_family}</>}
                    </div>
                  </div>
                  <div style={{ textAlign: "right", minWidth: 80 }}>
                    <div
                      className="yg-num"
                      style={{ fontSize: 14, fontWeight: 800 }}
                    >
                      {r.last_price
                        ? r.currency === "KRW"
                          ? fmt.krw(r.last_price)
                          : fmt.usd(r.last_price)
                        : "—"}
                    </div>
                    <div
                      style={{
                        fontSize: 11,
                        color: "var(--yg-fg-tertiary)",
                        fontWeight: 600,
                      }}
                    >
                      {r.currency}
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {isSearching && showLookup && !loading && (
        <div style={{ padding: "12px 20px" }}>
          <div className="yg-card" style={{ padding: 18 }}>
            <div
              style={{
                fontSize: 13,
                color: "var(--yg-fg-secondary)",
                marginBottom: 10,
              }}
            >
              로컬 캐시에 없는 종목이에요. Yahoo에서 직접 조회할까요?
            </div>
            <button
              type="button"
              onClick={adHocLookup}
              className="yg-btn yg-btn-secondary"
              style={{ height: 44, width: "100%" }}
            >
              &quot;{q.trim()}&quot; 조회하기
            </button>
          </div>
        </div>
      )}

      {/* 비검색: trending */}
      {!isSearching && (
        <TrendingSection instrument={instrument} trending={trending} />
      )}

      <div style={{ height: 24 }} />
    </div>
  );
}

function TrendingSection({
  instrument,
  trending,
}: {
  instrument: "all" | "stock" | "etf";
  trending: TrendingData;
}) {
  type Group = { title: string; items: TradingLeader[] };
  const groups: Group[] = (() => {
    if (instrument === "all") {
      return [
        { title: "국내 주식 · 거래대금", items: trending.all.krStock },
        { title: "미국 주식 · 거래대금", items: trending.all.usStock },
        { title: "국내 ETF · 거래대금", items: trending.all.krEtf },
        { title: "미국 ETF · 거래대금", items: trending.all.usEtf },
      ];
    }
    if (instrument === "stock") {
      return [
        { title: "국내 주식 · 거래대금", items: trending.stock.kr },
        { title: "미국 주식 · 거래대금", items: trending.stock.us },
      ];
    }
    return [
      { title: "국내 ETF · 거래대금", items: trending.etf.kr },
      { title: "미국 ETF · 거래대금", items: trending.etf.us },
    ];
  })();

  return (
    <div style={{ padding: "20px 16px 0" }}>
      {groups.map((group, gi) => (
        <div key={gi} style={{ marginBottom: 14 }}>
          <div
            style={{
              fontSize: 12,
              fontWeight: 800,
              color: "var(--yg-fg-tertiary)",
              letterSpacing: "0.04em",
              marginBottom: 10,
              padding: "0 4px",
            }}
          >
            {group.title}
          </div>
          {group.items.length === 0 ? (
            <div
              className="yg-card"
              style={{
                padding: 18,
                fontSize: 12,
                color: "var(--yg-fg-tertiary)",
              }}
            >
              아직 데이터가 없어요
            </div>
          ) : (
            <div className="yg-card" style={{ padding: 18 }}>
              {group.items.map((r, i) => {
                const name = r.name_ko ?? r.name;
                return (
                  <Link
                    key={r.symbol}
                    href={`/app/trade/${encodeURIComponent(r.symbol)}`}
                    className="yg-row yg-tap"
                    style={{
                      borderBottom:
                        i === group.items.length - 1
                          ? 0
                          : "1px solid var(--yg-line-faint)",
                      textDecoration: "none",
                      color: "var(--yg-fg-primary)",
                    }}
                  >
                    <span
                      className="yg-num"
                      style={{
                        width: 18,
                        fontSize: 13,
                        fontWeight: 800,
                        color:
                          i < 3
                            ? "var(--yg-up-deep)"
                            : "var(--yg-fg-tertiary)",
                      }}
                    >
                      {i + 1}
                    </span>
                    <TickerBadge symbol={r.symbol.slice(0, 3)} size={34} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        style={{
                          fontSize: 14,
                          fontWeight: 700,
                          letterSpacing: "-0.01em",
                        }}
                      >
                        {name}
                      </div>
                      <div
                        className="yg-num"
                        style={{
                          fontSize: 11,
                          color: "var(--yg-fg-tertiary)",
                          fontWeight: 600,
                          marginTop: 2,
                        }}
                      >
                        {r.symbol}
                      </div>
                    </div>
                    <div style={{ textAlign: "right", minWidth: 80 }}>
                      <div
                        className="yg-num"
                        style={{ fontSize: 14, fontWeight: 800 }}
                      >
                        {r.last_price
                          ? r.currency === "KRW"
                            ? fmt.krw(r.last_price)
                            : fmt.usd(r.last_price)
                          : "—"}
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
