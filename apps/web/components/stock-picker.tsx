"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
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

type Bounds = { top: number; left: number; width: number };

/**
 * 종목명/심볼 어느쪽이든 검색해서 선택할 수 있는 reusable picker.
 *
 * - `/api/stocks/search`로 디바운스 검색 (250ms)
 * - 드롭다운은 Portal로 document.body에 렌더 → 부모의 `overflow-hidden`
 *   (shadcn Card 등) 영향 받지 않음
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
  const [bounds, setBounds] = useState<Bounds | null>(null);
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

  // 드롭다운 위치 계산 — 부모 overflow에 영향받지 않도록 fixed positioning + bounding rect
  useEffect(() => {
    if (!open) return;
    function update() {
      if (wrapRef.current) {
        const r = wrapRef.current.getBoundingClientRect();
        setBounds({
          top: r.bottom + 4,
          left: r.left,
          width: r.width,
        });
      }
    }
    update();
    window.addEventListener("scroll", update, true);
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update, true);
      window.removeEventListener("resize", update);
    };
  }, [open]);

  // 바깥 클릭 → 드롭다운 닫기 (portal에 렌더된 dropdown도 포함하려면 ref 체크)
  useEffect(() => {
    function onClick(e: MouseEvent) {
      const target = e.target as Node;
      // wrapRef 안쪽 클릭은 무시
      if (wrapRef.current && wrapRef.current.contains(target)) return;
      // dropdown 내부 클릭은 dropdown 자체가 처리 (pick) → 바깥 클릭은 닫기
      const dropdown = document.getElementById("stock-picker-dropdown");
      if (dropdown && dropdown.contains(target)) return;
      setOpen(false);
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

  // open + bounds 모두 user interaction 이후에만 truthy → SSR에선 항상 false
  // (createPortal은 client side에서만 호출됨)
  const dropdown =
    open && !value && bounds && typeof document !== "undefined"
      ? createPortal(
          <ul
            id="stock-picker-dropdown"
            style={{
              position: "fixed",
              top: bounds.top,
              left: bounds.left,
              width: bounds.width,
              zIndex: 60,
              maxHeight: "18rem",
            }}
            className="overflow-y-auto rounded-md border bg-background shadow-lg"
          >
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
          </ul>,
          document.body,
        )
      : null;

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
      {dropdown}
    </div>
  );
}
