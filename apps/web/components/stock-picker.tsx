"use client";

import { useEffect, useRef, useState } from "react";
import { Check, X } from "lucide-react";
import { Input } from "@/components/ui/input";

type SearchResult = {
  symbol: string;
  name: string;
  name_ko: string | null;
  market: string;
  currency: string;
  last_price: number | null;
};

export type PickedStock = {
  symbol: string;
  name: string;
};

/**
 * 종목명/심볼 어느쪽이든 검색해서 선택할 수 있는 reusable picker.
 *
 * - `/api/stocks/search`로 디바운스 검색 (250ms)
 * - 결과 클릭 시 onChange({symbol, name})
 * - 선택된 상태에서는 chip 형태로 표시 (X 버튼으로 해제)
 */
export function StockPicker({
  value,
  onChange,
  placeholder = "종목명 또는 심볼 (예: 삼성전자, AAPL)",
  className = "",
}: {
  value: PickedStock | null;
  onChange: (v: PickedStock | null) => void;
  placeholder?: string;
  className?: string;
}) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  // 디바운스 검색 — setState는 모두 setTimeout 콜백 내부(비동기)에서 호출해
  // React 19 react-hooks/set-state-in-effect 규칙 회피.
  useEffect(() => {
    const t = setTimeout(async () => {
      const trimmed = q.trim();
      if (trimmed.length === 0) {
        setResults([]);
        setOpen(false);
        setLoading(false);
        return;
      }
      setLoading(true);
      try {
        const res = await fetch(
          `/api/stocks/search?q=${encodeURIComponent(trimmed)}`,
        );
        if (!res.ok) {
          setResults([]);
          return;
        }
        const json = (await res.json()) as { results?: SearchResult[] };
        setResults(json.results ?? []);
        setOpen(true);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 250);
    return () => clearTimeout(t);
  }, [q]);

  // 바깥 클릭 → 드롭다운 닫기
  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  function pick(r: SearchResult) {
    onChange({ symbol: r.symbol, name: r.name_ko ?? r.name });
    setQ("");
    setResults([]);
    setOpen(false);
  }

  function clear() {
    onChange(null);
    setQ("");
    setResults([]);
  }

  return (
    <div ref={wrapRef} className={`relative ${className}`}>
      {value ? (
        <div className="flex items-center gap-2 h-10 px-3 rounded-md border bg-background">
          <div className="flex-1 min-w-0 truncate text-sm">
            <span className="font-medium">{value.name}</span>
            <span className="text-xs text-muted-foreground ml-2">
              {value.symbol}
            </span>
          </div>
          <button
            type="button"
            onClick={clear}
            className="text-muted-foreground hover:text-foreground"
            aria-label="종목 변경"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ) : (
        <Input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={placeholder}
          onFocus={() => {
            if (results.length > 0) setOpen(true);
          }}
          autoComplete="off"
        />
      )}
      {open && !value && (
        <ul className="absolute z-20 top-full left-0 right-0 mt-1 max-h-72 overflow-y-auto rounded-md border bg-background shadow-md">
          {loading && (
            <li className="px-3 py-2 text-xs text-muted-foreground">
              검색 중...
            </li>
          )}
          {!loading && results.length === 0 && (
            <li className="px-3 py-2 text-xs text-muted-foreground">
              결과 없음 — 다른 키워드로 시도해보세요
            </li>
          )}
          {results.map((r) => (
            <li key={r.symbol}>
              <button
                type="button"
                onClick={() => pick(r)}
                className="w-full text-left px-3 py-2 hover:bg-accent flex items-center justify-between gap-2 group"
              >
                <div className="min-w-0">
                  <div className="text-sm font-medium truncate">
                    {r.name_ko ?? r.name}
                  </div>
                  <div className="text-[10px] text-muted-foreground">
                    {r.symbol} · {r.market}
                  </div>
                </div>
                <Check className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 flex-shrink-0" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
