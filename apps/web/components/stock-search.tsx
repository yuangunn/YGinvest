"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

type Result = {
  symbol: string;
  name: string;
  name_ko: string | null;
  market: string;
  currency: string;
  last_price: number | null;
};

const KRW = new Intl.NumberFormat("ko-KR", { style: "currency", currency: "KRW", maximumFractionDigits: 0 });
const USD = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });

function formatPrice(price: number | null, currency: string): string {
  if (price == null) return "—";
  return currency === "KRW" ? KRW.format(price) : USD.format(price);
}

export function StockSearch() {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Result[]>([]);
  const [loading, setLoading] = useState(false);
  const [showLookup, setShowLookup] = useState(false);
  const [lookupError, setLookupError] = useState<string | null>(null);

  useEffect(() => {
    if (q.trim().length === 0) {
      setResults([]);
      setShowLookup(false);
      return;
    }
    setLoading(true);
    const t = setTimeout(async () => {
      const res = await fetch(`/api/stocks/search?q=${encodeURIComponent(q)}`);
      const json = await res.json();
      setResults(json.results ?? []);
      setShowLookup((json.results ?? []).length === 0);
      setLoading(false);
    }, 250);
    return () => clearTimeout(t);
  }, [q]);

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
        placeholder="종목명 또는 심볼 (예: 삼성전자, AAPL, 005930)"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        autoFocus
      />
      {loading && <div className="text-sm text-muted-foreground">검색 중...</div>}
      <ul className="space-y-2">
        {results.map((r) => (
          <li key={r.symbol}>
            <Link href={`/app/trade/${encodeURIComponent(r.symbol)}`}>
              <Card className="hover:bg-muted/30 transition">
                <CardContent className="py-3 flex items-center justify-between">
                  <div>
                    <div className="font-medium">{r.name_ko ?? r.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {r.symbol} · {r.market}
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
