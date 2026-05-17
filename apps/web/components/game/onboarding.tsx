"use client";

// Plan #36: 게임 onboarding — 이름/성별/학력/모드 선택.

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Sparkles, GraduationCap, Lock } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { PLAY_MODES, type PlayMode } from "@/lib/game/constants";

type Props = {
  userName: string;
  points: number;
  rebirthCount: number;
  bachelorUnlocked: boolean;
};

export function GameOnboarding({
  userName,
  points,
  rebirthCount,
  bachelorUnlocked,
}: Props) {
  const router = useRouter();
  const [name, setName] = useState(userName);
  const [gender, setGender] = useState<"male" | "female" | "other">("other");
  const [education, setEducation] = useState<"highschool" | "bachelor">(
    "highschool",
  );
  const [playMode, setPlayMode] = useState<PlayMode>("balanced");
  const [submitting, setSubmitting] = useState(false);

  async function startGame() {
    if (!name.trim()) {
      toast.error("이름을 입력해주세요");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/game/character", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          gender,
          education_level: education,
          play_mode: playMode,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(`시작 실패: ${data.error ?? res.status}`);
        return;
      }
      toast.success("새 인생 시작! 환생까지 화이팅 🌱");
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-4">
      <div className="text-center space-y-2">
        <h1 className="text-2xl font-bold flex items-center justify-center gap-2">
          <Sparkles className="h-6 w-6 text-primary" />
          인생 시뮬레이션
        </h1>
        <p className="text-sm text-muted-foreground">
          1,000만원으로 시작. 5% 수익 도달하면 환생.
          <br />
          모드 선택하고 가끔 들어와 일기 보면 됩니다 (오프라인 자동 진행).
        </p>
        {rebirthCount > 0 && (
          <div className="inline-flex items-center gap-2 text-xs rounded-full border bg-muted/50 px-3 py-1">
            <span>🌅 환생 {rebirthCount}회</span>
            <span>·</span>
            <span>💎 {points}pt</span>
          </div>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">캐릭터 생성</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* 이름 */}
          <div className="space-y-1.5">
            <Label htmlFor="char-name">이름</Label>
            <Input
              id="char-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={20}
              placeholder="김봉팔"
            />
          </div>

          {/* 성별 */}
          <div className="space-y-1.5">
            <Label>성별</Label>
            <div className="flex gap-2">
              {(["male", "female", "other"] as const).map((g) => {
                const label = g === "male" ? "♂ 남" : g === "female" ? "♀ 여" : "⚪ 비공개";
                return (
                  <button
                    key={g}
                    type="button"
                    onClick={() => setGender(g)}
                    className={`flex-1 text-sm rounded-md border px-3 py-2 transition-colors ${
                      gender === g
                        ? "border-primary bg-primary/10 text-primary font-semibold"
                        : "hover:bg-accent"
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* 학력 시작점 */}
          <div className="space-y-1.5">
            <Label className="flex items-center gap-1">
              <GraduationCap className="h-4 w-4" /> 학력 시작점
            </Label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setEducation("highschool")}
                className={`text-sm rounded-md border p-3 text-left transition-colors ${
                  education === "highschool"
                    ? "border-primary bg-primary/10"
                    : "hover:bg-accent"
                }`}
              >
                <div className="font-semibold">🎒 고졸</div>
                <div className="text-[10px] text-muted-foreground mt-0.5">
                  알바부터. 자기계발로 검정고시/대학 진학 가능
                </div>
              </button>
              <button
                type="button"
                onClick={() => bachelorUnlocked && setEducation("bachelor")}
                disabled={!bachelorUnlocked}
                className={`text-sm rounded-md border p-3 text-left transition-colors relative ${
                  !bachelorUnlocked
                    ? "opacity-50 cursor-not-allowed"
                    : education === "bachelor"
                      ? "border-primary bg-primary/10"
                      : "hover:bg-accent"
                }`}
              >
                <div className="font-semibold flex items-center gap-1">
                  🎓 대졸
                  {!bachelorUnlocked && <Lock className="h-3 w-3" />}
                </div>
                <div className="text-[10px] text-muted-foreground mt-0.5">
                  {bachelorUnlocked
                    ? "지력 +500 시작, 사무직 빠른 진입"
                    : "환생 100pt로 해금"}
                </div>
              </button>
            </div>
          </div>

          {/* 플레이 모드 */}
          <div className="space-y-1.5">
            <Label>플레이 모드</Label>
            <div className="space-y-1.5">
              {(["balanced", "income", "learning"] as const).map((m) => {
                const def = PLAY_MODES[m];
                return (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setPlayMode(m)}
                    className={`w-full text-left rounded-md border p-3 transition-colors ${
                      playMode === m
                        ? "border-primary bg-primary/10"
                        : "hover:bg-accent"
                    }`}
                  >
                    <div className="font-semibold text-sm flex items-center gap-1.5">
                      {def.emoji} {def.label}
                    </div>
                    <div className="text-[11px] text-muted-foreground mt-0.5">
                      {def.description}
                    </div>
                    <div className="text-[10px] text-muted-foreground mt-1">
                      활동 비율: 일 {Math.round(def.weights.work * 100)}% ·
                      공부 {Math.round(def.weights.study * 100)}%
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <Button onClick={startGame} disabled={submitting} className="w-full">
            인생 시작 🚀
          </Button>

          <p className="text-[11px] text-muted-foreground text-center">
            실제 2시간 = 게임 1일. 가끔 들어와서 일기만 확인하세요.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
