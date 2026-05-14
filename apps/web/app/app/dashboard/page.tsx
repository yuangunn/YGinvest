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
  PieChart,
  Search,
  Sparkles,
  Tags,
  Users,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { getSelectedPortfolioId } from "@/lib/portfolio-context";
import { RecommendationsSection } from "@/components/recommendations-section";
import { PersonalizedRecommendations } from "@/components/personalized-recommendations";
import { VolumeLeaders } from "@/components/volume-leaders";

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

const QUICK_ACTIONS = [
  { href: "/app/trade/search", label: "검색", Icon: Search },
  { href: "/app/curation", label: "큐레이션", Icon: Sparkles },
  { href: "/app/themes", label: "테마주", Icon: Tags },
  { href: "/app/sectors", label: "섹터", Icon: Grid3x3 },
  { href: "/app/earnings", label: "실적", Icon: Calendar },
  { href: "/app/backtest", label: "백테스트", Icon: LineChart },
  { href: "/app/correlation", label: "상관관계", Icon: Grid3x3 },
  { href: "/app/portfolio/analysis", label: "매매분석", Icon: LineChart },
  { href: "/app/learn", label: "학습", Icon: BookOpen },
  { href: "/app/fx", label: "환전", Icon: ArrowLeftRight },
  { href: "/app/rooms", label: "친구방", Icon: Users },
  { href: "/app/settings", label: "알림", Icon: Bell },
] as const;

const ECONOMY_ACTIONS = [
  { href: "/app/macro", label: "거시경제", Icon: Activity },
  { href: "/app/macro/calendar", label: "경제 캘린더", Icon: Calendar },
  { href: "/app/macro/history", label: "경제 사건", Icon: BookOpen },
  { href: "/app/portfolio/scenarios", label: "시나리오", Icon: Activity },
  { href: "/app/portfolio/allocation", label: "자산배분", Icon: PieChart },
  { href: "/app/portfolio/dividend-sim", label: "배당시뮬", Icon: Coins },
  { href: "/app/strategies", label: "유명 전략", Icon: Award },
  { href: "/app/portfolio/behavior", label: "행동분석", Icon: Brain },
  { href: "/app/portfolio/what-if", label: "What-If", Icon: GitCompare },
] as const;

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const [{ data: profile }, portfolioId] = await Promise.all([
    supabase
      .from("profiles")
      .select("display_name")
      .eq("id", user.id)
      .maybeSingle(),
    getSelectedPortfolioId(supabase, user.id),
  ]);

  const { data: portfolio } = portfolioId
    ? await supabase
        .from("portfolios")
        .select(
          "krw_balance, usd_balance, starting_krw, starting_usd, room_id, status",
        )
        .eq("id", portfolioId)
        .maybeSingle()
    : { data: null };

  const greetingName = profile?.display_name ?? user.email?.split("@")[0] ?? "투자자";

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">안녕하세요, {greetingName}님 👋</h1>
        <p className="text-sm text-muted-foreground mt-1">
          오늘의 시장을 확인해보세요.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">KRW 잔고</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {portfolio ? KRW.format(Number(portfolio.krw_balance)) : "—"}
            </div>
            <div className="text-xs text-muted-foreground">
              시작: {portfolio ? KRW.format(Number(portfolio.starting_krw)) : "—"}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">USD 잔고</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {portfolio ? USD.format(Number(portfolio.usd_balance)) : "—"}
            </div>
            <div className="text-xs text-muted-foreground">
              시작: {portfolio ? USD.format(Number(portfolio.starting_usd)) : "—"}
            </div>
          </CardContent>
        </Card>
      </div>

      <Link
        href="/app/portfolio/overview"
        className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
      >
        포트폴리오 상세 보기 <ArrowRight className="h-3.5 w-3.5" />
      </Link>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">빠른 작업</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-3">
            {QUICK_ACTIONS.map(({ href, label, Icon }) => (
              <Link
                key={href}
                href={href}
                className="flex flex-col items-center gap-2 p-3 rounded-lg border hover:bg-accent hover:border-primary/40 transition-colors"
              >
                <Icon className="h-5 w-5 text-primary" />
                <span className="text-xs font-medium">{label}</span>
              </Link>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">📚 경제 학습</CardTitle>
          <p className="text-xs text-muted-foreground mt-1">
            거시경제 + 펀더멘털 + 행동경제학 — 시장을 더 깊이 이해하는 도구
          </p>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-3">
            {ECONOMY_ACTIONS.map(({ href, label, Icon }) => (
              <Link
                key={href}
                href={href}
                className="flex flex-col items-center gap-2 p-3 rounded-lg border hover:bg-accent hover:border-primary/40 transition-colors"
              >
                <Icon className="h-5 w-5 text-primary" />
                <span className="text-xs font-medium text-center">{label}</span>
              </Link>
            ))}
          </div>
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
