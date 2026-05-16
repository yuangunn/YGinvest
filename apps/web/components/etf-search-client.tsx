"use client";

// Plan #32: Yahoo Finance 검색 + ETF 추가 클라이언트 컴포넌트.

import { useState } from "react";
import { Search, Plus, Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

type SearchResult = {
  symbol: string;
  name: string;
  exchange: string | null;
  already_added: boolean;
  instrument_type: string | null;
};

export function EtfSearchClient() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [adding, setAdding] = useState<string | null>(null);
  const [addedSymbols, setAddedSymbols] = useState<Set<string>>(new Set());

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!query.trim() || query.trim().length < 2) return;
    setSearching(true);
    setResults([]);
    try {
      const res = await fetch(
        `/api/admin/etf-search?q=${encodeURIComponent(query.trim())}`,
      );
      const data = await res.json();
      if (!res.ok) {
        toast.error(`검색 실패: ${data.error ?? res.status}`);
        return;
      }
      setResults(data.quotes ?? []);
      if ((data.quotes ?? []).length === 0) {
        toast.info("ETF 결과 없음 — 검색어를 바꿔보세요");
      }
    } catch (err) {
      toast.error(
        `검색 오류: ${err instanceof Error ? err.message : String(err)}`,
      );
    } finally {
      setSearching(false);
    }
  }

  async function handleAdd(symbol: string) {
    setAdding(symbol);
    try {
      const res = await fetch("/api/admin/etf-add", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ symbol }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(`추가 실패: ${data.error ?? res.status}`);
        return;
      }
      if (data.already_added) {
        toast.info(`${symbol} 이미 추가됨`);
      } else {
        toast.success(`${symbol} 추가됨 (${data.market}, ${data.currency})`);
      }
      setAddedSymbols((prev) => new Set(prev).add(symbol));
    } catch (err) {
      toast.error(
        `추가 오류: ${err instanceof Error ? err.message : String(err)}`,
      );
    } finally {
      setAdding(null);
    }
  }

  return (
    <div className="space-y-3">
      <form onSubmit={handleSearch} className="flex gap-2">
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="SPY, KODEX 200, ARK 등..."
          className="flex-1"
        />
        <Button type="submit" disabled={searching || query.trim().length < 2}>
          {searching ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Search className="h-4 w-4" />
          )}
          검색
        </Button>
      </form>

      {results.length > 0 && (
        <div className="space-y-1">
          {results.map((r) => {
            const wasAdded = addedSymbols.has(r.symbol) || r.already_added;
            return (
              <div
                key={r.symbol}
                className="flex items-center justify-between gap-2 rounded-lg border p-2.5"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-semibold">
                      {r.symbol}
                    </span>
                    {r.exchange && (
                      <span className="text-[10px] text-muted-foreground">
                        {r.exchange}
                      </span>
                    )}
                  </div>
                  <div className="text-sm truncate">{r.name}</div>
                </div>
                <Button
                  variant={wasAdded ? "outline" : "default"}
                  size="sm"
                  disabled={wasAdded || adding === r.symbol}
                  onClick={() => handleAdd(r.symbol)}
                >
                  {adding === r.symbol ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : wasAdded ? (
                    <>
                      <Check className="h-3 w-3" />
                      추가됨
                    </>
                  ) : (
                    <>
                      <Plus className="h-3 w-3" />
                      추가
                    </>
                  )}
                </Button>
              </div>
            );
          })}
        </div>
      )}

      <p className="text-[11px] text-muted-foreground">
        💡 Yahoo Finance에서 ETF 카테고리 결과만 표시. 추가 후 다음 새벽
        05:45 KST에 운용보수·AUM·구성종목 자동 채워짐.
      </p>
    </div>
  );
}
