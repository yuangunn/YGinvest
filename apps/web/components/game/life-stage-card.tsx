"use client";

// Plan #40: 인생 단계 UI — 결혼/자녀/은퇴 액션.

import { useState } from "react";
import { Heart, Baby, Sunset, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  canMarry,
  canHaveChild,
  MARRIAGE_INTELLIGENCE_REQ,
  MARRIAGE_CASH_REQ,
  CHILD_INTELLIGENCE_REQ,
  CHILD_CASH_REQ,
  RETIREMENT_FULLTIME_DAYS,
} from "@/lib/game/constants";

const KRW = new Intl.NumberFormat("ko-KR", {
  style: "currency",
  currency: "KRW",
  maximumFractionDigits: 0,
});

type Props = {
  intelligence: number;
  cash: number;
  isMarried: boolean;
  marriedAt: string | null;
  childrenCount: number;
  isRetired: boolean;
  jobType: string;
  currentDay: number;
  lifeStartedAt: string;
  onAction: () => void;
};

export function LifeStageCard({
  intelligence,
  cash,
  isMarried,
  marriedAt,
  childrenCount,
  isRetired,
  jobType,
  currentDay,
  lifeStartedAt,
  onAction,
}: Props) {
  const [submitting, setSubmitting] = useState<string | null>(null);

  async function act(action: "marry" | "child" | "retire") {
    setSubmitting(action);
    try {
      const res = await fetch("/api/game/life-stage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(`${data.error}${data.hint ? " — " + data.hint : ""}`);
        return;
      }
      if (action === "marry") toast.success("💒 결혼! 새 인생의 동반자");
      else if (action === "child") toast.success("👶 새 자녀 출생!");
      else toast.success(`🌅 은퇴! 월 연금 ${Math.round((data.monthly_pension ?? 0) / 10000)}만원`);
      onAction();
    } finally {
      setSubmitting(null);
    }
  }

  const marryOk = canMarry(intelligence, cash, isMarried);
  const marriedDay = marriedAt
    ? Math.floor(
        (new Date(marriedAt).getTime() - new Date(lifeStartedAt).getTime()) /
          3_600_000,
      )
    : 0;
  const childOk = canHaveChild(
    intelligence,
    cash,
    isMarried,
    marriedDay,
    currentDay,
    childrenCount,
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">🏡 인생 단계</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {/* 결혼 */}
        {!isMarried ? (
          <div className="rounded-md border p-2.5">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-semibold flex items-center gap-1">
                  <Heart className="h-3.5 w-3.5 text-pink-500" />
                  결혼
                </div>
                <div className="text-[10px] text-muted-foreground mt-0.5">
                  지력 {MARRIAGE_INTELLIGENCE_REQ}+ · {KRW.format(MARRIAGE_CASH_REQ)}+
                </div>
              </div>
              <Button
                size="sm"
                disabled={!marryOk || submitting === "marry"}
                onClick={() => act("marry")}
              >
                {submitting === "marry" ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  "결혼하기"
                )}
              </Button>
            </div>
          </div>
        ) : (
          <div className="rounded-md border bg-pink-500/5 border-pink-500/30 p-2.5">
            <div className="text-sm font-semibold flex items-center gap-1">
              <Heart className="h-3.5 w-3.5 text-pink-500" />
              💒 기혼 · 자녀 {childrenCount}명
            </div>
          </div>
        )}

        {/* 자녀 */}
        {isMarried && childrenCount < 3 && (
          <div className="rounded-md border p-2.5">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-semibold flex items-center gap-1">
                  <Baby className="h-3.5 w-3.5 text-orange-400" />
                  자녀 {childrenCount + 1}번째
                </div>
                <div className="text-[10px] text-muted-foreground mt-0.5">
                  지력 {CHILD_INTELLIGENCE_REQ}+ · {KRW.format(CHILD_CASH_REQ)}+ · 결혼 60일 후
                </div>
              </div>
              <Button
                size="sm"
                disabled={!childOk || submitting === "child"}
                onClick={() => act("child")}
              >
                {submitting === "child" ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  "자녀 갖기"
                )}
              </Button>
            </div>
            <div className="text-[10px] text-muted-foreground mt-1">
              ⚠️ 자녀당 매일 양육비 5천원 자동 지출
            </div>
          </div>
        )}

        {/* 은퇴 */}
        {!isRetired && jobType === "fulltime" && (
          <div className="rounded-md border p-2.5">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-semibold flex items-center gap-1">
                  <Sunset className="h-3.5 w-3.5 text-amber-500" />
                  은퇴 (연금 시작)
                </div>
                <div className="text-[10px] text-muted-foreground mt-0.5">
                  정규직 누적 {RETIREMENT_FULLTIME_DAYS}일+ 필요
                </div>
              </div>
              <Button
                size="sm"
                variant="outline"
                disabled={submitting === "retire"}
                onClick={() => act("retire")}
              >
                {submitting === "retire" ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  "은퇴"
                )}
              </Button>
            </div>
          </div>
        )}
        {isRetired && (
          <div className="rounded-md border bg-amber-500/5 border-amber-500/30 p-2.5">
            <div className="text-sm font-semibold flex items-center gap-1">
              <Sunset className="h-3.5 w-3.5 text-amber-500" />
              🌅 은퇴 · 매 30일 연금 입금
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
