"use client";

// Plan #33: 30일 스케줄 캘린더 — 프린세스 메이커 스타일.

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { ACTIVITY_LABEL, ACTIVITY_COLOR } from "@/lib/game/constants";

const ACTIVITIES = [
  "parttime", "fulltime", "study", "rest", "shopping",
  "dining", "healing", "exercise", "job_search", "free",
];

type ScheduleRow = {
  game_day: number;
  activity: string;
  executed_at: string | null;
  result_summary: string | null;
};

type Props = {
  currentDay: number;
};

const PLAN_RANGE = 30; // 앞으로 30일 plan

export function ScheduleEditor({ currentDay }: Props) {
  const [schedules, setSchedules] = useState<Record<number, ScheduleRow>>({});
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await fetch("/api/game/schedule");
      if (cancelled) return;
      const data = await res.json();
      if (cancelled) return;
      const map: Record<number, ScheduleRow> = {};
      for (const s of data.schedules ?? []) map[s.game_day] = s;
      setSchedules(map);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  function pickActivity(day: number, activity: string) {
    setSchedules((prev) => ({
      ...prev,
      [day]: { game_day: day, activity, executed_at: null, result_summary: null },
    }));
    setSelectedDay(null);
  }

  async function saveAll() {
    setSaving(true);
    try {
      const futureItems = Object.values(schedules).filter(
        (s) => s.game_day >= currentDay && !s.executed_at,
      );
      const res = await fetch("/api/game/schedule", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          schedules: futureItems.map((s) => ({
            game_day: s.game_day,
            activity: s.activity,
          })),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(`저장 실패: ${data.error}`);
      } else {
        toast.success(`${data.saved}일 저장됨`);
      }
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <Card><CardContent className="py-6 text-sm text-muted-foreground">로딩…</CardContent></Card>;
  }

  // 표시 범위: currentDay ~ currentDay + 30
  const startDay = currentDay;
  const endDay = currentDay + PLAN_RANGE;
  const days: number[] = [];
  for (let d = startDay; d < endDay; d++) days.push(d);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">📅 30일 스케줄</CardTitle>
        <p className="text-[11px] text-muted-foreground mt-1">
          미리 짜두면 캐릭터가 알아서 진행. 실행된 일은 잠금.
          <br />
          알바 주 5일 권장 · 6일 이상이면 피로도 ↑ → 해고 위험
        </p>
      </CardHeader>
      <CardContent className="space-y-2">
        {/* 7일 × 약 4-5주 그리드 */}
        <div className="grid grid-cols-7 gap-1 text-[10px]">
          {["월", "화", "수", "목", "금", "토", "일"].map((d) => (
            <div key={d} className="text-center text-muted-foreground">
              {d}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {days.map((day) => {
            const s = schedules[day];
            const activity = s?.activity ?? "free";
            const executed = !!s?.executed_at;
            const isToday = day === currentDay;
            const dow = day % 7; // 단순화 — 정확한 요일은 life_started_at 기준
            const isWeekend = dow === 5 || dow === 6;
            return (
              <button
                key={day}
                type="button"
                onClick={() => !executed && setSelectedDay(day)}
                disabled={executed}
                className={`relative aspect-square rounded border text-[10px] p-1 flex flex-col items-center justify-center transition-all ${
                  executed
                    ? "opacity-50 cursor-not-allowed"
                    : selectedDay === day
                      ? "ring-2 ring-primary"
                      : "hover:bg-accent"
                } ${ACTIVITY_COLOR[activity] ?? ""} ${
                  isToday ? "ring-2 ring-amber-500" : ""
                } ${isWeekend ? "border-dashed" : ""}`}
              >
                <div className="text-[8px] text-muted-foreground">D+{day}</div>
                <div className="text-[14px]">{ACTIVITY_LABEL[activity]?.split(" ")[0]}</div>
                {executed && (
                  <div className="absolute inset-0 flex items-center justify-center bg-background/60 rounded text-[8px]">
                    ✓
                  </div>
                )}
              </button>
            );
          })}
        </div>

        {/* 활동 선택 모달 */}
        {selectedDay !== null && (
          <div className="border rounded-lg p-3 space-y-2 bg-muted/30">
            <div className="text-xs font-semibold">
              D+{selectedDay}일차 활동 선택
            </div>
            <div className="grid grid-cols-3 gap-1.5">
              {ACTIVITIES.map((a) => (
                <button
                  key={a}
                  type="button"
                  onClick={() => pickActivity(selectedDay, a)}
                  className={`text-[11px] rounded border px-2 py-1.5 hover:bg-accent transition-colors ${ACTIVITY_COLOR[a] ?? ""}`}
                >
                  {ACTIVITY_LABEL[a]}
                </button>
              ))}
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSelectedDay(null)}
              className="w-full text-xs"
            >
              취소
            </Button>
          </div>
        )}

        <Button onClick={saveAll} disabled={saving} className="w-full">
          💾 스케줄 저장
        </Button>

        {/* 최근 실행 로그 */}
        <div className="pt-3 border-t">
          <div className="text-xs font-semibold mb-1.5">최근 실행</div>
          <div className="space-y-1 text-[10px] max-h-32 overflow-y-auto">
            {Object.values(schedules)
              .filter((s) => s.executed_at)
              .sort((a, b) => b.game_day - a.game_day)
              .slice(0, 10)
              .map((s) => (
                <div key={s.game_day} className="flex items-center gap-1.5">
                  <span className="text-muted-foreground tabular-nums w-12">
                    D+{s.game_day}
                  </span>
                  <span className="font-medium">{ACTIVITY_LABEL[s.activity]}</span>
                  {s.result_summary && (
                    <span className="text-muted-foreground truncate">
                      · {s.result_summary}
                    </span>
                  )}
                </div>
              ))}
            {Object.values(schedules).filter((s) => s.executed_at).length === 0 && (
              <div className="text-muted-foreground">아직 실행된 일정 없음</div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
