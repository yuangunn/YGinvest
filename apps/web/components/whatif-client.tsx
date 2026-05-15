"use client";

import { useState } from "react";
import { Loader2, Play, TrendingUp, TrendingDown } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { StockPicker, type PickedStock } from "@/components/stock-picker";
import { NumberInput } from "@/components/number-input";

type Bar = { ts: string; close: number };

type Outcome = {
  buyPrice: number;
  buyDate: string;
  currentPrice: number;
  shares: number;
  initial: number;
  currentValue: number;
  pnl: number;
  pnlPct: number;
  years: number;
  cagr: number;
  realPnlPct: number; // 인플레 보정
};

const INFLATION = 0.025; // 연 2.5% 가정 (KR 장기 평균)

export function WhatIfClient() {
  const [picked, setPicked] = useState<PickedStock | null>({
    symbol: "NVDA",
    name: "NVIDIA",
  });
  const [amount, setAmount] = useState(1_000_000);
  const [date, setDate] = useState("2022-01-03");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Outcome | null>(null);

  async function run() {
    if (!picked) {
      setError("종목을 먼저 선택해주세요");
      return;
    }
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch(
        `/api/stocks/${encodeURIComponent(picked.symbol)}/bars?interval=1d&limit=2000`,
      );
      if (!res.ok) throw new Error("일봉 데이터 없음");
      const json = await res.json();
      const bars: Bar[] = (json.bars ?? []).map(
        (b: { ts: string; close: number }) => ({
          ts: String(b.ts),
          close: Number(b.close),
        }),
      );
      if (bars.length === 0) throw new Error("데이터 없음");

      const targetTs = date + "T00:00:00";
      const buyBar =
        bars.find((b) => b.ts >= targetTs) ??
        bars.find((b) => b.ts >= date.slice(0, 10));
      if (!buyBar) {
        throw new Error(
          "해당 날짜 이후 데이터 없음 — 더 과거 날짜 선택 또는 종목 확인",
        );
      }
      const buyPrice = buyBar.close;
      const buyDate = buyBar.ts.slice(0, 10);
      const last = bars[bars.length - 1];
      const currentPrice = last.close;
      const shares = amount / buyPrice;
      const currentValue = shares * currentPrice;
      const pnl = currentValue - amount;
      const pnlPct = (pnl / amount) * 100;
      const years =
        (new Date(last.ts).getTime() - new Date(buyBar.ts).getTime()) /
        (365.25 * 86400000);
      const cagr =
        years > 0 ? (Math.pow(currentValue / amount, 1 / years) - 1) * 100 : 0;
      // 실질 수익률 = (1 + nominal) / (1 + inflation)^years - 1
      const real =
        (currentValue / amount / Math.pow(1 + INFLATION, years) - 1) * 100;

      setResult({
        buyPrice,
        buyDate,
        currentPrice,
        shares,
        initial: amount,
        currentValue,
        pnl,
        pnlPct,
        years,
        cagr,
        realPnlPct: real,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "실행 실패");
    } finally {
      setLoading(false);
    }
  }

  function fmt(n: number): string {
    return Math.round(n).toLocaleString();
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">입력</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <Label>종목</Label>
            <StockPicker value={picked} onChange={setPicked} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="wi-amount" className="text-xs">투자 금액 (원)</Label>
              <NumberInput
                id="wi-amount"
                value={amount}
                onChange={setAmount}
                placeholder="예: 1,000,000"
              />
            </div>
            <div>
              <Label htmlFor="wi-date" className="text-xs">매수 날짜</Label>
              <Input
                id="wi-date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>
          </div>
          <Button onClick={run} disabled={loading || !picked} className="w-full">
            {loading ? (
              <>
                <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                계산 중
              </>
            ) : (
              <>
                <Play className="h-3 w-3 mr-1" />
                계산
              </>
            )}
          </Button>
          {error && <p className="text-xs text-destructive">{error}</p>}
        </CardContent>
      </Card>

      {result && (
        <>
          <Card
            className={
              result.pnl >= 0
                ? "border-green-500/40 bg-green-500/5"
                : "border-red-500/40 bg-red-500/5"
            }
          >
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                {result.pnl >= 0 ? (
                  <TrendingUp className="h-4 w-4 text-green-500" />
                ) : (
                  <TrendingDown className="h-4 w-4 text-red-500" />
                )}
                {picked!.name} · {result.buyDate} 매수
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-xs text-muted-foreground">현재 가치</div>
              <div
                className={`text-3xl font-bold font-mono tabular-nums ${
                  result.pnl >= 0 ? "text-green-500" : "text-red-500"
                }`}
              >
                ₩{fmt(result.currentValue)}
              </div>
              <div
                className={`text-sm font-mono tabular-nums ${
                  result.pnl >= 0 ? "text-green-500" : "text-red-500"
                }`}
              >
                {result.pnl >= 0 ? "+" : ""}₩{fmt(result.pnl)} (
                {result.pnlPct >= 0 ? "+" : ""}
                {result.pnlPct.toFixed(2)}%)
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">상세</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <Stat label="투입 금액" value={`₩${fmt(result.initial)}`} />
                <Stat
                  label="매수가"
                  value={`$${result.buyPrice.toFixed(2)}`}
                />
                <Stat
                  label="현재가"
                  value={`$${result.currentPrice.toFixed(2)}`}
                />
                <Stat label="주식 수" value={`${result.shares.toFixed(2)}주`} />
                <Stat label="보유 기간" value={`${result.years.toFixed(2)}년`} />
                <Stat
                  label="CAGR (연환산)"
                  value={`${result.cagr >= 0 ? "+" : ""}${result.cagr.toFixed(2)}%`}
                  positive={result.cagr >= 0}
                />
                <Stat
                  label="실질 수익률 (인플레 보정)"
                  value={`${result.realPnlPct >= 0 ? "+" : ""}${result.realPnlPct.toFixed(2)}%`}
                  positive={result.realPnlPct >= 0}
                  hint="연 2.5% 인플레 가정"
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="text-xs text-muted-foreground py-3 space-y-2">
              <p className="font-semibold text-foreground">📚 해석</p>
              <ul className="list-disc ml-4 space-y-1">
                <li>
                  <strong>CAGR</strong> = 연복리 수익률. 인덱스(S&P 10% / KOSPI 7%)와 비교.
                </li>
                <li>
                  <strong>실질 수익률</strong>: 명목 수익에서 인플레 차감. 0% 미만이면 구매력 손실.
                </li>
                <li>
                  과거 데이터는 미래를 보장하지 않습니다. 운 좋은 시점 선택의 위험.
                </li>
                <li>
                  USD 종목 결과는 환율 변동 고려 안 함 (단순 가격 비교).
                </li>
              </ul>
            </CardContent>
          </Card>
        </>
      )}
    </>
  );
}

function Stat({
  label,
  value,
  positive,
  hint,
}: {
  label: string;
  value: string;
  positive?: boolean;
  hint?: string;
}) {
  return (
    <div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div
        className={`font-mono tabular-nums text-sm font-medium ${
          positive === true
            ? "text-green-500"
            : positive === false
              ? "text-red-500"
              : ""
        }`}
      >
        {value}
      </div>
      {hint && <div className="text-[10px] text-muted-foreground">{hint}</div>}
    </div>
  );
}
