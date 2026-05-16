"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ETF_CATEGORY_LABEL } from "@/lib/etf-labels";

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

const KRW = new Intl.NumberFormat("ko-KR", { style: "currency", currency: "KRW", maximumFractionDigits: 0 });
const USD = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });

function formatPrice(price: number | null, currency: string): string {
  if (price == null) return "—";
  return currency === "KRW" ? KRW.format(price) : USD.format(price);
}

export function StockSearch() {
  const [q, setQ] = useState("");
  // Plan #32: 종목 타입 필터
  const [instrument, setInstrument] = useState<"all" | "stock" | "etf">("all");
  const [results, setResults] = useState<Result[]>([]);
  const [loading, setLoading] = useState(false);
  const [showLookup, setShowLookup] = useState(false);
  const [lookupError, setLookupError] = useState<string | null>(null);

  useEffect(() => {
    const t = setTimeout(async () => {
      const trimmed = q.trim();
      if (trimmed.length === 0) {
        setResults([]);
        setShowLookup(false);
        setLoading(false);
        return;
      }
      setLoading(true);
      const res = await fetch(
        `/api/stocks/search?q=${encodeURIComponent(trimmed)}&instrument=${instrument}`,
      );
      const json = await res.json();
      setResults(json.results ?? []);
      setShowLookup((json.results ?? []).length === 0);
      setLoading(false);
    }, 250);
    return () => clearTimeout(t);
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

  return (
    <div className="space-y-4">
      <Input
        type="search"
        placeholder="종목명 또는 심볼 (예: 삼성전자, AAPL, SPY, KODEX 200)"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        autoFocus
      />
      {/* Plan #32: 타입 필터 */}
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
      {showLookup && q.trim().length > 0 && (
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
