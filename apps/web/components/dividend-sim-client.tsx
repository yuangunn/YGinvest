"use client";

import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";

type YearRow = {
  year: number;
  shares: number;
  price: number;
  marketValue: number;
  dividendIncome: number;
  cumulativeDividends: number;
};

function simulate({
  initial,
  dividendYield,
  dividendGrowth,
  priceGrowth,
  years,
  reinvest,
  monthlyContribution,
}: {
  initial: number;
  dividendYield: number; // % at year 0
  dividendGrowth: number; // % per year (배당 성장률)
  priceGrowth: number; // % per year (주가 상승률)
  years: number;
  reinvest: boolean;
  monthlyContribution: number; // KRW / 월
}): YearRow[] {
  let price = 10000; // 가정 시작가 1만원
  let shares = initial / price;
  let cumDividends = 0;
  let dividendPerShare = (price * dividendYield) / 100; // 연간 1주당 배당금

  const rows: YearRow[] = [];

  for (let y = 0; y <= years; y++) {
    const marketValue = shares * price;
    const yearDividends = shares * dividendPerShare;
    cumDividends += y === 0 ? 0 : yearDividends;
    rows.push({
      year: y,
      shares,
      price,
      marketValue,
      dividendIncome: y === 0 ? 0 : yearDividends,
      cumulativeDividends: cumDividends,
    });
    if (y >= years) break;

    // 다음 해로 진행
    price *= 1 + priceGrowth / 100;
    dividendPerShare *= 1 + dividendGrowth / 100;

    // 배당 재투자 (DRIP)
    if (reinvest) {
      const dripShares = yearDividends / price;
      shares += dripShares;
    }
    // 월 적립
    if (monthlyContribution > 0) {
      const yearContribution = monthlyContribution * 12;
      shares += yearContribution / price;
    }
  }

  return rows;
}

export function DividendSimClient() {
  const [initial, setInitial] = useState(10_000_000);
  const [monthly, setMonthly] = useState(0);
  const [yld, setYld] = useState(3.5);
  const [divGrowth, setDivGrowth] = useState(5);
  const [priceGrowth, setPriceGrowth] = useState(5);
  const [years, setYears] = useState(30);

  const withDrip = useMemo(
    () =>
      simulate({
        initial,
        dividendYield: yld,
        dividendGrowth: divGrowth,
        priceGrowth,
        years,
        reinvest: true,
        monthlyContribution: monthly,
      }),
    [initial, yld, divGrowth, priceGrowth, years, monthly],
  );
  const noDrip = useMemo(
    () =>
      simulate({
        initial,
        dividendYield: yld,
        dividendGrowth: divGrowth,
        priceGrowth,
        years,
        reinvest: false,
        monthlyContribution: monthly,
      }),
    [initial, yld, divGrowth, priceGrowth, years, monthly],
  );

  const finalDrip = withDrip[withDrip.length - 1];
  const finalNoDrip = noDrip[noDrip.length - 1];

  // No-DRIP은 누적 배당을 별도 계산해야 함 (현금으로 받았다고 가정)
  const totalNoDripValue = finalNoDrip.marketValue + finalNoDrip.cumulativeDividends;
  const yieldOnCost =
    initial > 0 ? (finalDrip.dividendIncome / initial) * 100 : 0;

  const fmt = (v: number) => `₩${Math.round(v).toLocaleString()}`;

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">입력</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="ds-init" className="text-xs">초기 투자금 (원)</Label>
              <Input
                id="ds-init"
                type="number"
                value={initial}
                onChange={(e) => setInitial(Number(e.target.value) || 0)}
                step={1_000_000}
              />
            </div>
            <div>
              <Label htmlFor="ds-mo" className="text-xs">월 적립 (원)</Label>
              <Input
                id="ds-mo"
                type="number"
                value={monthly}
                onChange={(e) => setMonthly(Number(e.target.value) || 0)}
                step={100_000}
              />
            </div>
            <div>
              <Label htmlFor="ds-yld" className="text-xs">초기 배당수익률 (%)</Label>
              <Input
                id="ds-yld"
                type="number"
                value={yld}
                onChange={(e) => setYld(Number(e.target.value) || 0)}
                step={0.1}
              />
            </div>
            <div>
              <Label htmlFor="ds-divg" className="text-xs">배당 성장률 (% / 연)</Label>
              <Input
                id="ds-divg"
                type="number"
                value={divGrowth}
                onChange={(e) => setDivGrowth(Number(e.target.value) || 0)}
                step={1}
              />
            </div>
            <div>
              <Label htmlFor="ds-pg" className="text-xs">주가 상승률 (% / 연)</Label>
              <Input
                id="ds-pg"
                type="number"
                value={priceGrowth}
                onChange={(e) => setPriceGrowth(Number(e.target.value) || 0)}
                step={1}
              />
            </div>
            <div>
              <Label htmlFor="ds-y" className="text-xs">기간 (년)</Label>
              <Input
                id="ds-y"
                type="number"
                value={years}
                onChange={(e) => setYears(Number(e.target.value) || 0)}
                min={1}
                max={50}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">결과 ({years}년 후)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4">
            <div className="border rounded-lg p-3 bg-green-500/5 border-green-500/30">
              <div className="text-xs text-muted-foreground">
                🔁 배당 재투자 (DRIP)
              </div>
              <div className="text-2xl font-bold font-mono tabular-nums mt-1">
                {fmt(finalDrip.marketValue)}
              </div>
              <div className="text-xs text-muted-foreground mt-1 space-y-0.5">
                <div>주식수: {Math.round(finalDrip.shares).toLocaleString()}주</div>
                <div>마지막 해 배당: {fmt(finalDrip.dividendIncome)}</div>
                <div>Yield on Cost: {yieldOnCost.toFixed(2)}%</div>
              </div>
            </div>
            <div className="border rounded-lg p-3">
              <div className="text-xs text-muted-foreground">
                💵 배당 현금 수령 (재투자 X)
              </div>
              <div className="text-2xl font-bold font-mono tabular-nums mt-1">
                {fmt(totalNoDripValue)}
              </div>
              <div className="text-xs text-muted-foreground mt-1 space-y-0.5">
                <div>주식가치: {fmt(finalNoDrip.marketValue)}</div>
                <div>누적 배당: {fmt(finalNoDrip.cumulativeDividends)}</div>
              </div>
            </div>
          </div>

          <div className="mt-3 pt-3 border-t text-sm">
            <span className="text-muted-foreground">DRIP 추가 이익: </span>
            <span className="font-mono font-bold text-green-500">
              {fmt(finalDrip.marketValue - totalNoDripValue)} (+
              {(
                ((finalDrip.marketValue - totalNoDripValue) / totalNoDripValue) *
                100
              ).toFixed(1)}
              %)
            </span>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">시각화 (DRIP 기준)</CardTitle>
        </CardHeader>
        <CardContent>
          <YearChart rows={withDrip} />
          <div className="grid grid-cols-3 gap-2 text-[10px] text-muted-foreground mt-2">
            <span>
              <span className="inline-block w-3 h-1 bg-blue-500 align-middle mr-1" />
              주식가치
            </span>
            <span>
              <span className="inline-block w-3 h-1 bg-green-500 align-middle mr-1" />
              누적 배당
            </span>
            <span>
              <span className="inline-block w-3 h-1 bg-amber-500 align-middle mr-1" />
              마지막 해 배당
            </span>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="text-xs text-muted-foreground py-3 space-y-2">
          <p className="font-semibold text-foreground">📚 복리의 마법</p>
          <ul className="list-disc ml-4 space-y-1">
            <li>
              <strong>72의 법칙</strong>: 자산이 2배 되는 데 걸리는 햇수 ≈ 72 ÷ 연수익률. 연 7%면 약 10년, 연 10%면 약 7년.
            </li>
            <li>
              <strong>Yield on Cost</strong>: 처음 투자금 대비 현재 배당수익률. 배당이 성장하면 30년 후 YoC가 20-30%까지 가는 종목도 존재 (예: 코카콜라).
            </li>
            <li>
              <strong>DRIP의 위력</strong>: 배당을 다시 사면 다음 해 더 많은 배당을 받는 → 지수함수적 성장.
            </li>
            <li>
              <strong>주의</strong>: 시뮬은 일정한 수익률을 가정. 실제는 변동성 있어 평균 수익률이라도 결과가 다를 수 있음 (sequence-of-returns risk).
            </li>
          </ul>
        </CardContent>
      </Card>
    </>
  );
}

function YearChart({ rows }: { rows: YearRow[] }) {
  if (rows.length < 2) return null;
  const W = 320;
  const H = 140;
  const maxVal = Math.max(
    ...rows.map((r) => Math.max(r.marketValue, r.cumulativeDividends, r.dividendIncome * 10)),
  );
  const xStep = W / (rows.length - 1);

  function pathFor(get: (r: YearRow) => number): string {
    return rows
      .map((r, i) => {
        const x = i * xStep;
        const y = H - (get(r) / maxVal) * H;
        return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(" ");
  }

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-32" preserveAspectRatio="none">
      <path
        d={pathFor((r) => r.marketValue)}
        fill="none"
        stroke="#3b82f6"
        strokeWidth="2"
      />
      <path
        d={pathFor((r) => r.cumulativeDividends)}
        fill="none"
        stroke="#22c55e"
        strokeWidth="2"
      />
      <path
        d={pathFor((r) => r.dividendIncome * 10)}
        fill="none"
        stroke="#f59e0b"
        strokeWidth="1.5"
        strokeDasharray="3,2"
      />
    </svg>
  );
}
