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

const COLORS = ["#2563eb", "#f59e0b", "#10b981", "#ef4444"]; // A: blue, B: orange, C: green, D: red

function tsToTime(ts: string): Time {
  if (ts.includes("T") && ts.length > 10) {
    return Math.floor(new Date(ts).getTime() / 1000) as Time;
  }
  return ts.split("T")[0] as Time;
}

type Props = { initialA: string; initialB: string };

export function CompareChartClient({ initialA, initialB }: Props) {
  const [symbols, setSymbols] = useState<string[]>([
    initialA,
    initialB,
    "",
    "",
  ]);
  const [loaded, setLoaded] = useState<(Loaded | null)[]>([null, null, null, null]);
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
      (b: { ts: string; close: number }) => ({
        ts: String(b.ts),
        close: b.close,
      }),
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
      const results = await Promise.all(
        symbols.map((s) => (s.trim() ? loadSymbol(s) : Promise.resolve(null))),
      );
      setLoaded(results);
    } catch (err) {
      setError(err instanceof Error ? err.message : "로드 실패");
    } finally {
      setLoading(false);
    }
  }

  // initial load (initialA + initialB)
  useEffect(() => {
    if (!initialA || !initialB) return;
    if (loaded[0] || loaded[1]) return;
    let cancelled = false;
    (async () => {
      try {
        const results = await Promise.all([
          loadSymbol(initialA),
          loadSymbol(initialB),
        ]);
        if (!cancelled) {
          setLoaded([results[0], results[1], null, null]);
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
  }, [initialA, initialB, loaded]);

  // Render chart
  useEffect(() => {
    if (!containerRef.current) return;
    const valid = loaded.filter((l): l is Loaded => l !== null && l.bars.length > 0);
    if (valid.length < 2) return;

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

    loaded.forEach((l, i) => {
      if (!l || l.bars.length === 0) return;
      const base = l.bars[0].close;
      const series = chart.addSeries(LineSeries, {
        color: COLORS[i],
        lineWidth: 2,
        title: l.name,
      });
      series.setData(
        l.bars.map((b) => ({
          time: tsToTime(b.ts),
          value: (b.close / base) * 100,
        })),
      );
    });

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
  }, [loaded]);

  const validLoaded = loaded.filter((l): l is Loaded => l !== null && l.bars.length > 0);

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            종목 선택 (최대 4개)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={handleCompare}
            className="grid grid-cols-2 sm:grid-cols-4 gap-2 items-end"
          >
            {symbols.map((s, i) => (
              <div key={i} className="space-y-1">
                <Label htmlFor={`cmp-${i}`} className="text-xs flex items-center gap-1">
                  <span
                    className="inline-block w-3 h-1"
                    style={{ backgroundColor: COLORS[i] }}
                  />
                  종목 {String.fromCharCode(65 + i)}
                  {i >= 2 && <span className="text-muted-foreground">(선택)</span>}
                </Label>
                <Input
                  id={`cmp-${i}`}
                  value={s}
                  onChange={(e) => {
                    const next = [...symbols];
                    next[i] = e.target.value;
                    setSymbols(next);
                  }}
                  placeholder={
                    i === 0 ? "AAPL" : i === 1 ? "MSFT" : "심볼 (선택)"
                  }
                  required={i < 2}
                />
              </div>
            ))}
            <Button
              type="submit"
              disabled={loading}
              className="h-10 sm:col-span-4"
            >
              {loading ? "로딩..." : "비교"}
            </Button>
          </form>
          {error && <p className="text-sm text-destructive mt-2">{error}</p>}
        </CardContent>
      </Card>

      {validLoaded.length >= 2 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex flex-wrap gap-3 items-center">
              {validLoaded.map((l) => (
                <span key={l.symbol} className="inline-flex items-center gap-1">
                  <span
                    className="inline-block w-3 h-1"
                    style={{ backgroundColor: COLORS[loaded.indexOf(l)] }}
                  />
                  {l.name} ({l.symbol})
                </span>
              ))}
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
