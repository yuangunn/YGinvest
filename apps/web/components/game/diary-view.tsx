"use client";

// Plan #36: 일기 뷰 — game_day별 entry를 일기 형식으로.
// Plan #37: 모드 변경 시 부모에 알림 (헤더 즉시 갱신) + 모드별 예상 수입 표시.

import { useEffect, useState } from "react";
import { BookOpen, Calendar } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  PLAY_MODES,
  modeIncomeEstimate,
  type PlayMode,
} from "@/lib/game/constants";
import { toast } from "sonner";

const KRW = new Intl.NumberFormat("ko-KR", {
  style: "currency",
  currency: "KRW",
  maximumFractionDigits: 0,
});

function manwon(n: number): string {
  return `${Math.round(n / 10000).toLocaleString()}만원`;
}

type DiaryEntry = {
  game_day: number;
  real_date: string;
  entry_type: "activity" | "event" | "milestone" | "trade" | "market";
  emoji: string;
  summary: string;
  cash_delta: number;
  metadata: Record<string, unknown> | null;
};

type Props = {
  currentMode: PlayMode;
  currentDay: number;
  unlocks: Record<string, number>;
  onModeChange: (newMode: PlayMode) => void;
};

export function DiaryView({ currentMode, currentDay, unlocks, onModeChange }: Props) {
  const [entries, setEntries] = useState<DiaryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [modeChanging, setModeChanging] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await fetch("/api/game/diary?limit=150");
      if (cancelled) return;
      const data = await res.json();
      if (cancelled) return;
      setEntries((data.entries ?? []) as DiaryEntry[]);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function changeMode(newMode: PlayMode) {
    if (newMode === currentMode) return;
    setModeChanging(true);
    try {
      const res = await fetch("/api/game/mode", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: newMode }),
      });
      if (!res.ok) {
        toast.error("모드 변경 실패");
        return;
      }
      // Plan #37: 부모(Dashboard)에 알려서 헤더 뱃지 즉시 갱신
      onModeChange(newMode);
      toast.success(`모드 변경: ${PLAY_MODES[newMode].label}`);
    } finally {
      setModeChanging(false);
    }
  }

  // day별 그룹화
  const byDay = new Map<number, DiaryEntry[]>();
  for (const e of entries) {
    const arr = byDay.get(e.game_day) ?? [];
    arr.push(e);
    byDay.set(e.game_day, arr);
  }
  const sortedDays = Array.from(byDay.keys()).sort((a, b) => b - a);

  // 영구 업그레이드 효과 표시 (모드 카드에 같이)
  const upgradeNotes: string[] = [];
  if ((unlocks["parttime_bonus"] ?? 0) > 0)
    upgradeNotes.push(`💪 알바 +${(unlocks["parttime_bonus"] ?? 0) * 10}%`);
  if ((unlocks["fulltime_bonus"] ?? 0) > 0)
    upgradeNotes.push(`💼 정규직 +${(unlocks["fulltime_bonus"] ?? 0) * 10}%`);
  if ((unlocks["mentor_effect"] ?? 0) > 0)
    upgradeNotes.push(`👨‍🏫 멘토 (지력 +50%)`);
  if ((unlocks["good_luck"] ?? 0) > 0)
    upgradeNotes.push(`🍀 행운 (긍정 이벤트 +25%)`);

  return (
    <div className="space-y-3">
      {/* 모드 변경 카드 + 예상 수입 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm flex items-center justify-between">
            <span>플레이 모드</span>
            {upgradeNotes.length > 0 && (
              <span className="text-[10px] font-normal text-muted-foreground">
                {upgradeNotes.join(" · ")}
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-1.5">
          {(["balanced", "income", "learning"] as const).map((m) => {
            const def = PLAY_MODES[m];
            const est = modeIncomeEstimate(m, unlocks);
            const isCurrent = m === currentMode;
            return (
              <button
                key={m}
                type="button"
                disabled={modeChanging || isCurrent}
                onClick={() => changeMode(m)}
                className={`w-full text-left rounded-md border p-2.5 transition-colors ${
                  isCurrent
                    ? "border-primary bg-primary/10 cursor-default"
                    : "hover:bg-accent cursor-pointer"
                }`}
              >
                <div className="flex items-center justify-between flex-wrap gap-1">
                  <div className="font-semibold text-sm flex items-center gap-1.5">
                    {def.emoji} {def.label}
                    {isCurrent && (
                      <span className="text-[10px] rounded border border-primary/40 bg-primary/10 text-primary px-1 py-0.5">
                        현재
                      </span>
                    )}
                  </div>
                  <span className="text-[10px] text-muted-foreground">
                    일 {Math.round(def.weights.work * 100)}% · 공부{" "}
                    {Math.round(def.weights.study * 100)}%
                  </span>
                </div>
                <div className="text-[11px] text-muted-foreground mt-0.5">
                  {def.description}
                </div>
                {/* Plan #39: 모드별 일일 수입 + 지력 (시간 할당 모델) */}
                <div className="mt-1.5 pt-1.5 border-t border-border/40 grid grid-cols-2 gap-x-3 gap-y-0.5 text-[10px]">
                  <div>
                    <span className="text-muted-foreground">알바 매일</span>{" "}
                    <span className="font-mono font-semibold text-emerald-600 dark:text-emerald-400">
                      {est.parttimeDaily > 0 ? manwon(est.parttimeDaily) : "—"}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">사원 매일</span>{" "}
                    <span className="font-mono font-semibold text-emerald-600 dark:text-emerald-400">
                      {est.fulltimeDaily > 0 ? manwon(est.fulltimeDaily) : "—"}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">지력 매일</span>{" "}
                    <span className="font-mono font-semibold text-purple-500">
                      +{est.dailyIntelligence}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">알바 주간</span>{" "}
                    <span className="font-mono">
                      {est.weeklyParttime > 0 ? manwon(est.weeklyParttime) : "—"}
                    </span>
                  </div>
                </div>
              </button>
            );
          })}
          <p className="text-[10px] text-muted-foreground pt-1">
            💡 매일 시간 할당 비율대로 수입/지력 동시 획득. 확률 X.
          </p>
        </CardContent>
      </Card>

      {/* 일기 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <BookOpen className="h-4 w-4 text-primary" />
            인생 일기
          </CardTitle>
          <p className="text-[11px] text-muted-foreground mt-1">
            현재 D+{currentDay}일차 · 가끔 들어와서 확인하세요
          </p>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-xs text-muted-foreground">로딩 중...</p>
          ) : entries.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              아직 일기가 없어요. 1시간 후 첫 일기가 작성됩니다.
            </p>
          ) : (
            <div className="space-y-3 max-h-[600px] overflow-y-auto pr-1">
              {sortedDays.map((day) => {
                const dayEntries = byDay.get(day) ?? [];
                const firstEntry = dayEntries[0];
                const date = new Date(firstEntry.real_date);
                const dateStr = date.toLocaleDateString("ko-KR", {
                  month: "long",
                  day: "numeric",
                  weekday: "short",
                });
                const dayCashDelta = dayEntries.reduce(
                  (sum, e) => sum + Number(e.cash_delta),
                  0,
                );
                return (
                  <div key={day} className="border-l-2 border-primary/40 pl-3 space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Calendar className="h-3 w-3 text-muted-foreground" />
                      <span className="text-xs font-semibold">
                        D+{day} · {dateStr}
                      </span>
                      {dayCashDelta !== 0 && (
                        <span
                          className={`text-[10px] tabular-nums ${
                            dayCashDelta > 0
                              ? "text-emerald-600 dark:text-emerald-400"
                              : "text-red-500"
                          }`}
                        >
                          {dayCashDelta > 0 ? "+" : ""}
                          {KRW.format(dayCashDelta)}
                        </span>
                      )}
                    </div>
                    {dayEntries.map((e, i) => (
                      <DiaryEntryRow key={i} entry={e} />
                    ))}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function DiaryEntryRow({ entry }: { entry: DiaryEntry }) {
  const typeColor = {
    activity: "text-foreground",
    event: "text-amber-600 dark:text-amber-400",
    milestone: "text-purple-600 dark:text-purple-400 font-semibold",
    trade: "text-blue-600 dark:text-blue-400",
    market: "text-cyan-600 dark:text-cyan-400",
  }[entry.entry_type];

  return (
    <div className={`text-xs flex items-start gap-1.5 ${typeColor}`}>
      <span className="text-sm flex-shrink-0">{entry.emoji}</span>
      <span className="flex-1">{entry.summary}</span>
    </div>
  );
}
