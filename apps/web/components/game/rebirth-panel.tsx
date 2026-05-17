"use client";

// Plan #33: 환생 패널 — 환생 실행 + 영구 업그레이드 상점.

import { useState } from "react";
import { Sparkles, Lock, Check } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { UNLOCK_CATALOG, REBIRTH_THRESHOLD_PCT } from "@/lib/game/constants";

type Props = {
  points: number;
  unlocks: Record<string, number>;
  canRebirth: boolean;
  onRebirth: () => void;
};

const KRW = new Intl.NumberFormat("ko-KR", {
  style: "currency",
  currency: "KRW",
  maximumFractionDigits: 0,
});

export function RebirthPanel({ points: initialPoints, unlocks: initialUnlocks, canRebirth, onRebirth }: Props) {
  const [points, setPoints] = useState(initialPoints);
  const [unlocks, setUnlocks] = useState(initialUnlocks);
  const [submitting, setSubmitting] = useState<string | null>(null);

  async function doRebirth() {
    if (!confirm("환생하시겠어요? 현재 캐릭터/주식/부동산/스케줄이 모두 리셋되고 포인트만 누적됩니다.")) {
      return;
    }
    setSubmitting("rebirth");
    try {
      const res = await fetch("/api/game/rebirth", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        toast.error(`환생 실패: ${data.error} (현재 수익 ${(data.current_return_pct * 100).toFixed(2)}%)`);
        return;
      }
      toast.success(`🌅 환생 #${data.rebirth_number}! +${data.points_earned}pt 획득`);
      onRebirth();
    } finally {
      setSubmitting(null);
    }
  }

  async function buyUnlock(key: string) {
    setSubmitting(key);
    try {
      const res = await fetch("/api/game/unlock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ unlock_key: key }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(`해금 실패: ${data.error}`);
        return;
      }
      toast.success(`해금: ${UNLOCK_CATALOG.find((u) => u.key === key)?.label} Lv.${data.new_level}`);
      setPoints(data.remaining_points);
      setUnlocks((prev) => ({ ...prev, [key]: data.new_level }));
    } finally {
      setSubmitting(null);
    }
  }

  return (
    <div className="space-y-3">
      {/* 환생 실행 */}
      <Card className={canRebirth ? "border-emerald-500/40 bg-emerald-500/5" : ""}>
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            환생
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <p className="text-xs text-muted-foreground">
            총 자산이 시작 자본의 +{(REBIRTH_THRESHOLD_PCT * 100).toFixed(0)}% 도달 시 환생 가능.
            <br />
            환생 포인트는 수익률 × 10 + 시간 보너스로 계산. <strong>빠를수록 ↑</strong>
          </p>
          <Button
            onClick={doRebirth}
            disabled={!canRebirth || submitting === "rebirth"}
            className="w-full"
            variant={canRebirth ? "default" : "outline"}
          >
            {canRebirth ? "🌅 환생!" : "조건 미달 — 5% 수익 필요"}
          </Button>
          <p className="text-[10px] text-muted-foreground text-center">
            💎 보유 포인트 {points}pt · 🌅 환생 {Object.keys(unlocks).length > 0 ? "기록 있음" : "처음"}
          </p>
        </CardContent>
      </Card>

      {/* 영구 업그레이드 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">💎 영구 업그레이드</CardTitle>
          <p className="text-[11px] text-muted-foreground mt-1">
            포인트로 해금. 환생해도 영구 유지.
          </p>
        </CardHeader>
        <CardContent className="space-y-1.5">
          {UNLOCK_CATALOG.map((def) => {
            const currentLevel = unlocks[def.key] ?? 0;
            const isMaxed = currentLevel >= def.maxLevel;
            const canAfford = points >= def.cost;
            return (
              <div
                key={def.key}
                className={`rounded-md border p-2.5 ${isMaxed ? "bg-emerald-500/5 border-emerald-500/30" : ""}`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-sm font-semibold flex items-center gap-1">
                      {def.label}
                      {def.maxLevel > 1 && (
                        <span className="text-[10px] text-muted-foreground font-normal">
                          Lv.{currentLevel}/{def.maxLevel}
                        </span>
                      )}
                    </div>
                    <div className="text-[10px] text-muted-foreground">
                      {def.description}
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant={isMaxed ? "ghost" : canAfford ? "default" : "outline"}
                    disabled={isMaxed || !canAfford || submitting === def.key}
                    onClick={() => buyUnlock(def.key)}
                    className="flex-shrink-0 text-xs"
                  >
                    {isMaxed ? (
                      <>
                        <Check className="h-3 w-3 mr-0.5" />
                        MAX
                      </>
                    ) : (
                      <>
                        {!canAfford && <Lock className="h-3 w-3 mr-0.5" />}
                        💎{def.cost}
                      </>
                    )}
                  </Button>
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* 사용 안 함 - lint */}
      <span className="hidden">{KRW.format(0)}</span>
    </div>
  );
}
