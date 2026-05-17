"use client";

// Plan #40: 매도 패턴 분석 — 본 앱 거래 내역 인사이트 (게임 환생 화면용).

import { useState, useEffect } from "react";
import { TrendingUp } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type Stats = {
  total_sells: number;
  avg_sell_pct: number;
  win_rate: number;
  total_buys: number;
};

export function SellPatternCard() {
  const [insights, setInsights] = useState<string[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await fetch("/api/game/sell-pattern");
      if (cancelled || !res.ok) return;
      const data = await res.json();
      if (cancelled) return;
      setInsights(data.insights ?? []);
      setStats(data.stats);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading || insights.length === 0) return null;

  return (
    <Card className="border-amber-500/40 bg-amber-500/5">
      <CardHeader>
        <CardTitle className="text-sm flex items-center gap-1.5">
          <TrendingUp className="h-4 w-4 text-amber-500" />
          본 앱 매도 패턴 분석
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-1.5">
        {stats && stats.total_sells > 0 && (
          <div className="grid grid-cols-3 gap-1.5 text-[10px]">
            <Stat label="매도" value={`${stats.total_sells}회`} />
            <Stat
              label="평균 수익"
              value={`${(stats.avg_sell_pct * 100).toFixed(1)}%`}
              positive={stats.avg_sell_pct > 0}
            />
            <Stat
              label="승률"
              value={`${(stats.win_rate * 100).toFixed(0)}%`}
              positive={stats.win_rate >= 0.5}
            />
          </div>
        )}
        <div className="space-y-1 pt-1.5 border-t">
          {insights.map((i, idx) => (
            <p key={idx} className="text-xs">
              {i}
            </p>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function Stat({
  label, value, positive,
}: {
  label: string;
  value: string;
  positive?: boolean;
}) {
  return (
    <div className="rounded border bg-background p-1.5 text-center">
      <div className="text-muted-foreground">{label}</div>
      <div
        className={`font-mono font-semibold ${
          positive === true
            ? "text-emerald-600 dark:text-emerald-400"
            : positive === false
              ? "text-red-500"
              : ""
        }`}
      >
        {value}
      </div>
    </div>
  );
}
