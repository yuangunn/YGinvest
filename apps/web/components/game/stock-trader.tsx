"use client";

// Plan #33: 게임 내 주식 매매 — 본 앱 종목 시세 그대로 사용, 잔고는 분리.

import { useState, useEffect } from "react";
import { Search, ArrowUp, ArrowDown, Sparkles } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { GAME_FX_USD_KRW } from "@/lib/fx";

type Holding = {
  symbol: string;
  quantity: number;
  avg_cost: number;
  current_price: number | null;
  name: string;
  name_ko: string | null;
  currency: string;
};

type SearchResult = {
  symbol: string;
  name: string;
  name_ko: string | null;
  market: string;
  currency: string;
  last_price: number | null;
  instrument_type?: "stock" | "etf";
};

const KRW = new Intl.NumberFormat("ko-KR", {
  style: "currency",
  currency: "KRW",
  maximumFractionDigits: 0,
});
const FX_USD_KRW = GAME_FX_USD_KRW;

function priceKrw(price: number | null, currency: string): number {
  if (price == null) return 0;
  return currency === "KRW" ? price : price * FX_USD_KRW;
}

export function StockTrader({
  characterCash,
  onTrade,
}: {
  characterCash: number;
  onTrade: () => void;
}) {
  const [holdings, setHoldings] = useState<Holding[]>([]);
  const [q, setQ] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [selected, setSelected] = useState<SearchResult | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [submitting, setSubmitting] = useState(false);

  async function loadHoldings() {
    const res = await fetch("/api/game/holdings");
    if (!res.ok) return;
    const data = await res.json();
    setHoldings(data.holdings ?? []);
  }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await fetch("/api/game/holdings");
      if (!res.ok || cancelled) return;
      const data = await res.json();
      if (!cancelled) setHoldings(data.holdings ?? []);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const trimmed = q.trim();
    if (trimmed.length === 0) return;
    let cancelled = false;
    const t = setTimeout(async () => {
      const res = await fetch(
        `/api/stocks/search?q=${encodeURIComponent(trimmed)}&instrument=all`,
      );
      const data = await res.json();
      if (!cancelled) setSearchResults(data.results ?? []);
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [q]);

  async function executeTrade(side: "buy" | "sell") {
    if (!selected) {
      toast.error("종목을 선택해주세요");
      return;
    }
    if (quantity <= 0) {
      toast.error("수량은 1 이상");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/game/trade", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ symbol: selected.symbol, side, quantity }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(`${side === "buy" ? "매수" : "매도"} 실패: ${data.error}`);
        return;
      }
      if (side === "sell" && data.profit != null) {
        const pct = (data.profit_pct * 100).toFixed(2);
        toast.success(
          `매도 완료: ${data.profit >= 0 ? "+" : ""}${KRW.format(data.profit)} (${pct}%)`,
        );
      } else {
        toast.success(`${side === "buy" ? "매수" : "매도"} 완료`);
      }
      setSelected(null);
      setQ("");
      setSearchResults([]);
      setQuantity(1);
      loadHoldings();
      onTrade();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-3">
      {/* 보유 종목 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm flex items-center justify-between">
            <span>📊 보유 종목</span>
            <span className="text-xs font-normal text-muted-foreground">
              현금 {KRW.format(characterCash)}
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {holdings.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              보유 종목 없음. 아래에서 검색해서 매수 시작
            </p>
          ) : (
            <div className="space-y-1.5">
              {holdings.map((h) => {
                const currentKrw = priceKrw(h.current_price, h.currency);
                const profit = (currentKrw - h.avg_cost) * h.quantity;
                const profitPct =
                  ((currentKrw - h.avg_cost) / h.avg_cost) * 100;
                const isUp = profit >= 0;
                return (
                  <div
                    key={h.symbol}
                    className="rounded-md border p-2.5 space-y-1"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-sm font-medium">{h.name_ko ?? h.name}</div>
                        <div className="text-[10px] text-muted-foreground font-mono">
                          {h.symbol} · {h.quantity}주 · 평단 {KRW.format(h.avg_cost)}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-mono text-sm">{KRW.format(currentKrw)}</div>
                        <div
                          className={`text-[10px] font-semibold ${isUp ? "text-emerald-600 dark:text-emerald-400" : "text-red-500"}`}
                        >
                          {isUp ? "+" : ""}
                          {profitPct.toFixed(2)}% ({isUp ? "+" : ""}
                          {KRW.format(profit)})
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <Button
                        size="sm"
                        variant="outline"
                        className="flex-1 text-xs"
                        onClick={() => {
                          setSelected({
                            symbol: h.symbol,
                            name: h.name,
                            name_ko: h.name_ko,
                            market: "",
                            currency: h.currency,
                            last_price: h.current_price,
                          });
                          setQuantity(h.quantity); // 전량 매도 기본
                        }}
                      >
                        <ArrowDown className="h-3 w-3 mr-1" /> 매도
                      </Button>
                    </div>
                    {profitPct >= 5 && (
                      <div className="text-[10px] text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                        <Sparkles className="h-3 w-3" />
                        +5% 이상! 매도하고 환생 점프 가능 🚀
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 검색 + 매매 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">🔍 종목 검색 / 매수</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="삼성전자, AAPL, SPY..."
              className="pl-7 text-sm"
            />
          </div>

          {searchResults.length > 0 && !selected && (
            <div className="space-y-1 max-h-48 overflow-y-auto">
              {searchResults.slice(0, 8).map((r) => (
                <button
                  key={r.symbol}
                  type="button"
                  onClick={() => setSelected(r)}
                  className="w-full text-left flex items-center justify-between rounded border p-2 hover:bg-accent transition-colors"
                >
                  <div>
                    <div className="text-sm font-medium flex items-center gap-1.5">
                      {r.name_ko ?? r.name}
                      {r.instrument_type === "etf" && (
                        <span className="text-[9px] rounded border border-primary/40 bg-primary/10 text-primary px-1 py-0.5">
                          ETF
                        </span>
                      )}
                    </div>
                    <div className="text-[10px] text-muted-foreground">{r.symbol}</div>
                  </div>
                  <div className="font-mono text-xs">
                    {KRW.format(priceKrw(r.last_price, r.currency))}
                  </div>
                </button>
              ))}
            </div>
          )}

          {selected && (
            <div className="border rounded-lg p-3 space-y-2 bg-muted/30">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-semibold">
                    {selected.name_ko ?? selected.name}
                  </div>
                  <div className="text-[10px] text-muted-foreground font-mono">
                    {selected.symbol} · {KRW.format(priceKrw(selected.last_price, selected.currency))}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setSelected(null)}
                  className="text-xs text-muted-foreground hover:text-foreground"
                >
                  ✕
                </button>
              </div>
              <div className="space-y-1">
                <Label htmlFor="game-qty" className="text-xs">수량</Label>
                <Input
                  id="game-qty"
                  type="number"
                  min={1}
                  value={quantity}
                  onChange={(e) => setQuantity(Number(e.target.value))}
                />
                <div className="text-[10px] text-muted-foreground">
                  총 {KRW.format(priceKrw(selected.last_price, selected.currency) * quantity)}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                <Button
                  size="sm"
                  disabled={submitting}
                  onClick={() => executeTrade("buy")}
                >
                  <ArrowUp className="h-3 w-3 mr-1" /> 매수
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={submitting}
                  onClick={() => executeTrade("sell")}
                >
                  <ArrowDown className="h-3 w-3 mr-1" /> 매도
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <p className="text-[10px] text-muted-foreground text-center">
        💡 본 앱 종목 시세 그대로 사용. 게임 잔고는 본 앱과 완전 분리.
      </p>
    </div>
  );
}
