"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Flame } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ETF_CATEGORY_LABEL } from "@/lib/etf-labels";
import type { TradingLeader } from "@/lib/trading-leaders";
import { formatTradingValue } from "@/lib/trading-leaders";

type Result = {
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
  stock: {
    kr: TradingLeader[];
    us: TradingLeader[];
  };
  etf: {
    kr: TradingLeader[];
    us: TradingLeader[];
  };
};

const KRW = new Intl.NumberFormat("ko-KR", {
  style: "currency",
  currency: "KRW",
  maximumFractionDigits: 0,
});
const USD = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });

function formatPrice(price: number | null, currency: string): string {
  if (price == null) return "—";
  return currency === "KRW" ? KRW.format(price) : USD.format(price);
}

export function StockSearch({ trending }: { trending?: TrendingData }) {
  const [q, setQ] = useState("");
  const [instrument, setInstrument] = useState<"all" | "stock" | "etf">("all");
  const [results, setResults] = useState<Result[]>([]);
  const [loading, setLoading] = useState(false);
  const [showLookup, setShowLookup] = useState(false);
  const [lookupError, setLookupError] = useState<string | null>(null);

  useEffect(() => {
    const trimmed = q.trim();
    // q 비어있으면 setState 안 함 — 검색 영역은 isSearching으로 숨김 처리됨
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
    setLookupError(null);
    setLoading(true);
    const res = await fetch("/api/stocks/lookup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ symbol: q.trim() }),
    });
    setLoading(false);
    if (res.ok) {
      const r = (await res.json()) as Result;
      setResults([r]);
      setShowLookup(false);
    } else if (res.status === 404) {
      setLookupError("해당 심볼을 찾을 수 없습니다.");
    } else {
      setLookupError("워커 응답 실패. 잠시 후 다시 시도해주세요.");
    }
  }

  const isSearching = q.trim().length > 0;

  return (
    <div className="space-y-4">
      <Input
        type="search"
        placeholder="종목명 또는 심볼 (예: 삼성전자, AAPL, SPY, KODEX 200)"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        autoFocus
      />
      {/* 타입 필터 */}
      <div className="flex gap-1.5">
        {(["all", "stock", "etf"] as const).map((opt) => {
          const label = opt === "all" ? "전체" : opt === "stock" ? "주식" : "ETF";
          return (
            <button
              key={opt}
              type="button"
              onClick={() => setInstrument(opt)}
              className={`text-xs rounded-md border px-2.5 py-1 transition-colors ${
                instrument === opt
                  ? "border-primary bg-primary/10 text-primary font-semibold"
                  : "hover:bg-accent"
              }`}
            >
              {label}
            </button>
          );
        })}
      </div>

      {loading && <div className="text-sm text-muted-foreground">검색 중...</div>}

      {/* 검색 결과 */}
      {isSearching && (
        <ul className="space-y-2">
          {results.map((r) => (
            <li key={r.symbol}>
              <Link href={`/app/trade/${encodeURIComponent(r.symbol)}`}>
                <Card className="hover:bg-muted/30 transition">
                  <CardContent className="py-3 flex items-center justify-between">
                    <div>
                      <div className="font-medium flex items-center gap-1.5">
                        {r.name_ko ?? r.name}
                        {r.instrument_type === "etf" && (
                          <span className="text-[10px] rounded border border-primary/40 bg-primary/10 text-primary px-1 py-0.5 font-semibold">
                            ETF
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {r.symbol} · {r.market}
                        {r.instrument_type === "etf" && r.etf_category && (
                          <>
                            {" · "}
                            {ETF_CATEGORY_LABEL[r.etf_category] ?? r.etf_category}
                          </>
                        )}
                        {r.fund_family && <> · {r.fund_family}</>}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-mono">{formatPrice(r.last_price, r.currency)}</div>
                      <div className="text-xs text-muted-foreground">{r.currency}</div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      )}

      {/* 비검색 상태 — 거래대금 상위 카테고리별 */}
      {!isSearching && trending && (
        <TrendingSection instrument={instrument} trending={trending} />
      )}

      {isSearching && showLookup && (
        <div className="text-sm text-muted-foreground space-y-2">
          <div>로컬 캐시에 없는 종목입니다.</div>
          <Button variant="outline" onClick={adHocLookup} disabled={loading}>
            &quot;{q.trim()}&quot;을(를) Yahoo Finance에서 직접 조회
          </Button>
          {lookupError && <div className="text-destructive text-xs">{lookupError}</div>}
        </div>
      )}
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
  // instrument별로 보여줄 그룹 구성
  const groups: { title: string; items: TradingLeader[] }[] = (() => {
    if (instrument === "all") {
      return [
        { title: "🇰🇷 국내 주식 거래대금 TOP", items: trending.all.krStock },
        { title: "🇺🇸 미국 주식 거래대금 TOP", items: trending.all.usStock },
        { title: "🇰🇷 국내 ETF 거래대금 TOP", items: trending.all.krEtf },
        { title: "🇺🇸 미국 ETF 거래대금 TOP", items: trending.all.usEtf },
      ];
    }
    if (instrument === "stock") {
      return [
        { title: "🇰🇷 국내 주식 거래대금 TOP", items: trending.stock.kr },
        { title: "🇺🇸 미국 주식 거래대금 TOP", items: trending.stock.us },
      ];
    }
    return [
      { title: "🇰🇷 국내 ETF 거래대금 TOP", items: trending.etf.kr },
      { title: "🇺🇸 미국 ETF 거래대금 TOP", items: trending.etf.us },
    ];
  })();

  return (
    <div className="space-y-4">
      {groups.map((group) => (
        <Card key={group.title}>
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <Flame className="h-4 w-4 text-orange-500" />
              {group.title}
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            {group.items.length === 0 ? (
              <div className="text-xs text-muted-foreground py-2">
                아직 데이터 없음 — worker 부팅 후 일봉 수집 필요
              </div>
            ) : (
              <div className="space-y-0.5">
                {group.items.map((r, idx) => {
                  const name = r.name_ko ?? r.name;
                  return (
                    <Link
                      key={r.symbol}
                      href={`/app/trade/${encodeURIComponent(r.symbol)}`}
                      className="flex items-center justify-between gap-2 rounded p-2 hover:bg-muted/30 transition-colors"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-xs text-muted-foreground w-4 flex-shrink-0 tabular-nums">
                          {idx + 1}
                        </span>
                        <div className="min-w-0">
                          <div className="text-sm font-medium truncate flex items-center gap-1.5">
                            {name}
                            {r.instrument_type === "etf" && (
                              <span className="text-[9px] rounded border border-primary/40 bg-primary/10 text-primary px-1 py-0.5 font-semibold flex-shrink-0">
                                ETF
                              </span>
                            )}
                          </div>
                          <div className="text-[10px] text-muted-foreground truncate">
                            {r.symbol}
                            {r.fund_family && <> · {r.fund_family}</>}
                          </div>
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <div className="font-mono text-sm tabular-nums">
                          {formatPrice(r.last_price, r.currency)}
                        </div>
                        <div className="text-[10px] text-muted-foreground tabular-nums">
                          {formatTradingValue(r.trading_value, r.currency)}
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
