import Link from "next/link";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { getSelectedPortfolioId } from "@/lib/portfolio-context";
import { RecommendationsSection } from "@/components/recommendations-section";

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

const KRW = new Intl.NumberFormat("ko-KR", { style: "currency", currency: "KRW" });
const USD = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const portfolioId = await getSelectedPortfolioId(supabase, user.id);
  const { data: portfolio } = portfolioId
    ? await supabase
        .from("portfolios")
        .select("krw_balance, usd_balance, starting_krw, starting_usd, room_id, status")
        .eq("id", portfolioId)
        .maybeSingle()
    : { data: null };

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-6">
      <h1 className="text-2xl font-bold">대시보드</h1>
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

      <Card>
        <CardHeader>
          <CardTitle className="text-base">곧 추가될 기능</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-2">
          <div>
            <Link href="/app/trade/search" className="text-foreground underline">
              → 종목 검색
            </Link>
          </div>
          <div>
            <Link href="/app/portfolio/overview" className="text-foreground underline">
              → 포트폴리오 Overview
            </Link>
          </div>
          <div>
            <Link href="/app/portfolio/holdings" className="text-foreground underline">
              → 보유 종목
            </Link>
          </div>
          <div>
            <Link href="/app/portfolio/orders" className="text-foreground underline">
              → 주문 내역
            </Link>
          </div>
          <div>
            <Link href="/app/portfolio/transactions" className="text-foreground underline">
              → 체결·환전 내역
            </Link>
          </div>
          <div>
            <Link href="/app/fx" className="text-foreground underline">
              → 환전 (KRW ↔ USD)
            </Link>
          </div>
          <div>
            <Link href="/app/watchlist" className="text-foreground underline">
              → 관심 종목
            </Link>
          </div>
          <div>
            <Link href="/app/rooms" className="text-foreground underline">
              → 친구방
            </Link>
          </div>
          <div>
            <Link href="/app/leaderboard" className="text-foreground underline">
              → 글로벌 리더보드
            </Link>
          </div>
          <div>
            <Link href="/app/settings" className="text-foreground underline">
              → 설정 (푸시 알림)
            </Link>
          </div>
          <div className="pt-2 border-t">· PWA & Polish (Plan #9)</div>
        </CardContent>
      </Card>
    </div>
  );
}
