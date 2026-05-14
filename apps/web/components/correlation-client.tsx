"use client";

import { useState } from "react";
import { Loader2, Play, X } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Term } from "@/components/term";
import { StockPicker, type PickedStock } from "@/components/stock-picker";

type ResolvedBar = { symbol: string; name: string; returns: number[] };

// Pearson correlation
function correlation(a: number[], b: number[]): number {
  const n = Math.min(a.length, b.length);
  if (n < 3) return 0;
  let sumA = 0,
    sumB = 0,
    sumA2 = 0,
    sumB2 = 0,
    sumAB = 0;
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

const DEFAULTS: PickedStock[] = [
  { symbol: "005930.KS", name: "삼성전자" },
  { symbol: "000660.KS", name: "SK하이닉스" },
  { symbol: "035420.KS", name: "NAVER" },
];

export function CorrelationClient({
  initial,
}: {
  initial: { symbol: string; name: string }[];
}) {
  const [items, setItems] = useState<PickedStock[]>(
    initial.length > 0 ? initial : DEFAULTS,
  );
  const [pending, setPending] = useState<PickedStock | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [matrix, setMatrix] = useState<{
    syms: ResolvedBar[];
    corr: number[][];
  } | null>(null);

  function addPicked(p: PickedStock | null) {
    if (!p) {
      setPending(null);
      return;
    }
    if (items.length >= 8) {
      setPending(null);
      return;
    }
    if (items.some((i) => i.symbol === p.symbol)) {
      setPending(null);
      return;
    }
    setItems([...items, p]);
    setPending(null);
  }

  function removeAt(idx: number) {
    setItems(items.filter((_, i) => i !== idx));
  }

  async function run() {
    if (items.length < 2) {
      setError("최소 2개 종목 필요");
      return;
    }
    setLoading(true);
    setError(null);
    setMatrix(null);
    try {
      const results: (ResolvedBar | { skip: PickedStock; reason: string })[] =
        await Promise.all(
          items.map(async (it) => {
            const barsRes = await fetch(
              `/api/stocks/${encodeURIComponent(it.symbol)}/bars?interval=1d`,
            );
            if (!barsRes.ok) {
              return {
                skip: it,
                reason: `${it.name}: 일봉 데이터 조회 실패`,
              };
            }
            const j = await barsRes.json();
            const bars = (j.bars ?? []) as { ts: string; close: number }[];
            if (bars.length < 30) {
              return {
                skip: it,
                reason: `${it.name}: 일봉 ${bars.length}개 (30개 이상 필요)`,
              };
            }
            const returns: number[] = [];
            for (let i = 1; i < bars.length; i++) {
              const prev = bars[i - 1].close;
              if (prev > 0) returns.push((bars[i].close - prev) / prev);
            }
            return { symbol: it.symbol, name: it.name, returns };
          }),
        );

      // 실패한 종목 분리
      const valid = results.filter(
        (r): r is ResolvedBar => "returns" in r,
      );
      const skipped = results.filter(
        (r): r is { skip: PickedStock; reason: string } => "skip" in r,
      );

      if (valid.length < 2) {
        setError(
          `유효한 종목이 ${valid.length}개뿐입니다 (최소 2개 필요).\n` +
            skipped.map((s) => `• ${s.reason}`).join("\n"),
        );
        return;
      }

      // Truncate all to min length for fair comparison
      const minLen = Math.min(...valid.map((r) => r.returns.length));
      const aligned = valid.map((r) => ({
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
      if (skipped.length > 0) {
        setError(
          `일부 종목 제외됨:\n` +
            skipped.map((s) => `• ${s.reason}`).join("\n"),
        );
      }
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
          {/* 선택된 종목 chips — 회사명 + 심볼 표시 */}
          <div className="flex flex-wrap gap-1.5">
            {items.map((it, i) => (
              <button
                key={it.symbol}
                type="button"
                onClick={() => removeAt(i)}
                className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 text-primary px-3 py-1 text-xs hover:bg-primary/20"
              >
                <span className="font-medium">{it.name}</span>
                <span className="text-[10px] opacity-60">{it.symbol}</span>
                <X className="h-3 w-3" />
              </button>
            ))}
          </div>

          {/* 종목 검색 picker */}
          {items.length < 8 && (
            <StockPicker
              value={pending}
              onChange={addPicked}
              placeholder="종목명 또는 심볼 추가 (예: 삼성전자, AAPL)"
            />
          )}

          <Button
            onClick={run}
            disabled={loading || items.length < 2}
            className="w-full"
          >
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
          {error && (
            <p className="text-xs text-amber-500 whitespace-pre-line">
              {error}
            </p>
          )}
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
                          title={`${s.name} (${s.symbol})`}
                        >
                          {s.name.slice(0, 4)}
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
                <li>
                  높은 양의 상관 (빨강) = 같은 방향으로 움직임 →{" "}
                  <Term k="diversification">분산</Term> 효과 ↓
                </li>
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
