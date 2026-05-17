"use client";

// Plan #36: 일기 뷰 — game_day별 entry를 그룹화해서 일기 형식으로.

import { useEffect, useState } from "react";
import { BookOpen, Calendar } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PLAY_MODES, type PlayMode } from "@/lib/game/constants";
import { toast } from "sonner";

const KRW = new Intl.NumberFormat("ko-KR", {
  style: "currency",
  currency: "KRW",
  maximumFractionDigits: 0,
});

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
};

export function DiaryView({ currentMode, currentDay }: Props) {
  const [entries, setEntries] = useState<DiaryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<PlayMode>(currentMode);
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
      setMode(newMode);
      toast.success(`모드 변경: ${PLAY_MODES[newMode].label}`);
    } finally {
      setModeChanging(false);
    }
  }

  // day별 그룹화 (entries는 game_day desc 정렬되어 옴)
  const byDay = new Map<number, DiaryEntry[]>();
  for (const e of entries) {
    const arr = byDay.get(e.game_day) ?? [];
    arr.push(e);
    byDay.set(e.game_day, arr);
  }
  const sortedDays = Array.from(byDay.keys()).sort((a, b) => b - a);

  return (
    <div className="space-y-3">
      {/* 모드 변경 카드 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">현재 모드</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1.5">
          {(["balanced", "income", "learning"] as const).map((m) => {
            const def = PLAY_MODES[m];
            return (
              <button
                key={m}
                type="button"
                disabled={modeChanging || mode === m}
                onClick={() => changeMode(m)}
                className={`w-full text-left rounded-md border p-2.5 transition-colors ${
                  mode === m
                    ? "border-primary bg-primary/10 cursor-default"
                    : "hover:bg-accent cursor-pointer"
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="font-semibold text-sm flex items-center gap-1.5">
                    {def.emoji} {def.label}
                    {mode === m && (
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
              </button>
            );
          })}
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
              아직 일기가 없어요. 2시간 후 첫 일기가 작성됩니다.
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
