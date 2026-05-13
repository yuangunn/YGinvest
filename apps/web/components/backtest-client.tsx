"use client";

import { useState } from "react";
import { Loader2, Play } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { ma, rsi, macd as macdFn } from "@/lib/indicators";

type Bar = { ts: string; close: number; volume: number };

type Strategy = "ma_cross" | "rsi" | "macd";

type Trade = {
  buyDate: string;
  buyPrice: number;
  sellDate: string | null;
  sellPrice: number | null;
  pnlPct: number | null;
  holdingDays: number | null;
};

type Result = {
  trades: Trade[];
  initialPrice: number;
  finalPrice: number;
  buyHoldPct: number;
  strategyPct: number;
  winRate: number;
  avgWin: number;
  avgLoss: number;
};

function runBacktest(bars: Bar[], strategy: Strategy): Result {
  const closes = bars.map((b) => b.close);

  // Generate signals
  let signals: ("buy" | "sell" | null)[] = [];

  if (strategy === "ma_cross") {
    const ma20 = ma(closes, 20);
    const ma60 = ma(closes, 60);
    signals = closes.map((_, i) => {
      if (i < 60) return null;
      const ma20Cur = ma20[i];
      const ma20Prev = ma20[i - 1];
      const ma60Cur = ma60[i];
      const ma60Prev = ma60[i - 1];
      if (
        ma20Prev === undefined ||
        ma20Cur === undefined ||
        ma60Prev === undefined ||
        ma60Cur === undefined
      )
        return null;
      // Golden cross
      if (ma20Prev <= ma60Prev && ma20Cur > ma60Cur) return "buy";
      // Dead cross
      if (ma20Prev >= ma60Prev && ma20Cur < ma60Cur) return "sell";
      return null;
    });
  } else if (strategy === "rsi") {
    const rsiVals = rsi(closes, 14);
    let lastSig: "buy" | "sell" | null = null;
    signals = closes.map((_, i) => {
      const r = rsiVals[i];
      if (r === undefined) return null;
      // 과매도 매수
      if (r < 30 && lastSig !== "buy") {
        lastSig = "buy";
        return "buy";
      }
      // 과매수 매도
      if (r > 70 && lastSig !== "sell") {
        lastSig = "sell";
        return "sell";
      }
      return null;
    });
  } else if (strategy === "macd") {
    const SLOW = 26;
    const m = macdFn(closes, 12, 26, 9);
    signals = closes.map((_, i) => {
      const macdIdx = i - (SLOW - 1);
      if (macdIdx < 1) return null;
      const cur = m.histogram[macdIdx];
      const prev = m.histogram[macdIdx - 1];
      if (prev === undefined || cur === undefined) return null;
      // 히스토그램 0 상향 돌파 = 매수
      if (prev <= 0 && cur > 0) return "buy";
      if (prev >= 0 && cur < 0) return "sell";
      return null;
    });
  }

  // Execute trades
  const trades: Trade[] = [];
  let inPosition = false;
  let buyIdx = -1;

  for (let i = 0; i < bars.length; i++) {
    const s = signals[i];
    if (s === "buy" && !inPosition) {
      inPosition = true;
      buyIdx = i;
    } else if (s === "sell" && inPosition) {
      const buy = bars[buyIdx];
      const sell = bars[i];
      const pnlPct = ((sell.close - buy.close) / buy.close) * 100;
      const holdingDays =
        (new Date(sell.ts).getTime() - new Date(buy.ts).getTime()) / 86400000;
      trades.push({
        buyDate: buy.ts,
        buyPrice: buy.close,
        sellDate: sell.ts,
        sellPrice: sell.close,
        pnlPct,
        holdingDays,
      });
      inPosition = false;
      buyIdx = -1;
    }
  }
  // Close open position with last price (mark-to-market)
  if (inPosition && buyIdx >= 0) {
    const buy = bars[buyIdx];
    const last = bars[bars.length - 1];
    const pnlPct = ((last.close - buy.close) / buy.close) * 100;
    trades.push({
      buyDate: buy.ts,
      buyPrice: buy.close,
      sellDate: null,
      sellPrice: last.close,
      pnlPct,
      holdingDays:
        (new Date(last.ts).getTime() - new Date(buy.ts).getTime()) / 86400000,
    });
  }

  // Aggregate
  const initial = bars[0].close;
  const final = bars[bars.length - 1].close;
  const buyHoldPct = ((final - initial) / initial) * 100;
  // Strategy total = compound of trades
  let strategyMult = 1.0;
  for (const t of trades) {
    if (t.pnlPct !== null) strategyMult *= 1 + t.pnlPct / 100;
  }
  const strategyPct = (strategyMult - 1) * 100;
  const wins = trades.filter((t) => (t.pnlPct ?? 0) > 0);
  const losses = trades.filter((t) => (t.pnlPct ?? 0) < 0);
  const winRate = trades.length > 0 ? (wins.length / trades.length) * 100 : 0;
  const avgWin =
    wins.length > 0 ? wins.reduce((s, t) => s + (t.pnlPct ?? 0), 0) / wins.length : 0;
  const avgLoss =
    losses.length > 0
      ? losses.reduce((s, t) => s + (t.pnlPct ?? 0), 0) / losses.length
      : 0;

  return {
    trades,
    initialPrice: initial,
    finalPrice: final,
    buyHoldPct,
    strategyPct,
    winRate,
    avgWin,
    avgLoss,
  };
}

export function BacktestClient() {
  const [symbol, setSymbol] = useState("005930.KS");
  const [strategy, setStrategy] = useState<Strategy>("ma_cross");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch(
        `/api/stocks/${encodeURIComponent(symbol)}/bars?interval=1d`,
      );
      if (!res.ok) throw new Error("일봉 데이터 없음");
      const json = await res.json();
      const bars: Bar[] = (json.bars ?? []).map(
        (b: { ts: string; close: number; volume?: number }) => ({
          ts: String(b.ts),
          close: b.close,
          volume: b.volume ?? 0,
        }),
      );
      if (bars.length < 60) {
        throw new Error(`데이터 부족 (${bars.length}개, 60개 이상 필요)`);
      }
      setResult(runBacktest(bars, strategy));
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
          <CardTitle className="text-base">설정</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
            <div className="space-y-1">
              <Label htmlFor="bt-sym">종목</Label>
              <Input
                id="bt-sym"
                value={symbol}
                onChange={(e) => setSymbol(e.target.value)}
                placeholder="005930.KS"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="bt-strat">전략</Label>
              <select
                id="bt-strat"
                value={strategy}
                onChange={(e) => setStrategy(e.target.value as Strategy)}
                className="w-full h-10 px-3 rounded-md border bg-background"
              >
                <option value="ma_cross">MA20/60 골든/데드 크로스</option>
                <option value="rsi">RSI 30/70 (과매도 매수, 과매수 매도)</option>
                <option value="macd">MACD 히스토그램 0 돌파</option>
              </select>
            </div>
            <Button onClick={run} disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                  실행 중
                </>
              ) : (
                <>
                  <Play className="h-3 w-3 mr-1" />
                  실행
                </>
              )}
            </Button>
          </div>
          {error && <p className="text-sm text-destructive mt-2">{error}</p>}
        </CardContent>
      </Card>

      {result && (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">결과 요약</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                <Stat
                  label="전략 수익률"
                  value={fmtPct(result.strategyPct)}
                  positive={result.strategyPct > 0}
                  primary
                />
                <Stat
                  label="Buy & Hold"
                  value={fmtPct(result.buyHoldPct)}
                  positive={result.buyHoldPct > 0}
                />
                <Stat
                  label="알파"
                  value={fmtPct(result.strategyPct - result.buyHoldPct)}
                  positive={result.strategyPct > result.buyHoldPct}
                  hint="전략 vs 단순보유"
                />
                <Stat
                  label="총 거래"
                  value={`${result.trades.length}회`}
                />
                <Stat
                  label="승률"
                  value={`${result.winRate.toFixed(0)}%`}
                />
                <Stat
                  label="평균 수익"
                  value={fmtPct(result.avgWin)}
                  positive={true}
                />
                <Stat
                  label="평균 손실"
                  value={fmtPct(result.avgLoss)}
                  positive={false}
                />
                <Stat
                  label="profit factor"
                  value={
                    result.avgLoss === 0
                      ? "∞"
                      : Math.abs(
                          (result.winRate / 100) * result.avgWin /
                            ((1 - result.winRate / 100) * result.avgLoss),
                        ).toFixed(2)
                  }
                  hint="기대값 ratio"
                />
              </div>
            </CardContent>
          </Card>

          {result.trades.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">
                  체결 내역 ({result.trades.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-1 text-xs">
                  {result.trades.map((t, i) => (
                    <div
                      key={i}
                      className="grid grid-cols-4 gap-2 items-center border-b py-1.5 last:border-0"
                    >
                      <span className="text-muted-foreground">#{i + 1}</span>
                      <span>매수: {t.buyDate.slice(0, 10)}</span>
                      <span>{t.sellDate ? `매도: ${t.sellDate.slice(0, 10)}` : "보유 중"}</span>
                      <span
                        className={`text-right font-mono tabular-nums ${
                          (t.pnlPct ?? 0) >= 0 ? "text-green-500" : "text-red-500"
                        }`}
                      >
                        {fmtPct(t.pnlPct ?? 0)}
                      </span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}

      <p className="text-xs text-muted-foreground text-center">
        ⚠️ 백테스팅은 과거 데이터 기반 시뮬레이션. 미래 수익을 보장하지 않으며, 수수료/슬리피지는 미반영입니다.
      </p>
    </>
  );
}

function Stat({
  label,
  value,
  hint,
  positive,
  primary,
}: {
  label: string;
  value: string;
  hint?: string;
  positive?: boolean;
  primary?: boolean;
}) {
  return (
    <div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div
        className={`font-mono tabular-nums ${
          primary ? "text-base font-bold" : "text-sm font-medium"
        } ${positive === true ? "text-green-500" : positive === false ? "text-red-500" : ""}`}
      >
        {value}
      </div>
      {hint && <div className="text-[10px] text-muted-foreground">{hint}</div>}
    </div>
  );
}

function fmtPct(v: number): string {
  return `${v >= 0 ? "+" : ""}${v.toFixed(2)}%`;
}
