"use client";

import { useState } from "react";
import { Loader2, Play, Plus, X } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Term } from "@/components/term";

type SymbolBars = { symbol: string; name: string; returns: number[] };

// Pearson correlation
function correlation(a: number[], b: number[]): number {
  const n = Math.min(a.length, b.length);
  if (n < 3) return 0;
  let sumA = 0, sumB = 0, sumA2 = 0, sumB2 = 0, sumAB = 0;
  for (let i = 0; i < n; i++) {
    sumA += a[i];
    sumB += b[i];
    sumA2 += a[i] * a[i];
    sumB2 += b[i] * b[i];
    sumAB += a[i] * b[i];
  }
  const num = n * sumAB - sumA * sumB;
  const den = Math.sqrt((n * sumA2 - sumA * sumA) * (n * sumB2 - sumB * sumB));
  if (den === 0) return 0;
  return num / den;
}

function corrColor(c: number): string {
  if (c >= 0.7) return "bg-red-500 text-white";
  if (c >= 0.4) return "bg-red-300/70";
  if (c >= 0.1) return "bg-red-200/50";
  if (c >= -0.1) return "bg-muted";
  if (c >= -0.4) return "bg-blue-200/50";
  if (c >= -0.7) return "bg-blue-300/70";
  return "bg-blue-500 text-white";
}

export function CorrelationClient({ initialSymbols }: { initialSymbols: string[] }) {
  const [symbols, setSymbols] = useState<string[]>(
    initialSymbols.length > 0
      ? initialSymbols
      : ["005930.KS", "000660.KS", "035420.KS"],
  );
  const [newSym, setNewSym] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [matrix, setMatrix] = useState<{
    syms: SymbolBars[];
    corr: number[][];
  } | null>(null);

  function addSym() {
    if (!newSym.trim() || symbols.length >= 8) return;
    if (symbols.includes(newSym.trim())) {
      setNewSym("");
      return;
    }
    setSymbols([...symbols, newSym.trim()]);
    setNewSym("");
  }

  function removeSym(idx: number) {
    setSymbols(symbols.filter((_, i) => i !== idx));
  }

  async function run() {
    if (symbols.length < 2) {
      setError("최소 2개 종목 필요");
      return;
    }
    setLoading(true);
    setError(null);
    setMatrix(null);
    try {
      const results = await Promise.all(
        symbols.map(async (sym) => {
          const [barsRes, lookupRes] = await Promise.all([
            fetch(`/api/stocks/${encodeURIComponent(sym)}/bars?interval=1d`),
            fetch(`/api/stocks/lookup?symbol=${encodeURIComponent(sym)}`),
          ]);
          if (!barsRes.ok) throw new Error(`${sym} 데이터 없음`);
          const j = await barsRes.json();
          const bars = (j.bars ?? []) as { ts: string; close: number }[];
          if (bars.length < 30) throw new Error(`${sym} 데이터 부족 (30일 이상 필요)`);
          // Daily returns
          const returns: number[] = [];
          for (let i = 1; i < bars.length; i++) {
            const prev = bars[i - 1].close;
            if (prev > 0) returns.push((bars[i].close - prev) / prev);
          }
          let name = sym;
          if (lookupRes.ok) {
            const lj = await lookupRes.json();
            name = lj.stock?.name_ko ?? lj.stock?.name ?? sym;
          }
          return { symbol: sym, name, returns };
        }),
      );

      // Truncate all to min length for fair comparison
      const minLen = Math.min(...results.map((r) => r.returns.length));
      const aligned = results.map((r) => ({
        ...r,
        returns: r.returns.slice(-minLen),
      }));

      const corr: number[][] = [];
      for (let i = 0; i < aligned.length; i++) {
        const row: number[] = [];
        for (let j = 0; j < aligned.length; j++) {
          row.push(correlation(aligned[i].returns, aligned[j].returns));
        }
        corr.push(row);
      }
      setMatrix({ syms: aligned, corr });
    } catch (err) {
      setError(err instanceof Error ? err.message : "실행 실패");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">종목 선택 (2-8개)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-1.5">
            {symbols.map((s, i) => (
              <button
                key={s}
                type="button"
                onClick={() => removeSym(i)}
                className="inline-flex items-center gap-1 rounded-full bg-primary/10 text-primary px-3 py-1 text-xs hover:bg-primary/20"
              >
                {s}
                <X className="h-3 w-3" />
              </button>
            ))}
          </div>
          {symbols.length < 8 && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                addSym();
              }}
              className="flex gap-2"
            >
              <Input
                value={newSym}
                onChange={(e) => setNewSym(e.target.value)}
                placeholder="심볼 추가 (예: AAPL)"
              />
              <Button type="submit" size="sm" variant="outline">
                <Plus className="h-3 w-3 mr-1" />
                추가
              </Button>
            </form>
          )}
          <Button onClick={run} disabled={loading || symbols.length < 2} className="w-full">
            {loading ? (
              <>
                <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                계산 중
              </>
            ) : (
              <>
                <Play className="h-3 w-3 mr-1" />
                상관계수 계산
              </>
            )}
          </Button>
          {error && <p className="text-sm text-destructive">{error}</p>}
        </CardContent>
      </Card>

      {matrix && (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">상관계수 매트릭스</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr>
                      <th className="text-left py-1 pr-2"></th>
                      {matrix.syms.map((s) => (
                        <th
                          key={s.symbol}
                          className="text-center px-1 py-1 font-medium"
                          title={s.name}
                        >
                          {s.symbol.split(".")[0].slice(0, 6)}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {matrix.syms.map((row, i) => (
                      <tr key={row.symbol}>
                        <td className="py-1 pr-2 font-medium truncate max-w-32">
                          {row.name}
                        </td>
                        {matrix.corr[i].map((c, j) => (
                          <td
                            key={j}
                            className={`text-center font-mono tabular-nums ${corrColor(c)}`}
                            style={{
                              width: "44px",
                              padding: "6px 4px",
                            }}
                          >
                            {c.toFixed(2)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex flex-wrap gap-2 text-[10px] text-muted-foreground mt-3 justify-center">
                <span>
                  <span className="inline-block w-3 h-3 bg-red-500 align-middle mr-1" />
                  강한 양의 상관 (≥+0.7)
                </span>
                <span>
                  <span className="inline-block w-3 h-3 bg-muted align-middle mr-1 border" />
                  무상관 (±0.1)
                </span>
                <span>
                  <span className="inline-block w-3 h-3 bg-blue-500 align-middle mr-1" />
                  강한 음의 상관 (≤-0.7)
                </span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="text-sm py-3">
              <p className="font-semibold mb-1">📌 해석</p>
              <ul className="text-xs space-y-1 text-muted-foreground list-disc ml-4">
                <li>높은 양의 상관 (빨강) = 같은 방향으로 움직임 → <Term k="diversification">분산</Term> 효과 ↓</li>
                <li>음의 상관 (파랑) = 반대 방향 → 헤지 효과</li>
                <li>같은 섹터/테마 종목은 보통 0.5-0.8</li>
                <li>다른 자산 클래스(주식/채권/금/원자재)는 낮은 상관 권장</li>
              </ul>
            </CardContent>
          </Card>
        </>
      )}
    </>
  );
}
