import Link from "next/link";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import {
  Activity,
  ArrowLeftRight,
  ArrowRight,
  Award,
  Bell,
  BookOpen,
  Brain,
  Calendar,
  Coins,
  GitCompare,
  Grid3x3,
  LineChart,
  ListChecks,
  PieChart,
  Search,
  Smartphone,
  Sparkles,
  Tags,
  Users,
  Wallet,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { getSelectedPortfolioId } from "@/lib/portfolio-context";
import { RecommendationsSection } from "@/components/recommendations-section";
import { PersonalizedRecommendations } from "@/components/personalized-recommendations";
import { VolumeLeaders } from "@/components/volume-leaders";
import { DailyQuizCard } from "@/components/daily-quiz-card";
import { ChangelogLink } from "@/components/changelog-link";
import { PendingOrdersCard } from "@/components/pending-orders-card";
import { getIsAdmin } from "@/lib/auth-admin";
import { ShieldCheck } from "lucide-react";
import changelogData from "@/lib/changelog-data.json";

function RecommendationsSkeleton() {
  return (
    <Card>
      <CardHeader>
        <Skeleton className="h-5 w-32" />
      </CardHeader>
      <CardContent>
        <div className="flex gap-2 overflow-x-auto pb-2">
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className="flex-shrink-0 w-40 border rounded-lg p-3 space-y-2">
              <Skeleton className="h-3 w-8" />
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-3 w-16" />
              <Skeleton className="h-4 w-20" />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

const KRW = new Intl.NumberFormat("ko-KR", {
  style: "currency",
  currency: "KRW",
  maximumFractionDigits: 0,
});
const USD = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });

// Plan #27.5: 카테고리별 그룹화 — 학습 중복 제거.
const ACTION_GROUPS = [
  {
    title: "💼 거래",
    items: [
      { href: "/app/trade/search", label: "검색", Icon: Search },
      { href: "/app/curation", label: "큐레이션", Icon: Sparkles },
      { href: "/app/themes", label: "테마주", Icon: Tags },
      { href: "/app/sectors", label: "섹터", Icon: Grid3x3 },
      { href: "/app/earnings", label: "실적", Icon: Calendar },
      { href: "/app/strategies", label: "유명 전략", Icon: Award },
    ],
  },
  {
    title: "📊 분석 도구",
    items: [
      { href: "/app/backtest", label: "백테스트", Icon: LineChart },
      { href: "/app/correlation", label: "상관관계", Icon: Grid3x3 },
      { href: "/app/portfolio/analysis", label: "매매분석", Icon: LineChart },
      { href: "/app/portfolio/scenarios", label: "시나리오", Icon: Activity },
      { href: "/app/portfolio/behavior", label: "행동분석", Icon: Brain },
      { href: "/app/portfolio/what-if", label: "vs 인덱스", Icon: GitCompare },
      { href: "/app/whatif", label: "가상 매수", Icon: GitCompare },
      { href: "/app/portfolio/allocation", label: "자산배분", Icon: PieChart },
      { href: "/app/portfolio/dividend-sim", label: "배당시뮬", Icon: Coins },
    ],
  },
  {
    title: "📚 경제 학습",
    items: [
      { href: "/app/learn", label: "학습 글", Icon: BookOpen },
      { href: "/app/learn/glossary", label: "용어사전", Icon: BookOpen },
      { href: "/app/macro", label: "거시경제", Icon: Activity },
      { href: "/app/macro/guide", label: "지표 읽기", Icon: Activity },
      { href: "/app/macro/calendar", label: "경제 캘린더", Icon: Calendar },
      { href: "/app/macro/history", label: "경제 사건", Icon: BookOpen },
    ],
  },
  {
    title: "🛠️ 기타",
    items: [
      { href: "/app/fx", label: "환전", Icon: ArrowLeftRight },
      { href: "/app/rooms", label: "친구방", Icon: Users },
      { href: "/app/settings", label: "알림 설정", Icon: Bell },
      { href: "/app/help/install", label: "앱 설치", Icon: Smartphone },
    ],
  },
] as const;

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

  const [{ data: portfolio }, holdingsRes] = portfolioId
    ? await Promise.all([
        supabase
          .from("portfolios")
          .select(
            "krw_balance, usd_balance, starting_krw, starting_usd, room_id, status",
          )
          .eq("id", portfolioId)
          .maybeSingle(),
        supabase
          .from("holdings")
          .select("symbol", { count: "exact", head: true })
          .eq("portfolio_id", portfolioId)
          .gt("qty", 0),
      ])
    : [{ data: null }, { count: null }];
  const holdingsCount = (holdingsRes?.count as number | null) ?? 0;

  const greetingName = profile?.display_name ?? user.email?.split("@")[0] ?? "투자자";
  const latestChangelogSha =
    (changelogData as { sha: string }[])[0]?.sha ?? null;

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-6">
      <div className="flex items-start justify-between gap-2 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            안녕하세요, {greetingName}님 👋
            {isAdmin && (
              <span
                className="inline-flex items-center gap-0.5 text-[10px] rounded-md border border-purple-500/40 bg-purple-500/10 text-purple-600 dark:text-purple-400 px-1.5 py-0.5 font-semibold"
                title="관리자 권한 있음"
              >
                <ShieldCheck className="h-3 w-3" />
                ADMIN
              </span>
            )}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            오늘의 시장을 확인해보세요.
          </p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <ChangelogLink latestSha={latestChangelogSha} />
          {isAdmin && (
            <Link
              href="/app/health"
              className="inline-flex items-center gap-1 text-xs text-purple-600 dark:text-purple-400 hover:underline"
            >
              <ShieldCheck className="h-3 w-3" />
              시스템 상태
            </Link>
          )}
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center justify-between">
            <span className="inline-flex items-center gap-2">
              <Wallet className="h-4 w-4 text-primary" />
              내 자산
            </span>
            <Link
              href="/app/portfolio/overview"
              className="text-xs text-primary hover:underline inline-flex items-center gap-0.5"
            >
              전체 보기 <ArrowRight className="h-3 w-3" />
            </Link>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="text-xs text-muted-foreground">KRW</div>
              <div className="text-xl font-bold tabular-nums">
                {portfolio ? KRW.format(Number(portfolio.krw_balance)) : "—"}
              </div>
              <div className="text-[10px] text-muted-foreground">
                시작:{" "}
                {portfolio ? KRW.format(Number(portfolio.starting_krw)) : "—"}
              </div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">USD</div>
              <div className="text-xl font-bold tabular-nums">
                {portfolio ? USD.format(Number(portfolio.usd_balance)) : "—"}
              </div>
              <div className="text-[10px] text-muted-foreground">
                시작:{" "}
                {portfolio ? USD.format(Number(portfolio.starting_usd)) : "—"}
              </div>
            </div>
          </div>
          {/* 직접 진입 버튼 — 보유 종목 / 거래 내역 */}
          <div className="grid grid-cols-2 gap-2 mt-4 pt-3 border-t">
            <Link
              href="/app/portfolio/holdings"
              className="flex items-center justify-between rounded-md border px-3 py-2 hover:bg-accent hover:border-primary/40 text-sm transition-colors"
            >
              <span className="inline-flex items-center gap-1.5">
                <ListChecks className="h-3.5 w-3.5 text-primary" />
                보유 종목
              </span>
              <span className="text-xs text-muted-foreground tabular-nums">
                {holdingsCount > 0 ? `${holdingsCount}개` : "—"}
              </span>
            </Link>
            <Link
              href="/app/portfolio/transactions"
              className="flex items-center justify-between rounded-md border px-3 py-2 hover:bg-accent hover:border-primary/40 text-sm transition-colors"
            >
              <span className="inline-flex items-center gap-1.5">
                <LineChart className="h-3.5 w-3.5 text-primary" />
                거래 내역
              </span>
              <ArrowRight className="h-3 w-3 text-muted-foreground" />
            </Link>
          </div>
        </CardContent>
      </Card>

      {portfolioId && <PendingOrdersCard portfolioId={portfolioId} />}

      <DailyQuizCard />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">빠른 작업</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          {ACTION_GROUPS.map((group) => (
            <div key={group.title}>
              <h3 className="text-xs font-semibold text-muted-foreground mb-2">
                {group.title}
              </h3>
              <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-3">
                {group.items.map(({ href, label, Icon }) => (
                  <Link
                    key={href}
                    href={href}
                    className="flex flex-col items-center gap-2 p-3 rounded-lg border hover:bg-accent hover:border-primary/40 transition-colors"
                  >
                    <Icon className="h-5 w-5 text-primary" />
                    <span className="text-xs font-medium text-center">
                      {label}
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {portfolioId && (
        <Suspense fallback={<RecommendationsSkeleton />}>
          <PersonalizedRecommendations portfolioId={portfolioId} />
        </Suspense>
      )}

      <Suspense fallback={<RecommendationsSkeleton />}>
        <VolumeLeaders scope="KR" limit={5} />
      </Suspense>

      <Suspense fallback={<RecommendationsSkeleton />}>
        <RecommendationsSection category="top_gainers" scope="KR" />
      </Suspense>
      <Suspense fallback={<RecommendationsSkeleton />}>
        <RecommendationsSection category="volume_surge" scope="KR" />
      </Suspense>
      <Suspense fallback={<RecommendationsSkeleton />}>
        <RecommendationsSection category="low_per_value" scope="KR" />
      </Suspense>
      <Suspense fallback={<RecommendationsSkeleton />}>
        <RecommendationsSection category="top_gainers" scope="US" />
      </Suspense>
      <Suspense fallback={<RecommendationsSkeleton />}>
        <RecommendationsSection category="near_52w_high" scope="US" />
      </Suspense>
    </div>
  );
}
