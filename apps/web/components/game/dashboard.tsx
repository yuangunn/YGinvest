"use client";

// Plan #33: 게임 메인 대시보드 — character 상태 + 탭 (스케줄/주식/부동산/환생).

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Wallet, Battery, Brain, Smile, Briefcase, Calendar,
  TrendingUp, Home as HomeIcon, Sparkles, AlertCircle,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { ScheduleEditor } from "./schedule-editor";
import { StockTrader } from "./stock-trader";
import { RealEstateTrader } from "./real-estate-trader";
import { RebirthPanel } from "./rebirth-panel";
import { REBIRTH_THRESHOLD_PCT, FULLTIME_RANKS } from "@/lib/game/constants";

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
};

type Props = {
  initialCharacter: Character;
  points: number;
  rebirthCount: number;
  unlocks: Record<string, number>;
};

type Tab = "schedule" | "stock" | "realestate" | "rebirth";

export function GameDashboard({
  initialCharacter,
  points: initialPoints,
  rebirthCount,
  unlocks,
}: Props) {
  const router = useRouter();
  const [character, setCharacter] = useState<Character>(initialCharacter);
  const [tab, setTab] = useState<Tab>("schedule");
  const [tickEvents, setTickEvents] = useState<string[]>([]);

  // 페이지 진입 시 tick 호출 (외부 트리거용 — 매매 후 호출)
  const runTick = useCallback(async () => {
    const res = await fetch("/api/game/tick", { method: "POST" });
    if (!res.ok) return;
    const data = await res.json();
    if (data.character) setCharacter(data.character as Character);
    if (data.events && data.events.length > 0) setTickEvents(data.events);
    if (data.executed && data.executed.length > 0) {
      toast.info(`${data.executed.length}일 진행됨`);
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
      if (data.events && data.events.length > 0) setTickEvents(data.events);
      if (data.executed && data.executed.length > 0) {
        toast.info(`${data.executed.length}일 진행됨`);
      }
    };
    tick();
    const interval = setInterval(tick, 60_000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  // 자산 진행도 (현금만 — 주식/부동산은 별도 API로 평가)
  const cashReturn =
    (Number(character.cash) - Number(character.starting_cash)) /
    Number(character.starting_cash);
  const threshold = REBIRTH_THRESHOLD_PCT;
  const progress = Math.max(0, Math.min(1, cashReturn / threshold));
  const canRebirth = cashReturn >= threshold;

  // Career 표시 — 단순화 (n일차는 Phase 2)
  const career =
    character.job_type === "unemployed"
      ? "무직"
      : character.job_type === "parttime"
        ? "💪 알바 중"
        : `💼 ${character.job_title ?? "사원"}`;

  return (
    <div className="max-w-3xl mx-auto p-4 space-y-3">
      {/* 캐릭터 상태 헤더 */}
      <Card>
        <CardContent className="py-3 space-y-2">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
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
                💼 {career} · D+{character.current_day}일차
              </div>
            </div>
            <div className="text-right">
              <div className="text-[10px] text-muted-foreground">환생 누적</div>
              <div className="text-xs">
                🌅 {rebirthCount}회 · 💎 {initialPoints}pt
              </div>
            </div>
          </div>

          {/* 자원 바 */}
          <div className="grid grid-cols-4 gap-2 text-xs">
            <ResourceCell
              icon={<Wallet className="h-3 w-3" />}
              label="현금"
              value={KRW.format(Number(character.cash))}
              color="text-emerald-600 dark:text-emerald-400"
            />
            <ResourceCell
              icon={<Battery className="h-3 w-3" />}
              label="피로"
              value={`${character.fatigue}/100`}
              color={
                character.fatigue >= 90
                  ? "text-red-500"
                  : character.fatigue >= 70
                    ? "text-amber-500"
                    : "text-muted-foreground"
              }
            />
            <ResourceCell
              icon={<Brain className="h-3 w-3" />}
              label="지력"
              value={`${character.intelligence}`}
              color="text-purple-500"
            />
            <ResourceCell
              icon={<Smile className="h-3 w-3" />}
              label="행복도"
              value={`${character.happiness}`}
              color="text-pink-500"
            />
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
                <Sparkles className="h-3 w-3" /> 환생 가능! 주식/부동산 매도 후 환생 탭에서 진행
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* tick 이벤트 알림 */}
      {tickEvents.length > 0 && (
        <Card className="border-amber-500/40 bg-amber-500/5">
          <CardContent className="py-3 space-y-1">
            <div className="flex items-center gap-2 text-sm font-semibold text-amber-600 dark:text-amber-400">
              <AlertCircle className="h-4 w-4" />
              이벤트
            </div>
            {tickEvents.map((e, i) => (
              <div key={i} className="text-xs">
                {e}
              </div>
            ))}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setTickEvents([])}
              className="w-full mt-2"
            >
              확인
            </Button>
          </CardContent>
        </Card>
      )}

      {/* 탭 네비 */}
      <div className="flex gap-1.5 overflow-x-auto pb-1">
        <TabButton active={tab === "schedule"} onClick={() => setTab("schedule")} icon={<Calendar className="h-3.5 w-3.5" />}>
          스케줄
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
      {tab === "schedule" && <ScheduleEditor currentDay={character.current_day} />}
      {tab === "stock" && <StockTrader characterCash={Number(character.cash)} onTrade={runTick} />}
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

function ResourceCell({
  icon, label, value, color,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  color: string;
}) {
  return (
    <div className="rounded-md border bg-muted/30 px-2 py-1.5">
      <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
        {icon}
        {label}
      </div>
      <div className={`font-mono text-xs font-semibold ${color}`}>{value}</div>
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

// FULLTIME_RANKS import 사용 (lint 회피)
void FULLTIME_RANKS;
void Briefcase;
