"use client";

import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

// 자산군별 historical 연평균 수익률 / 변동성 (학습용 간소화).
// 출처 — 1996-2025 미국 시장 대략적 수치.
type AssetClass = {
  key: string;
  name: string;
  emoji: string;
  expectedReturn: number;   // 연평균 (%)
  volatility: number;        // 연 표준편차 (%)
  description: string;
};

const ASSETS: AssetClass[] = [
  {
    key: "us_stocks",
    name: "미국 주식 (S&P 500)",
    emoji: "📈",
    expectedReturn: 10,
    volatility: 16,
    description: "장기 최고 성과 자산. 단기 변동성 큼",
  },
  {
    key: "kr_stocks",
    name: "한국 주식 (KOSPI)",
    emoji: "🇰🇷",
    expectedReturn: 7,
    volatility: 20,
    description: "신흥국 특성 — 사이클이 미국보다 짧고 변동성 큼",
  },
  {
    key: "us_bonds",
    name: "미국 장기국채",
    emoji: "📜",
    expectedReturn: 4,
    volatility: 8,
    description: "위기 시 안전자산. 주식과 음의 상관관계 (보통)",
  },
  {
    key: "gold",
    name: "금",
    emoji: "🥇",
    expectedReturn: 5,
    volatility: 14,
    description: "인플레/위기 hedge. 캐시플로 없음",
  },
  {
    key: "reit",
    name: "리츠 (부동산)",
    emoji: "🏢",
    expectedReturn: 8,
    volatility: 18,
    description: "배당+성장. 금리 민감",
  },
  {
    key: "cash",
    name: "현금 / MMF",
    emoji: "💵",
    expectedReturn: 2.5,
    volatility: 1,
    description: "기준금리 ~ 단기 채권. 무위험 자산",
  },
];

const PRESETS: { name: string; description: string; weights: Record<string, number> }[] = [
  {
    name: "60/40 클래식",
    description: "주식 60% + 장기국채 40% — 가장 유명한 자산배분",
    weights: { us_stocks: 60, us_bonds: 40 },
  },
  {
    name: "All-Weather (Ray Dalio)",
    description: "어떤 경제 환경에서도 살아남는 분산 (1996~ 평균 7%/연)",
    weights: { us_stocks: 30, us_bonds: 55, gold: 7.5, reit: 7.5 },
  },
  {
    name: "공격적 (90/10)",
    description: "주식 비중 극대화 — 장기 수익률 최우선",
    weights: { us_stocks: 70, kr_stocks: 20, us_bonds: 10 },
  },
  {
    name: "보수적 (30/70)",
    description: "안정성 위주 — 손실 최소화",
    weights: { us_stocks: 20, us_bonds: 60, cash: 20 },
  },
  {
    name: "한국 투자자",
    description: "본국 편향 + 분산",
    weights: { kr_stocks: 50, us_stocks: 30, us_bonds: 15, gold: 5 },
  },
];

function expectedReturn(weights: Record<string, number>): number {
  let total = 0;
  let sumW = 0;
  for (const a of ASSETS) {
    const w = weights[a.key] ?? 0;
    total += w * a.expectedReturn;
    sumW += w;
  }
  return sumW > 0 ? total / sumW : 0;
}

// 단순 가정: 자산 간 상관계수 0.3 평균 (실제는 자산쌍마다 다름)
// portfolio variance = Σ wᵢ²σᵢ² + 2 Σᵢ<ⱼ wᵢwⱼ σᵢσⱼ ρ
function expectedVol(weights: Record<string, number>): number {
  const RHO = 0.3;
  const wsum = Object.values(weights).reduce((s, v) => s + v, 0);
  if (wsum === 0) return 0;
  const norm: Record<string, number> = {};
  for (const a of ASSETS) norm[a.key] = (weights[a.key] ?? 0) / wsum;
  let variance = 0;
  for (const a of ASSETS) {
    variance += (norm[a.key] * a.volatility) ** 2;
  }
  for (let i = 0; i < ASSETS.length; i++) {
    for (let j = i + 1; j < ASSETS.length; j++) {
      const wi = norm[ASSETS[i].key];
      const wj = norm[ASSETS[j].key];
      const si = ASSETS[i].volatility;
      const sj = ASSETS[j].volatility;
      variance += 2 * wi * wj * si * sj * RHO;
    }
  }
  return Math.sqrt(Math.max(0, variance));
}

// 30년 후 100만원 → ?
function simulateGrowth(weights: Record<string, number>, years: number = 30): number {
  const r = expectedReturn(weights) / 100;
  return Math.pow(1 + r, years);
}

export function AllocationClient() {
  const [weights, setWeights] = useState<Record<string, number>>({
    us_stocks: 60,
    us_bonds: 40,
  });
  const [initial, setInitial] = useState(10_000_000); // 1천만원

  const sumWeights = useMemo(
    () => Object.values(weights).reduce((s, v) => s + v, 0),
    [weights],
  );
  const isValid = Math.abs(sumWeights - 100) < 0.5;

  const annReturn = expectedReturn(weights);
  const annVol = expectedVol(weights);
  const sharpe = annVol > 0 ? (annReturn - 2.5) / annVol : 0; // Risk-free = MMF 2.5%

  const futureValue = initial * simulateGrowth(weights, 30);
  const fv10 = initial * simulateGrowth(weights, 10);
  const fv20 = initial * simulateGrowth(weights, 20);

  // 1-year VaR (95% confidence): mean - 1.65σ
  const oneYearLoss = ((annReturn - 1.65 * annVol) / 100) * initial;

  function applyPreset(p: typeof PRESETS[number]) {
    setWeights({ ...p.weights });
  }

  function updateWeight(key: string, val: number) {
    setWeights({ ...weights, [key]: val });
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">유명 전략 프리셋</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {PRESETS.map((p) => (
              <button
                key={p.name}
                onClick={() => applyPreset(p)}
                className="text-left border rounded-lg p-2.5 hover:bg-accent hover:border-primary/40 transition"
              >
                <div className="font-medium text-sm">{p.name}</div>
                <div className="text-[10px] text-muted-foreground mt-0.5">
                  {p.description}
                </div>
              </button>
            ))}
            <button
              onClick={() => setWeights({})}
              className="text-left border rounded-lg p-2.5 hover:bg-accent transition text-sm font-medium text-muted-foreground"
            >
              초기화 (직접 입력)
            </button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center justify-between">
            <span>자산 배분 (합 100%)</span>
            <span
              className={`text-xs font-mono ${
                isValid ? "text-green-500" : "text-amber-500"
              }`}
            >
              {sumWeights.toFixed(0)}%
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {ASSETS.map((a) => (
              <div key={a.key}>
                <div className="flex items-center justify-between mb-0.5">
                  <Label className="text-sm">
                    {a.emoji} {a.name}
                  </Label>
                  <span className="font-mono text-sm tabular-nums">
                    {(weights[a.key] ?? 0).toFixed(0)}%
                  </span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={5}
                  value={weights[a.key] ?? 0}
                  onChange={(e) => updateWeight(a.key, Number(e.target.value))}
                  className="w-full accent-primary"
                />
                <div className="text-[10px] text-muted-foreground">
                  연 {a.expectedReturn}% · σ {a.volatility}% · {a.description}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">초기 투자금</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2 items-baseline">
            <span className="font-mono text-2xl font-bold">
              ₩{initial.toLocaleString()}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setInitial(initial / 10)}
            >
              ÷10
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setInitial(initial * 10)}
            >
              ×10
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">예상 수익 (장기)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-3">
            <Stat label="10년 후" value={`₩${Math.round(fv10).toLocaleString()}`} />
            <Stat label="20년 후" value={`₩${Math.round(fv20).toLocaleString()}`} />
            <Stat
              label="30년 후"
              value={`₩${Math.round(futureValue).toLocaleString()}`}
              primary
            />
            <Stat label="연평균 수익률" value={`${annReturn.toFixed(2)}%`} />
            <Stat
              label="연 변동성 (σ)"
              value={`${annVol.toFixed(2)}%`}
              hint="작을수록 안정"
            />
            <Stat
              label="Sharpe Ratio"
              value={sharpe.toFixed(2)}
              hint="높을수록 우수"
            />
          </div>
          <div className="mt-3 pt-3 border-t text-xs text-muted-foreground">
            ⚠️ <strong>1년 95% VaR</strong>: 1년 후 최악의 경우 ₩
            {Math.round(Math.abs(oneYearLoss)).toLocaleString()} 가량 손실
            가능성 5% (정규분포 가정 — 실제 fat-tail risk는 더 큼).
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="text-xs text-muted-foreground py-3 space-y-2">
          <p className="font-semibold text-foreground">📚 분산의 가치</p>
          <ul className="list-disc ml-4 space-y-1">
            <li>
              <strong>주식만 100%</strong>: 연 10%/σ 16% — 30년 후 16.4배. 단, -50% 약세장 견딜 인내심 필요.
            </li>
            <li>
              <strong>60/40 (주식 60% + 채권 40%)</strong>: 연 7.6%/σ 11.7%. Sharpe ↑ — 같은 위험으로 더 높은 수익.
            </li>
            <li>
              <strong>All-Weather</strong>: 가장 보수적 분산. 2008·2020 위기에도 -20% 미만으로 방어.
            </li>
            <li>
              <strong>현금 100%</strong>: 연 2.5% — 인플레 3% 가정 시 <em>실질 마이너스</em>. 단기 자금만.
            </li>
          </ul>
          <p className="mt-2">
            상관계수는 일정 평균 0.3을 가정. 위기 시에는 상관관계가 1로 수렴(&quot;all correlations go to 1&quot;)해 분산효과 약화될 수 있음.
          </p>
        </CardContent>
      </Card>
    </>
  );
}

function Stat({
  label,
  value,
  hint,
  primary,
}: {
  label: string;
  value: string;
  hint?: string;
  primary?: boolean;
}) {
  return (
    <div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div
        className={`font-mono tabular-nums ${
          primary ? "text-base font-bold" : "text-sm font-medium"
        }`}
      >
        {value}
      </div>
      {hint && (
        <div className="text-[9px] text-muted-foreground">{hint}</div>
      )}
    </div>
  );
}
