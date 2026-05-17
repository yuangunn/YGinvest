"use client";

// Plan #40: 업적 섹션 — 환생 탭 안에 표시.

import { useState, useEffect } from "react";
import { Trophy, Lock, Check } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ACHIEVEMENT_CATEGORY_LABEL } from "@/lib/game/achievements";
import { toast } from "sonner";

type Achievement = {
  key: string;
  category: string;
  emoji: string;
  label: string;
  description: string;
  reward: number;
  unlocked: boolean;
  newly_unlocked: boolean;
};

export function AchievementsSection() {
  const [list, setList] = useState<Achievement[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await fetch("/api/game/achievements");
      if (cancelled) return;
      const data = await res.json();
      if (cancelled) return;
      setList((data.achievements ?? []) as Achievement[]);
      setLoading(false);
      if (data.newly_unlocked_count > 0) {
        toast.success(
          `🏆 새 업적 ${data.newly_unlocked_count}개 해금! +${data.total_reward}pt`,
        );
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) return null;

  const unlocked = list.filter((a) => a.unlocked);
  const total = list.length;

  const grouped = new Map<string, Achievement[]>();
  for (const a of list) {
    const arr = grouped.get(a.category) ?? [];
    arr.push(a);
    grouped.set(a.category, arr);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm flex items-center justify-between">
          <span className="inline-flex items-center gap-1.5">
            <Trophy className="h-4 w-4 text-amber-500" />
            업적
          </span>
          <span className="text-[10px] font-normal text-muted-foreground">
            {unlocked.length}/{total}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {(showAll
          ? Array.from(grouped.entries())
          : Array.from(grouped.entries()).slice(0, 3)
        ).map(([cat, arr]) => (
          <div key={cat}>
            <div className="text-[11px] font-semibold mb-1">
              {ACHIEVEMENT_CATEGORY_LABEL[cat] ?? cat}
            </div>
            <div className="grid grid-cols-2 gap-1">
              {arr.map((a) => (
                <div
                  key={a.key}
                  className={`rounded border p-1.5 ${
                    a.unlocked
                      ? "bg-amber-500/5 border-amber-500/30"
                      : "opacity-50"
                  }`}
                  title={a.description}
                >
                  <div className="flex items-center gap-1 text-[11px]">
                    <span>{a.emoji}</span>
                    <span className={a.unlocked ? "font-semibold" : ""}>
                      {a.label}
                    </span>
                    {a.unlocked ? (
                      <Check className="h-2.5 w-2.5 text-emerald-500 ml-auto" />
                    ) : (
                      <Lock className="h-2.5 w-2.5 ml-auto" />
                    )}
                  </div>
                  <div className="text-[9px] text-muted-foreground">
                    {a.description} · +{a.reward}pt
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
        {!showAll && grouped.size > 3 && (
          <button
            type="button"
            onClick={() => setShowAll(true)}
            className="w-full text-xs text-muted-foreground hover:text-foreground text-center py-1"
          >
            나머지 보기 ({grouped.size - 3}개 카테고리)
          </button>
        )}
      </CardContent>
    </Card>
  );
}
