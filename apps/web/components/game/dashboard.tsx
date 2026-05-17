"use client";

// Plan #36: 게임 대시보드 재설계 — 모드 + 일기 시스템.
// 피로/행복도 제거, 자원은 cash + intelligence + 직업.

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Wallet, Brain, BookOpen, TrendingUp,
  Home as HomeIcon, Sparkles,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import { DiaryView } from "./diary-view";
import { StockTrader } from "./stock-trader";
import { RealEstateTrader } from "./real-estate-trader";
import { RebirthPanel } from "./rebirth-panel";
import {
  REBIRTH_THRESHOLD_PCT,
  PLAY_MODES,
  type PlayMode,
} from "@/lib/game/constants";

const KRW = new Intl.NumberFormat("ko-KR", {
  style: "currency",
  currency: "KRW",
  maximumFractionDigits: 0,
});

type Character = {
  user_id: string;
  name: string;
  gender: string;
  education_level: "highschool" | "bachelor";
  job_type: "unemployed" | "parttime" | "fulltime";
  job_title: string | null;
  job_started_at: string | null;
  cash: number;
  fatigue: number;
  intelligence: number;
  happiness: number;
  life_started_at: string;
  current_day: number;
  starting_cash: number;
  play_mode: PlayMode;
};

type Props = {
  initialCharacter: Character;
  points: number;
  rebirthCount: number;
  unlocks: Record<string, number>;
};

type Tab = "diary" | "stock" | "realestate" | "rebirth";

export function GameDashboard({
  initialCharacter,
  points: initialPoints,
  rebirthCount,
  unlocks,
}: Props) {
  const router = useRouter();
  const [character, setCharacter] = useState<Character>(initialCharacter);
  const [tab, setTab] = useState<Tab>("diary");

  const runTick = useCallback(async () => {
    const res = await fetch("/api/game/tick", { method: "POST" });
    if (!res.ok) return;
    const data = await res.json();
    if (data.character) setCharacter(data.character as Character);
    if (data.new_entries > 0) {
      toast.info(`📖 일기 ${data.new_entries}개 새로 작성됨`);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    const tick = async () => {
      const res = await fetch("/api/game/tick", { method: "POST" });
      if (!res.ok || cancelled) return;
      const data = await res.json();
      if (cancelled) return;
      if (data.character) setCharacter(data.character as Character);
      if (data.new_entries > 0) {
        toast.info(`📖 일기 ${data.new_entries}개 새로 작성됨`);
      }
    };
    tick();
    // 1분마다 자동 tick (게임 시간 = 실제 2시간 = 1게임일이라 자주 안 변하지만,
    // 환생/매도 즉시 반영 위해)
    const interval = setInterval(tick, 60_000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  const cashReturn =
    (Number(character.cash) - Number(character.starting_cash)) /
    Number(character.starting_cash);
  const threshold = REBIRTH_THRESHOLD_PCT;
  const progress = Math.max(0, Math.min(1, cashReturn / threshold));
  const canRebirth = cashReturn >= threshold;

  // 직업 표시
  const career =
    character.job_type === "unemployed"
      ? "무직"
      : character.job_type === "parttime"
        ? "💪 알바 중"
        : `💼 ${character.job_title ?? "사원"}`;

  // 모드 표시
  const modeDef = PLAY_MODES[character.play_mode];

  return (
    <div className="max-w-3xl mx-auto p-4 space-y-3">
      {/* 캐릭터 상태 헤더 (간소화) */}
      <Card>
        <CardContent className="py-3 space-y-2">
          <div className="flex items-center justify-between flex-wrap gap-1">
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-lg font-bold">
                  {character.gender === "female" ? "👩" : character.gender === "male" ? "👨" : "🧑"}
                  {" "}
                  {character.name}
                </span>
                <span className="text-xs text-muted-foreground">
                  {character.education_level === "bachelor" ? "🎓 대졸" : "🎒 고졸"}
                </span>
              </div>
              <div className="text-xs text-muted-foreground mt-0.5">
                {career} · D+{character.current_day}일차 ·{" "}
                <span className="text-primary font-semibold">
                  {modeDef.emoji} {modeDef.label}
                </span>
              </div>
            </div>
            <div className="text-right">
              <div className="text-[10px] text-muted-foreground">환생 누적</div>
              <div className="text-xs">
                🌅 {rebirthCount}회 · 💎 {initialPoints}pt
              </div>
            </div>
          </div>

          {/* 자원 2개로 단순화 */}
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="rounded-md border bg-muted/30 px-2 py-1.5">
              <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                <Wallet className="h-3 w-3" />
                현금
              </div>
              <div className="font-mono text-sm font-semibold text-emerald-600 dark:text-emerald-400">
                {KRW.format(Number(character.cash))}
              </div>
            </div>
            <div className="rounded-md border bg-muted/30 px-2 py-1.5">
              <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                <Brain className="h-3 w-3" />
                지력
              </div>
              <div className="font-mono text-sm font-semibold text-purple-500">
                {character.intelligence}
              </div>
            </div>
          </div>

          {/* 환생 진행도 */}
          <div className="pt-1">
            <div className="flex items-center justify-between text-[10px] text-muted-foreground">
              <span>환생까지 (현금 기준)</span>
              <span>
                {(cashReturn * 100).toFixed(2)}% / {(threshold * 100).toFixed(0)}%
              </span>
            </div>
            <div className="mt-1 h-1.5 rounded-full bg-muted overflow-hidden">
              <div
                className={`h-full transition-all ${canRebirth ? "bg-emerald-500" : "bg-primary"}`}
                style={{ width: `${progress * 100}%` }}
              />
            </div>
            {canRebirth && (
              <div className="text-[10px] text-emerald-600 dark:text-emerald-400 mt-1 flex items-center gap-1">
                <Sparkles className="h-3 w-3" /> 환생 가능! 환생 탭으로 이동
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* 탭 네비 */}
      <div className="flex gap-1.5 overflow-x-auto pb-1">
        <TabButton active={tab === "diary"} onClick={() => setTab("diary")} icon={<BookOpen className="h-3.5 w-3.5" />}>
          일기
        </TabButton>
        <TabButton active={tab === "stock"} onClick={() => setTab("stock")} icon={<TrendingUp className="h-3.5 w-3.5" />}>
          주식
        </TabButton>
        <TabButton active={tab === "realestate"} onClick={() => setTab("realestate")} icon={<HomeIcon className="h-3.5 w-3.5" />}>
          부동산
        </TabButton>
        <TabButton active={tab === "rebirth"} onClick={() => setTab("rebirth")} icon={<Sparkles className="h-3.5 w-3.5" />}>
          환생
        </TabButton>
      </div>

      {/* 탭 컨텐츠 */}
      {tab === "diary" && (
        <DiaryView currentMode={character.play_mode} currentDay={character.current_day} />
      )}
      {tab === "stock" && (
        <StockTrader characterCash={Number(character.cash)} onTrade={runTick} />
      )}
      {tab === "realestate" && <RealEstateTrader onTrade={runTick} />}
      {tab === "rebirth" && (
        <RebirthPanel
          points={initialPoints}
          unlocks={unlocks}
          canRebirth={canRebirth}
          onRebirth={() => router.refresh()}
        />
      )}
    </div>
  );
}

function TabButton({
  active, onClick, icon, children,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex-1 inline-flex items-center justify-center gap-1.5 text-xs rounded-md border px-3 py-1.5 transition-colors whitespace-nowrap ${
        active
          ? "border-primary bg-primary/10 text-primary font-semibold"
          : "hover:bg-accent"
      }`}
    >
      {icon}
      {children}
    </button>
  );
}
