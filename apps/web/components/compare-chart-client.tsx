"use client";

import { useEffect, useRef, useState } from "react";
import {
  createChart,
  LineSeries,
  type IChartApi,
  type Time,
} from "lightweight-charts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Sparkles } from "lucide-react";

type Bar = { ts: string; close: number };
type Loaded = { symbol: string; name: string; bars: Bar[] };

function tsToTime(ts: string): Time {
  if (ts.includes("T") && ts.length > 10) {
    return Math.floor(new Date(ts).getTime() / 1000) as Time;
  }
  return ts.split("T")[0] as Time;
}

type Props = { initialA: string; initialB: string };

export function CompareChartClient({ initialA, initialB }: Props) {
  const [symA, setSymA] = useState(initialA);
  const [symB, setSymB] = useState(initialB);
  const [loadedA, setLoadedA] = useState<Loaded | null>(null);
  const [loadedB, setLoadedB] = useState<Loaded | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);

  async function loadSymbol(symbol: string): Promise<Loaded | null> {
    if (!symbol.trim()) return null;
    const [barsRes, stockRes] = await Promise.all([
      fetch(`/api/stocks/${encodeURIComponent(symbol)}/bars?interval=1d`),
      fetch(`/api/stocks/lookup?symbol=${encodeURIComponent(symbol)}`),
    ]);
    if (!barsRes.ok) throw new Error(`${symbol} 데이터 없음`);
    const barsJson = await barsRes.json();
    const bars: Bar[] = (barsJson.bars ?? []).map(
      (b: { ts: string; close: number }) => ({ ts: String(b.ts), close: b.close }),
    );
    let name = symbol;
    if (stockRes.ok) {
      const sj = await stockRes.json();
      name = sj.stock?.name_ko ?? sj.stock?.name ?? symbol;
    }
    return { symbol, name, bars };
  }

  async function handleCompare(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const [a, b] = await Promise.all([loadSymbol(symA), loadSymbol(symB)]);
      setLoadedA(a);
      setLoadedB(b);
    } catch (err) {
      setError(err instanceof Error ? err.message : "로드 실패");
    } finally {
      setLoading(false);
    }
  }

  // initial load if both initialA + initialB present.
  // useEffect with state set in async callback (post-mount, intentional)
  useEffect(() => {
    if (!initialA || !initialB) return;
    if (loadedA || loadedB) return;
    let cancelled = false;
    (async () => {
      try {
        const [a, b] = await Promise.all([
          loadSymbol(initialA),
          loadSymbol(initialB),
        ]);
        if (!cancelled) {
          setLoadedA(a);
          setLoadedB(b);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "로드 실패");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [initialA, initialB, loadedA, loadedB]);

  // Render chart whenever both loaded
  useEffect(() => {
    if (!containerRef.current) return;
    if (!loadedA || !loadedB) return;
    if (loadedA.bars.length === 0 || loadedB.bars.length === 0) return;

    const chart = createChart(containerRef.current, {
      height: 360,
      layout: { background: { color: "transparent" }, textColor: "#888" },
      grid: {
        vertLines: { color: "rgba(255,255,255,0.05)" },
        horzLines: { color: "rgba(255,255,255,0.05)" },
      },
      timeScale: { timeVisible: true, secondsVisible: false },
      crosshair: { mode: 1 },
      rightPriceScale: {
        scaleMargins: { top: 0.1, bottom: 0.05 },
      },
    });
    chartRef.current = chart;

    // Normalize both to 100 at the first common bar
    const baseA = loadedA.bars[0].close;
    const baseB = loadedB.bars[0].close;

    const seriesA = chart.addSeries(LineSeries, {
      color: "#2563eb",
      lineWidth: 2,
      title: loadedA.name,
    });
    seriesA.setData(
      loadedA.bars.map((b) => ({
        time: tsToTime(b.ts),
        value: (b.close / baseA) * 100,
      })),
    );

    const seriesB = chart.addSeries(LineSeries, {
      color: "#f59e0b",
      lineWidth: 2,
      title: loadedB.name,
    });
    seriesB.setData(
      loadedB.bars.map((b) => ({
        time: tsToTime(b.ts),
        value: (b.close / baseB) * 100,
      })),
    );

    chart.timeScale().fitContent();

    const onResize = () => {
      if (containerRef.current) {
        chart.applyOptions({ width: containerRef.current.clientWidth });
      }
    };
    onResize();
    window.addEventListener("resize", onResize);

    return () => {
      window.removeEventListener("resize", onResize);
      chart.remove();
      chartRef.current = null;
    };
  }, [loadedA, loadedB]);

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            종목 선택
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={handleCompare}
            className="grid grid-cols-1 sm:grid-cols-3 gap-2 items-end"
          >
            <div className="space-y-1">
              <Label htmlFor="cmp-a">종목 A (예: AAPL 또는 005930.KS)</Label>
              <Input
                id="cmp-a"
                value={symA}
                onChange={(e) => setSymA(e.target.value)}
                placeholder="AAPL"
                required
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="cmp-b">종목 B</Label>
              <Input
                id="cmp-b"
                value={symB}
                onChange={(e) => setSymB(e.target.value)}
                placeholder="MSFT"
                required
              />
            </div>
            <Button type="submit" disabled={loading} className="h-10">
              {loading ? "로딩..." : "비교"}
            </Button>
          </form>
          {error && (
            <p className="text-sm text-destructive mt-2">{error}</p>
          )}
        </CardContent>
      </Card>

      {loadedA && loadedB && loadedA.bars.length > 0 && loadedB.bars.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex flex-wrap gap-3 items-center">
              <span className="inline-flex items-center gap-1">
                <span
                  className="inline-block w-3 h-1"
                  style={{ backgroundColor: "#2563eb" }}
                />
                {loadedA.name} ({loadedA.symbol})
              </span>
              <span className="inline-flex items-center gap-1">
                <span
                  className="inline-block w-3 h-1"
                  style={{ backgroundColor: "#f59e0b" }}
                />
                {loadedB.name} ({loadedB.symbol})
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div ref={containerRef} className="w-full" style={{ height: 360 }} />
            <p className="text-xs text-muted-foreground mt-2 text-center">
              시작가 100 기준 normalized — 수익률 비교 (절대 가격이 아님)
            </p>
          </CardContent>
        </Card>
      )}
    </>
  );
}
