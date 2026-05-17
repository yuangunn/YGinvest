"use client";

// Plan #33: 부동산 매매 UI.

import { useState, useEffect } from "react";
import { Home, TrendingUp, TrendingDown } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

const KRW = new Intl.NumberFormat("ko-KR", {
  style: "currency",
  currency: "KRW",
  maximumFractionDigits: 0,
});

function formatKRW(n: number): string {
  if (n >= 1e12) return `${(n / 1e12).toFixed(1)}조원`;
  if (n >= 1e8) return `${(n / 1e8).toFixed(1)}억원`;
  if (n >= 1e4) return `${(n / 1e4).toFixed(0)}만원`;
  return KRW.format(n);
}

type Listing = {
  region_code: string;
  region_name: string;
  property_type: string;
  base_price: number;
  jeonse_ratio: number;
  daily_volatility: number;
  kospi_beta: number;
  weekly_index: number;
  current_price: number;
};

type Holding = {
  id: string;
  region_code: string;
  region_name: string;
  purchase_price: number;
  jeonse_amount: number;
  current_price: number;
  profit: number;
};

export function RealEstateTrader({ onTrade }: { onTrade: () => void }) {
  const [listings, setListings] = useState<Listing[]>([]);
  const [holdings, setHoldings] = useState<Holding[]>([]);
  const [kospi, setKospi] = useState(0);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    const res = await fetch("/api/game/real-estate");
    if (res.ok) {
      const data = await res.json();
      setListings(data.listings ?? []);
      setHoldings(data.holdings ?? []);
      setKospi(data.kospi_daily_change ?? 0);
    }
    setLoading(false);
  }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await fetch("/api/game/real-estate");
      if (!res.ok || cancelled) {
        if (!cancelled) setLoading(false);
        return;
      }
      const data = await res.json();
      if (cancelled) return;
      setListings(data.listings ?? []);
      setHoldings(data.holdings ?? []);
      setKospi(data.kospi_daily_change ?? 0);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function buy(regionCode: string, useJeonse: boolean) {
    setSubmitting(regionCode);
    try {
      const res = await fetch("/api/game/real-estate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ region_code: regionCode, use_jeonse: useJeonse }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(
          `매수 실패: ${data.error}${data.use_jeonse_hint ? " — " + data.use_jeonse_hint : ""}`,
        );
        return;
      }
      toast.success(`${data.region_name} 매수 완료`);
      load();
      onTrade();
    } finally {
      setSubmitting(null);
    }
  }

  async function sell(id: string, regionName: string) {
    setSubmitting(id);
    try {
      const res = await fetch(`/api/game/real-estate?id=${id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) {
        toast.error(`매도 실패: ${data.error}`);
        return;
      }
      const pct = (data.profit_pct * 100).toFixed(2);
      toast.success(
        `${regionName} 매도: ${data.profit >= 0 ? "+" : ""}${formatKRW(data.profit)} (${pct}%)`,
      );
      load();
      onTrade();
    } finally {
      setSubmitting(null);
    }
  }

  if (loading) {
    return <Card><CardContent className="py-6 text-sm text-muted-foreground">로딩…</CardContent></Card>;
  }

  return (
    <div className="space-y-3">
      <div className="text-[10px] text-muted-foreground flex items-center gap-2">
        오늘 KOSPI 변동{" "}
        <span
          className={`font-mono ${kospi >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-500"}`}
        >
          {kospi >= 0 ? "+" : ""}
          {(kospi * 100).toFixed(2)}%
        </span>
        — 강남(β 0.8) 같은 곳은 더 크게 흔들림
      </div>

      {/* 보유 부동산 */}
      {holdings.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">🏘️ 보유 부동산</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {holdings.map((h) => {
              const pct = (h.profit / Number(h.purchase_price)) * 100;
              const isUp = h.profit >= 0;
              return (
                <div key={h.id} className="rounded-md border p-2.5 space-y-1">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-sm font-semibold">{h.region_name}</div>
                      <div className="text-[10px] text-muted-foreground">
                        매수 {formatKRW(Number(h.purchase_price))}
                        {Number(h.jeonse_amount) > 0 && (
                          <> · 전세 {formatKRW(Number(h.jeonse_amount))}</>
                        )}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-mono text-sm">{formatKRW(h.current_price)}</div>
                      <div
                        className={`text-[10px] font-semibold ${isUp ? "text-emerald-600 dark:text-emerald-400" : "text-red-500"}`}
                      >
                        {isUp ? <TrendingUp className="h-3 w-3 inline" /> : <TrendingDown className="h-3 w-3 inline" />}
                        {" "}
                        {isUp ? "+" : ""}
                        {pct.toFixed(2)}%
                      </div>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="w-full text-xs"
                    disabled={submitting === h.id}
                    onClick={() => sell(h.id, h.region_name)}
                  >
                    매도
                  </Button>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {/* 매수 가능 지역 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <Home className="h-4 w-4 text-primary" />
            지역별 매수 가능
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-1.5">
          {listings.map((l) => {
            const jeonse = Math.floor(l.current_price * Number(l.jeonse_ratio));
            const equity = l.current_price - jeonse;
            return (
              <div key={l.region_code} className="rounded-md border p-2.5">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-semibold">{l.region_name}</div>
                    <div className="text-[10px] text-muted-foreground">
                      {l.property_type === "apartment" ? "아파트" : l.property_type === "villa" ? "빌라" : "원룸"}
                      {" · "}변동성 {(Number(l.daily_volatility) * 100).toFixed(2)}%
                      {" · "}KOSPI β {Number(l.kospi_beta).toFixed(2)}
                    </div>
                  </div>
                  <div className="font-mono text-sm font-semibold">
                    {formatKRW(l.current_price)}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-1.5 mt-2">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={submitting === l.region_code}
                    onClick={() => buy(l.region_code, false)}
                    className="text-xs"
                  >
                    💰 자기자본 {formatKRW(l.current_price)}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={submitting === l.region_code}
                    onClick={() => buy(l.region_code, true)}
                    className="text-xs"
                  >
                    🏦 갭투자 {formatKRW(equity)}
                  </Button>
                </div>
                <div className="text-[9px] text-muted-foreground mt-1">
                  갭투자 = 매매 {formatKRW(l.current_price)} - 전세 {formatKRW(jeonse)} (전세가율 {(Number(l.jeonse_ratio) * 100).toFixed(0)}%)
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      <p className="text-[10px] text-muted-foreground text-center">
        💡 base 시세 + 한국부동산원 주간지수 + KOSPI 일변동 × 베타로 계산
      </p>
    </div>
  );
}
