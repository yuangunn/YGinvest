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
import { MarketBriefingPopup } from "@/components/dashboard/market-briefing-popup";
import { MarketBriefingCard } from "@/components/dashboard/market-briefing-card";
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

  const [
    { data: portfolio },
    holdingsRes,
    { data: character },
    { data: fxRow },
  ] = portfolioId
    ? await Promise.all([
        supabase
          .from("portfolios")
          .select(
            "krw_balance, usd_balance, starting_krw, starting_usd, fx_rate_at_start, room_id, status",
          )
          .eq("id", portfolioId)
          .maybeSingle(),
        supabase
          .from("holdings")
          .select("symbol, quantity, stocks(currency, last_price)", {
            count: "exact",
          })
          .eq("portfolio_id", portfolioId)
          .gt("quantity", 0),
        supabase
          .from("game_characters")
          .select(
            "name, gender, education_level, job_type, job_title, cash, starting_cash, current_day, invested_pnl",
          )
          .eq("user_id", user.id)
          .maybeSingle(),
        // Plan #43: 실제 USD/KRW 환율 fetch (portfolio overview와 동일)
        supabase
          .from("fx_rates")
          .select("rate")
          .eq("base", "USD")
          .eq("quote", "KRW")
          .order("ts", { ascending: false })
          .limit(1)
          .maybeSingle(),
      ])
    : [{ data: null }, { count: null, data: null }, { data: null }, { data: null }];

  const holdingsCount = (holdingsRes?.count as number | null) ?? 0;
  const greetingName =
    profile?.display_name ?? user.email?.split("@")[0] ?? "투자자";

  // 환율 (없으면 1395 fallback — portfolio overview와 동일)
  const fxRate = fxRow?.rate ? Number(fxRow.rate) : 1395;
  const startingFxRate = portfolio?.fx_rate_at_start
    ? Number(portfolio.fx_rate_at_start)
    : fxRate;

  // 보유 종목 평가액 (KRW 환산)
  let holdingsValueKrw = 0;
  type HoldingStock = { currency: string; last_price: number | null };
  type HoldingRow = {
    quantity: number;
    stocks: HoldingStock | HoldingStock[] | null;
  };
  for (const h of (holdingsRes?.data ?? []) as unknown as HoldingRow[]) {
    const stock = Array.isArray(h.stocks) ? h.stocks[0] : h.stocks;
    if (!stock?.last_price) continue;
    const valueLocal = Number(stock.last_price) * Number(h.quantity);
    holdingsValueKrw +=
      stock.currency === "KRW" ? valueLocal : valueLocal * fxRate;
  }

  // 누적 수익률
  let todayChangePct: number | null = null;
  if (portfolio) {
    const totalKRW =
      Number(portfolio.krw_balance) +
      Number(portfolio.usd_balance) * fxRate +
      holdingsValueKrw;
    const startKRW =
      Number(portfolio.starting_krw) +
      Number(portfolio.starting_usd) * startingFxRate;
    if (startKRW > 0) {
      todayChangePct = ((totalKRW - startKRW) / startKRW) * 100;
    }
  }

  // 게임 환생 진행도 — Plan #43: invested_pnl 기반 (알바 수익 제외)
  let gameProgress: number | null = null;
  if (character) {
    const startingCash = Number(character.starting_cash);
    const investedPnl = Number(character.invested_pnl ?? 0);
    if (startingCash > 0) {
      const pct = investedPnl / startingCash;
      gameProgress = Math.max(
        0,
        Math.min(100, (pct / REBIRTH_THRESHOLD_PCT) * 100),
      );
    }
  }

  return (
    <div style={{ paddingBottom: 16 }}>
      {/* Plan #47: 오늘의 시황 popup (첫 진입 시 표시, dismiss 가능) */}
      <MarketBriefingPopup />

      {/* Plan #45: 통일된 너비 — handoff README 기준
          - 가로 패딩: 20px (모든 카드/섹션)
          - 카드간 세로 간격: 12px (yg-stack에서 자동)
          - 상단 섹션간: 24-28px */}

      {/* Greeting */}
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

      {/* Plan #47.2: 오늘의 시황 카드 (popup 끄더라도 항상 여기서 볼 수 있음) */}
      <div style={{ padding: "12px 20px 0" }}>
        <MarketBriefingCard />
      </div>

      {/* Top stack: hero + game CTA + holdings + pending + quiz (12px gap) */}
      <div className="yg-stack" style={{ padding: "12px 20px 0" }}>
        {portfolio && (
          <YGAssetHero
            krwBalance={Number(portfolio.krw_balance)}
            usdBalance={Number(portfolio.usd_balance)}
            startingKrw={Number(portfolio.starting_krw)}
            startingUsd={Number(portfolio.starting_usd)}
            holdingsValueKrw={holdingsValueKrw}
            fxRate={fxRate}
            startingFxRate={startingFxRate}
          />
        )}

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

        <YGHoldingsPreview holdingsCount={holdingsCount} />

        {portfolioId && <PendingOrdersCard portfolioId={portfolioId} />}

        <DailyQuizCard />
      </div>

      {/* Action menu — 28px section gap */}
      <div style={{ padding: "28px 20px 0" }}>
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

      {/* ETF curation + volume leaders + recs (stacked, 12px gap) */}
      <div className="yg-stack" style={{ padding: "28px 20px 0" }}>
        <Suspense fallback={<CardSkeleton />}>
          <EtfCurationSection />
        </Suspense>
        <Suspense fallback={<CardSkeleton />}>
          <VolumeLeaders scope="KR" limit={5} />
        </Suspense>
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
