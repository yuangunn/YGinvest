"use client";

// Plan #40: 오늘의 미션 카드.

import { useState, useEffect } from "react";
import { Target, Check } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";

type Mission = {
  key: string;
  emoji: string;
  label: string;
  progress: number;
  target: number;
  reward: number;
  completed: boolean;
  reward_claimed?: boolean;
};

export function MissionsCard() {
  const [missions, setMissions] = useState<Mission[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await fetch("/api/game/missions");
      if (cancelled) return;
      const data = await res.json();
      if (cancelled) return;
      setMissions(data.missions ?? []);
      setLoading(false);
      // 신규 완료 알림
      for (const m of data.missions ?? []) {
        if (m.reward_claimed) {
          toast.success(`미션 완료! ${m.emoji} ${m.label} (+${m.reward}pt)`);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) return null;
  if (missions.length === 0) return null;

  const allDone = missions.every((m) => m.completed);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm flex items-center justify-between">
          <span className="inline-flex items-center gap-1.5">
            <Target className="h-4 w-4 text-primary" />
            오늘의 미션
          </span>
          {allDone ? (
            <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-normal">
              ✅ 전부 완료
            </span>
          ) : (
            <span className="text-[10px] text-muted-foreground font-normal">
              자정 갱신
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-1.5">
        {missions.map((m) => {
          const pct = Math.min(100, (m.progress / m.target) * 100);
          return (
            <div
              key={m.key}
              className={`rounded-md border p-2 ${
                m.completed ? "bg-emerald-500/5 border-emerald-500/30" : ""
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 text-xs">
                  <span>{m.emoji}</span>
                  <span className={m.completed ? "line-through text-muted-foreground" : ""}>
                    {m.label}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <span className="text-[10px] text-muted-foreground tabular-nums">
                    {m.progress}/{m.target}
                  </span>
                  <span className="text-[10px] font-mono text-purple-500">
                    +{m.reward}pt
                  </span>
                  {m.completed && <Check className="h-3 w-3 text-emerald-500" />}
                </div>
              </div>
              <div className="mt-1 h-1 rounded-full bg-muted overflow-hidden">
                <div
                  className={`h-full ${m.completed ? "bg-emerald-500" : "bg-primary"}`}
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
