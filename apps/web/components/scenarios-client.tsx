"use client";

import { useMemo, useState } from "react";
import { TrendingDown, TrendingUp } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { sensitivityForSector } from "@/lib/macro-sensitivity";

type Position = {
  symbol: string;
  name: string;
  sector: string | null;
  currency: string;
  value: number; // 원래 통화 기준
};

type Props = {
  positions: Position[];
};

// FX 환산용 — 클라이언트에서는 1,400원 가정 (정확한 값은 시나리오 분석에 큰 영향 없음)
const USD_KRW_DEFAULT = 1400;

function toKrw(value: number, currency: string): number {
  return currency === "KRW" ? value : value * USD_KRW_DEFAULT;
}

export function ScenariosClient({ positions }: Props) {
  const [rateDelta, setRateDelta] = useState(0); // %p, -2 ~ +2
  const [fxDelta, setFxDelta] = useState(0);     // %, -15 ~ +15
  const [oilDelta, setOilDelta] = useState(0);   // %, -40 ~ +40
  const [vixDelta, setVixDelta] = useState(0);   // pt, -10 ~ +30

  const totalValueKrw = useMemo(
    () => positions.reduce((s, p) => s + toKrw(p.value, p.currency), 0),
    [positions],
  );

  // 각 종목별 영향 추정
  const impacts = useMemo(() => {
    return positions.map((p) => {
      const sens = sensitivityForSector(p.sector);
      // 단순 선형 합산. 단위는 sensitivity의 표준 단위 가정과 일치시키기:
      //   rate: +1%p → sens.rate%
      //   fx: -10% (KRW 약세) → sens.fx%  (즉 fxDelta가 +이면 USDKRW ↑ = 원화 약세)
      //   oil: +20% → sens.oil%
      //   vix: +10pt → sens.vix%
      const pctChange =
        (rateDelta / 1) * sens.rate +
        (fxDelta / 10) * sens.fx +
        (oilDelta / 20) * sens.oil +
        (vixDelta / 10) * sens.vix;
      const valueKrw = toKrw(p.value, p.currency);
      const deltaKrw = (valueKrw * pctChange) / 100;
      return {
        ...p,
        pctChange,
        deltaKrw,
        valueKrw,
      };
    });
  }, [positions, rateDelta, fxDelta, oilDelta, vixDelta]);

  const totalDeltaKrw = impacts.reduce((s, i) => s + i.deltaKrw, 0);
  const totalPct =
    totalValueKrw > 0 ? (totalDeltaKrw / totalValueKrw) * 100 : 0;

  // Sort by largest absolute impact
  const sorted = [...impacts].sort((a, b) => Math.abs(b.deltaKrw) - Math.abs(a.deltaKrw));

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">시나리오 입력</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <ScenarioSlider
            label="기준금리"
            value={rateDelta}
            onChange={setRateDelta}
            min={-2}
            max={2}
            step={0.25}
            unit="%p"
            description="Fed/한은 금리 변동 — +면 인상"
          />
          <ScenarioSlider
            label="원달러 환율"
            value={fxDelta}
            onChange={setFxDelta}
            min={-15}
            max={15}
            step={1}
            unit="%"
            description="+면 원화 약세 (USDKRW 상승)"
          />
          <ScenarioSlider
            label="WTI 유가"
            value={oilDelta}
            onChange={setOilDelta}
            min={-40}
            max={40}
            step={5}
            unit="%"
            description="+면 유가 상승"
          />
          <ScenarioSlider
            label="VIX (변동성)"
            value={vixDelta}
            onChange={setVixDelta}
            min={-10}
            max={30}
            step={2}
            unit="pt"
            description="+면 패닉 / 위험회피 강화"
          />
        </CardContent>
      </Card>

      <Card
        className={
          totalPct >= 0
            ? "border-green-500/30 bg-green-500/5"
            : "border-red-500/30 bg-red-500/5"
        }
      >
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            {totalPct >= 0 ? (
              <TrendingUp className="h-4 w-4 text-green-500" />
            ) : (
              <TrendingDown className="h-4 w-4 text-red-500" />
            )}
            예상 포트폴리오 영향
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-xs text-muted-foreground">
            현재 가치 ≈ ₩{Math.round(totalValueKrw).toLocaleString()}
          </div>
          <div
            className={`text-3xl font-bold font-mono tabular-nums mt-1 ${
              totalPct >= 0 ? "text-green-500" : "text-red-500"
            }`}
          >
            {totalPct >= 0 ? "+" : ""}
            {totalPct.toFixed(2)}%
          </div>
          <div
            className={`text-sm font-mono tabular-nums ${
              totalDeltaKrw >= 0 ? "text-green-500" : "text-red-500"
            }`}
          >
            {totalDeltaKrw >= 0 ? "+" : ""}₩
            {Math.round(totalDeltaKrw).toLocaleString()}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">종목별 영향 (영향순)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-1.5">
            {sorted.slice(0, 15).map((p) => (
              <div
                key={p.symbol}
                className="flex items-center justify-between gap-2 text-xs py-1 border-b last:border-0"
              >
                <div className="flex-1 min-w-0">
                  <div className="truncate font-medium">{p.name}</div>
                  <div className="text-[10px] text-muted-foreground truncate">
                    {p.sector ?? "—"}
                  </div>
                </div>
                <div className="text-right flex-shrink-0">
                  <div
                    className={`font-mono tabular-nums ${
                      p.pctChange >= 0 ? "text-green-500" : "text-red-500"
                    }`}
                  >
                    {p.pctChange >= 0 ? "+" : ""}
                    {p.pctChange.toFixed(2)}%
                  </div>
                  <div className="text-[10px] text-muted-foreground tabular-nums">
                    {p.deltaKrw >= 0 ? "+" : ""}₩
                    {Math.round(p.deltaKrw).toLocaleString()}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="text-xs text-muted-foreground py-3 space-y-2">
          <p className="font-semibold text-foreground">📚 핵심 관계 학습</p>
          <ul className="space-y-1 list-disc ml-4">
            <li>
              <strong>금리 ↑ → 성장주(테크/반도체) 직격</strong>: 미래현금흐름의 할인율이 높아져 멀티플 축소. 부동산은 더 큰 타격.
            </li>
            <li>
              <strong>금리 ↑ → 금융(은행) 우호</strong>: 예대마진 확대.
            </li>
            <li>
              <strong>원화 약세 → 수출주(반도체/자동차) 우호</strong>: 달러 매출의 원화 환산액 증가.
            </li>
            <li>
              <strong>유가 ↑ → 에너지 강세, 항공·소비재 약세</strong>: 항공은 연료비 직격.
            </li>
            <li>
              <strong>VIX ↑ → 모든 주식 약세</strong>: 방어주(필수소비재/유틸리티)는 덜 빠짐.
            </li>
          </ul>
        </CardContent>
      </Card>
    </>
  );
}

function ScenarioSlider({
  label,
  value,
  onChange,
  min,
  max,
  step,
  unit,
  description,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  step: number;
  unit: string;
  description: string;
}) {
  return (
    <div>
      <div className="flex items-baseline justify-between mb-1">
        <Label className="text-sm">{label}</Label>
        <span
          className={`font-mono text-sm tabular-nums ${
            value > 0 ? "text-red-500" : value < 0 ? "text-blue-500" : ""
          }`}
        >
          {value > 0 ? "+" : ""}
          {value.toFixed(unit === "pt" ? 0 : 2)}
          {unit}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-primary"
      />
      <div className="text-[10px] text-muted-foreground mt-0.5">{description}</div>
    </div>
  );
}
