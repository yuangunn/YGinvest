"use client";

// Plan #36: 게임 대시보드 재설계 — 모드 + 일기 시스템.
// 피로/행복도 제거, 자원은 cash + intelligence + 직업.

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  BookOpen, TrendingUp,
  Home as HomeIcon, Sparkles, Trophy,
} from "lucide-react";
import { toast } from "sonner";
import { DiaryView } from "./diary-view";
import { StockTrader } from "./stock-trader";
import { RealEstateTrader } from "./real-estate-trader";
import { RebirthPanel } from "./rebirth-panel";
import { PixelAvatar } from "./pixel-avatar";
import { MissionsCard } from "./missions-card";
import { AssetChart } from "./asset-chart";
import { AchievementsSection } from "./achievements-section";
import { AiAdvisorCard } from "./ai-advisor-card";
import { SellPatternCard } from "./sell-pattern-card";
import { LifeStageCard } from "./life-stage-card";
import { HelpModal } from "./help-modal";
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
  is_married?: boolean;
  married_at?: string | null;
  children_count?: number;
  is_retired?: boolean;
  invested_pnl?: number;
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
    // 1분마다 자동 tick (게임 시간 = 실제 1시간 = 1게임일이라 자주 안 변하지만,
    // 환생/매도 즉시 반영 위해)
    const interval = setInterval(tick, 60_000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  // Plan #43: 환생 진행도는 invested_pnl (금융 수익) 기준. 알바 수익 제외.
  const startingCash = Number(character.starting_cash);
  const investedPnl = Number(character.invested_pnl ?? 0);
  const investedReturn = startingCash > 0 ? investedPnl / startingCash : 0;
  const threshold = REBIRTH_THRESHOLD_PCT;
  const progress = Math.max(0, Math.min(1, investedReturn / threshold));
  const canRebirth = investedReturn >= threshold;

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
    <div style={{ paddingBottom: 24 }}>
      {/* Plan #45: YG 게임 헤더 */}
      <header
        style={{
          padding: "12px 20px 8px",
          display: "flex",
          alignItems: "center",
          gap: 12,
        }}
      >
        <div style={{ flex: 1 }}>
          <div
            style={{
              fontSize: 18,
              fontWeight: 800,
              letterSpacing: "-0.02em",
              color: "var(--yg-fg-primary)",
            }}
          >
            {character.name}
          </div>
          <div
            className="yg-num"
            style={{
              fontSize: 11,
              color: "var(--yg-fg-tertiary)",
              fontWeight: 700,
              marginTop: 2,
            }}
          >
            D+{character.current_day} ·{" "}
            {character.education_level === "bachelor" ? "🎓 대졸" : "🎒 고졸"} ·{" "}
            {modeDef.emoji} {modeDef.label}
          </div>
        </div>
        <Link
          href="/app/roguelike/stats"
          style={{
            fontSize: 10,
            fontWeight: 800,
            background: "var(--yg-bg-tint-ink)",
            color: "var(--yg-fg-secondary)",
            padding: "5px 9px",
            borderRadius: 6,
            textDecoration: "none",
            letterSpacing: "0.04em",
            display: "inline-flex",
            alignItems: "center",
            gap: 4,
          }}
        >
          <Trophy className="h-3 w-3" />
          STATS
        </Link>
      </header>

      {/* Asset hero with avatar */}
      <div style={{ padding: "0 20px" }}>
        <div
          className="yg-card yg-card-lg"
          style={{
            padding: 22,
            display: "flex",
            flexDirection: "column",
            gap: 14,
            background:
              "linear-gradient(180deg, var(--yg-grad-elev-start) 0%, var(--yg-grad-elev-end) 100%)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div
              style={{
                background: "var(--yg-bg-tint-ink)",
                borderRadius: 14,
                padding: 10,
              }}
            >
              <PixelAvatar
                gender={character.gender}
                jobType={character.job_type}
                jobTitle={character.job_title}
                educationLevel={character.education_level}
                size={56}
              />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div
                style={{
                  fontSize: 11,
                  color: "var(--yg-fg-tertiary)",
                  fontWeight: 700,
                }}
              >
                현재 자산
              </div>
              <div
                className="yg-num"
                style={{
                  fontSize: 28,
                  fontWeight: 800,
                  letterSpacing: "-0.025em",
                  color: "var(--yg-fg-primary)",
                }}
              >
                {KRW.format(Number(character.cash))}
              </div>
            </div>
          </div>

          {/* 환생 진행도 */}
          <div>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                marginBottom: 6,
              }}
            >
              <span
                style={{
                  fontSize: 11,
                  color: "var(--yg-fg-tertiary)",
                  fontWeight: 700,
                }}
              >
                환생까지 (금융수익)
              </span>
              <span
                className="yg-num"
                style={{
                  fontSize: 11,
                  fontWeight: 800,
                  color: canRebirth
                    ? "var(--yg-up-deep)"
                    : "var(--yg-fg-secondary)",
                }}
              >
                {(investedReturn * 100).toFixed(2)}% /{" "}
                {(threshold * 100).toFixed(0)}%
              </span>
            </div>
            <div
              style={{
                height: 6,
                background: "var(--yg-bg-tint-ink)",
                borderRadius: 99,
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  width: `${progress * 100}%`,
                  height: "100%",
                  background: canRebirth ? "var(--yg-up)" : "var(--yg-brand)",
                  borderRadius: 99,
                  transition: "width 200ms",
                }}
              />
            </div>
            {canRebirth && (
              <div
                style={{
                  fontSize: 11,
                  color: "var(--yg-up-deep)",
                  fontWeight: 700,
                  marginTop: 6,
                  display: "flex",
                  alignItems: "center",
                  gap: 4,
                }}
              >
                <Sparkles className="h-3 w-3" /> 환생 가능! 환생 탭으로 이동
              </div>
            )}
          </div>

          {/* 지력/직업 */}
          <div
            style={{
              display: "flex",
              gap: 14,
              paddingTop: 8,
              borderTop: "1px solid var(--yg-line-faint)",
            }}
          >
            <div style={{ flex: 1 }}>
              <div
                style={{
                  fontSize: 11,
                  color: "var(--yg-fg-tertiary)",
                  fontWeight: 700,
                }}
              >
                지능
              </div>
              <div
                className="yg-num"
                style={{
                  fontSize: 17,
                  fontWeight: 800,
                  color: "var(--yg-fg-primary)",
                }}
              >
                {character.intelligence}
              </div>
            </div>
            <div style={{ flex: 1 }}>
              <div
                style={{
                  fontSize: 11,
                  color: "var(--yg-fg-tertiary)",
                  fontWeight: 700,
                }}
              >
                직업
              </div>
              <div
                style={{
                  fontSize: 14,
                  fontWeight: 800,
                  color: "var(--yg-fg-primary)",
                  marginTop: 2,
                }}
              >
                {career}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 환생 누적 + 포인트 */}
      <div style={{ padding: "12px 20px 0" }}>
        <div
          className="yg-card"
          style={{
            padding: 14,
            display: "flex",
            alignItems: "center",
            gap: 12,
          }}
        >
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: 10,
              background: "var(--yg-bg-tint-ink)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 18,
            }}
          >
            🌅
          </div>
          <div style={{ flex: 1 }}>
            <div
              style={{
                fontSize: 11,
                color: "var(--yg-fg-tertiary)",
                fontWeight: 700,
              }}
            >
              환생 누적
            </div>
            <div
              style={{
                fontSize: 14,
                fontWeight: 800,
                color: "var(--yg-fg-primary)",
              }}
            >
              {rebirthCount}회 · 💎 {initialPoints}pt
            </div>
          </div>
        </div>
      </div>

      {/* Pill tab bar */}
      <div style={{ padding: "16px 20px 0" }}>
        <div
          style={{
            display: "flex",
            background: "var(--yg-bg-tint-ink)",
            borderRadius: 14,
            padding: 4,
          }}
        >
          {(
            [
              { k: "diary", l: "일기", I: BookOpen },
              { k: "stock", l: "주식", I: TrendingUp },
              { k: "realestate", l: "부동산", I: HomeIcon },
              { k: "rebirth", l: "환생", I: Sparkles },
            ] as const
          ).map((t) => {
            const active = tab === t.k;
            const Icon = t.I;
            return (
              <button
                key={t.k}
                type="button"
                onClick={() => setTab(t.k as Tab)}
                style={{
                  all: "unset",
                  cursor: "pointer",
                  flex: 1,
                  textAlign: "center",
                  padding: "10px 0",
                  borderRadius: 10,
                  background: active
                    ? "var(--yg-bg-card)"
                    : "transparent",
                  color: active
                    ? "var(--yg-fg-primary)"
                    : "var(--yg-fg-tertiary)",
                  fontSize: 13,
                  fontWeight: 800,
                  boxShadow: active
                    ? "0 1px 2px rgba(15,17,21,0.08)"
                    : "none",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 5,
                }}
              >
                <Icon className="h-3.5 w-3.5" />
                {t.l}
              </button>
            );
          })}
        </div>
      </div>

      {/* 일일 미션 (항상 표시) */}
      <div style={{ padding: "12px 20px 0" }}>
        <MissionsCard />
      </div>

      {/* 탭 컨텐츠 */}
      <div
        style={{
          padding: "12px 20px 0",
          display: "flex",
          flexDirection: "column",
          gap: 12,
        }}
      >
        {tab === "diary" && (
          <>
            <AssetChart
              startingCash={Number(character.starting_cash)}
              currentCash={Number(character.cash)}
            />
            <DiaryView
              currentMode={character.play_mode}
              currentDay={character.current_day}
              unlocks={unlocks}
              onModeChange={(newMode) =>
                setCharacter((c) => ({ ...c, play_mode: newMode }))
              }
            />
            <LifeStageCard
              intelligence={character.intelligence}
              cash={Number(character.cash)}
              isMarried={character.is_married ?? false}
              marriedAt={character.married_at ?? null}
              childrenCount={character.children_count ?? 0}
              isRetired={character.is_retired ?? false}
              jobType={character.job_type}
              currentDay={character.current_day}
              lifeStartedAt={character.life_started_at}
              onAction={() => router.refresh()}
            />
          </>
        )}
        {tab === "stock" && (
          <StockTrader
            characterCash={Number(character.cash)}
            onTrade={runTick}
          />
        )}
        {tab === "realestate" && <RealEstateTrader onTrade={runTick} />}
        {tab === "rebirth" && (
          <>
            <RebirthPanel
              points={initialPoints}
              unlocks={unlocks}
              canRebirth={canRebirth}
              onRebirth={() => router.refresh()}
            />
            <SellPatternCard />
            <AchievementsSection />
            <AiAdvisorCard />
          </>
        )}
      </div>

      <div style={{ textAlign: "center", paddingTop: 14 }}>
        <HelpModal />
      </div>
    </div>
  );
}
