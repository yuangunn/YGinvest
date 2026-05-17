// Plan #41: 대시보드 — YG Design System (Claude Design handoff) 적용.
//
// 디자인: Pretendard, KR convention (red↑ blue↓), deep ink brand.
// 데이터 fetch는 기존 유지. 렌더링만 YG 시스템으로.

import Link from "next/link";
import { Suspense } from "react";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";
export const revalidate = 0;

import { createClient } from "@/lib/supabase/server";
import { getSelectedPortfolioId } from "@/lib/portfolio-context";
import { getIsAdmin } from "@/lib/auth-admin";

// Plan #42: 헤더는 app/layout으로 옮김 (중복 제거).
import { YGAssetHero } from "@/components/dashboard/yg-asset-hero";
import { YGGameCTA } from "@/components/dashboard/yg-game-cta";
import { YGHoldingsPreview } from "@/components/dashboard/yg-holdings-preview";
import { YGActionMenu } from "@/components/dashboard/yg-action-menu";
import { SectionHead } from "@/components/yg/section-head";

import { PersonalizedRecommendations } from "@/components/personalized-recommendations";
import { RecommendationsSection } from "@/components/recommendations-section";
import { VolumeLeaders } from "@/components/volume-leaders";
import { DailyQuizCard } from "@/components/daily-quiz-card";
import { PendingOrdersCard } from "@/components/pending-orders-card";
import { EtfCurationSection } from "@/components/etf-curation-section";
import { REBIRTH_THRESHOLD_PCT } from "@/lib/game/constants";

function CardSkeleton() {
  return (
    <div className="yg-card" style={{ padding: 18, minHeight: 140 }}>
      <div
        className="yg-skeleton"
        style={{ height: 16, width: "40%", marginBottom: 12, borderRadius: 6 }}
      />
      <div
        className="yg-skeleton"
        style={{ height: 24, width: "100%", borderRadius: 6 }}
      />
    </div>
  );
}

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const [{ data: profile }, portfolioId, isAdmin] = await Promise.all([
    supabase
      .from("profiles")
      .select("display_name")
      .eq("id", user.id)
      .maybeSingle(),
    getSelectedPortfolioId(supabase, user.id),
    getIsAdmin(supabase, user.id),
  ]);

  const [{ data: portfolio }, holdingsRes, { data: character }] = portfolioId
    ? await Promise.all([
        supabase
          .from("portfolios")
          .select(
            "krw_balance, usd_balance, starting_krw, starting_usd, room_id, status",
          )
          .eq("id", portfolioId)
          .maybeSingle(),
        // Plan #41 fix: 컬럼명은 `quantity` (기존 코드에 qty 오류 있었음)
        supabase
          .from("holdings")
          .select("symbol", { count: "exact", head: true })
          .eq("portfolio_id", portfolioId)
          .gt("quantity", 0),
        supabase
          .from("game_characters")
          .select(
            "name, gender, education_level, job_type, job_title, cash, starting_cash, current_day",
          )
          .eq("user_id", user.id)
          .maybeSingle(),
      ])
    : [{ data: null }, { count: null }, { data: null }];

  const holdingsCount = (holdingsRes?.count as number | null) ?? 0;
  const greetingName =
    profile?.display_name ?? user.email?.split("@")[0] ?? "투자자";

  // 일일 변동률 계산 (시작 자본 대비)
  const FX_USD_KRW = 1300;
  let todayChangePct: number | null = null;
  if (portfolio) {
    const totalKRW =
      Number(portfolio.krw_balance) +
      Number(portfolio.usd_balance) * FX_USD_KRW;
    const startKRW =
      Number(portfolio.starting_krw) +
      Number(portfolio.starting_usd) * FX_USD_KRW;
    if (startKRW > 0) {
      todayChangePct = ((totalKRW - startKRW) / startKRW) * 100;
    }
  }

  // 게임 환생 진행도 계산
  let gameProgress: number | null = null;
  if (character) {
    const startingCash = Number(character.starting_cash);
    const cash = Number(character.cash);
    if (startingCash > 0) {
      const pct = (cash - startingCash) / startingCash;
      gameProgress = Math.max(
        0,
        Math.min(100, (pct / REBIRTH_THRESHOLD_PCT) * 100),
      );
    }
  }

  return (
    <div style={{ paddingBottom: 16 }}>
      {/* Greeting (헤더는 app/layout으로 옮김 → 중복 제거) */}
      <div style={{ padding: "16px 20px 4px" }}>
        <div
          style={{
            fontSize: 22,
            fontWeight: 800,
            letterSpacing: "-0.025em",
            lineHeight: 1.2,
            color: "var(--yg-fg-primary)",
          }}
        >
          안녕하세요, {greetingName}님
        </div>
        <div
          style={{
            marginTop: 4,
            fontSize: 13,
            color: "var(--yg-fg-tertiary)",
          }}
        >
          {todayChangePct != null ? (
            <>
              자산이{" "}
              <span
                className="yg-num"
                style={{
                  color:
                    todayChangePct >= 0
                      ? "var(--yg-up-deep)"
                      : "var(--yg-down-deep)",
                  fontWeight: 700,
                }}
              >
                {todayChangePct >= 0 ? "+" : ""}
                {todayChangePct.toFixed(2)}%
              </span>{" "}
              {todayChangePct >= 0 ? "늘었어요" : "줄었어요"}
            </>
          ) : (
            "오늘의 시장을 확인해보세요"
          )}
        </div>
      </div>

      {/* Asset hero */}
      {portfolio && (
        <div style={{ padding: "14px 20px 0" }}>
          <YGAssetHero
            krwBalance={Number(portfolio.krw_balance)}
            usdBalance={Number(portfolio.usd_balance)}
            startingKrw={Number(portfolio.starting_krw)}
            startingUsd={Number(portfolio.starting_usd)}
          />
        </div>
      )}

      {/* Game CTA — equal billing */}
      <div style={{ padding: "12px 20px 0" }}>
        <YGGameCTA
          hasCharacter={!!character}
          characterName={character?.name ?? null}
          gender={character?.gender ?? null}
          jobType={character?.job_type ?? null}
          jobTitle={character?.job_title ?? null}
          educationLevel={character?.education_level ?? null}
          currentDay={character?.current_day ?? null}
          progressPct={gameProgress}
        />
      </div>

      {/* Holdings preview row */}
      <div style={{ padding: "12px 20px 0" }}>
        <YGHoldingsPreview holdingsCount={holdingsCount} />
      </div>

      {/* Pending orders (conditional) */}
      {portfolioId && (
        <div style={{ padding: "12px 20px 0" }}>
          <PendingOrdersCard portfolioId={portfolioId} />
        </div>
      )}

      {/* Daily quiz */}
      <div style={{ padding: "12px 20px 0" }}>
        <DailyQuizCard />
      </div>

      {/* Action menu */}
      <div style={{ padding: "24px 20px 0" }}>
        <YGActionMenu defaultOpenId="trade" />
      </div>

      {/* Personalized recommendations */}
      {portfolioId && (
        <div style={{ marginTop: 28 }}>
          <SectionHead
            title="추천 종목"
            sub="관심 테마와 보유 종목 기반"
            href="/app/curation"
            linkLabel="더 보기"
          />
          <div style={{ padding: "0 20px" }}>
            <Suspense fallback={<CardSkeleton />}>
              <PersonalizedRecommendations portfolioId={portfolioId} />
            </Suspense>
          </div>
        </div>
      )}

      {/* ETF curation */}
      <div style={{ padding: "24px 20px 0" }}>
        <Suspense fallback={<CardSkeleton />}>
          <EtfCurationSection />
        </Suspense>
      </div>

      {/* Volume leaders KR */}
      <div style={{ padding: "12px 20px 0" }}>
        <Suspense fallback={<CardSkeleton />}>
          <VolumeLeaders scope="KR" limit={5} />
        </Suspense>
      </div>

      {/* 5 recommendation grids */}
      <div style={{ padding: "12px 20px 0", display: "flex", flexDirection: "column", gap: 12 }}>
        <Suspense fallback={<CardSkeleton />}>
          <RecommendationsSection category="top_gainers" scope="KR" />
        </Suspense>
        <Suspense fallback={<CardSkeleton />}>
          <RecommendationsSection category="volume_surge" scope="KR" />
        </Suspense>
        <Suspense fallback={<CardSkeleton />}>
          <RecommendationsSection category="low_per_value" scope="KR" />
        </Suspense>
        <Suspense fallback={<CardSkeleton />}>
          <RecommendationsSection category="top_gainers" scope="US" />
        </Suspense>
        <Suspense fallback={<CardSkeleton />}>
          <RecommendationsSection category="near_52w_high" scope="US" />
        </Suspense>
      </div>

      {/* Admin shortcuts */}
      {isAdmin && (
        <div style={{ padding: "24px 20px 0", display: "flex", gap: 8, flexWrap: "wrap" }}>
          <Link
            href="/app/admin/users"
            style={{
              fontSize: 12,
              color: "var(--yg-fg-tertiary)",
              fontWeight: 600,
              textDecoration: "none",
            }}
          >
            👥 사용자 관리 ›
          </Link>
          <Link
            href="/app/admin/etfs"
            style={{
              fontSize: 12,
              color: "var(--yg-fg-tertiary)",
              fontWeight: 600,
              textDecoration: "none",
            }}
          >
            📊 ETF 관리 ›
          </Link>
          <Link
            href="/app/health"
            style={{
              fontSize: 12,
              color: "var(--yg-fg-tertiary)",
              fontWeight: 600,
              textDecoration: "none",
            }}
          >
            🛡️ 시스템 상태 ›
          </Link>
        </div>
      )}

      <div style={{ height: 24 }} />
    </div>
  );
}
