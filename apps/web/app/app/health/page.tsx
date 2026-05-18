import { redirect } from "next/navigation";
import Link from "next/link";
import { Activity, CheckCircle2, AlertCircle, ShieldCheck } from "lucide-react";
import {
  getKrMarketStatus,
  getUsMarketStatus,
} from "@/lib/market-hours-client";

export const dynamic = "force-dynamic";
export const revalidate = 0;

import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatMarketTimestamp } from "@/lib/time-format";
import { getIsAdmin } from "@/lib/auth-admin";

type LatestRow = { ts?: string; updated_at?: string; created_at?: string };

function ageMin(iso: string | undefined | null): number | null {
  if (!iso) return null;
  return Math.floor((new Date().getTime() - new Date(iso).getTime()) / 60_000);
}

export default async function HealthPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const isAdmin = await getIsAdmin(supabase, user.id);

  // 워커 heartbeat / 마지막 fetch 시각 점검 — 가벼운 쿼리 위주
  const [
    fx,
    stocks,
    bars,
    macro,
    activeUsers,
    earnings,
  ] = await Promise.all([
    supabase
      .from("fx_rates")
      .select("ts")
      .order("ts", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("stocks")
      .select("last_price_at")
      .order("last_price_at", { ascending: false, nullsFirst: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("stock_bars")
      .select("ts")
      .eq("interval", "1d")
      .order("ts", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("macro_indicators")
      .select("ts")
      .order("ts", { ascending: false })
      .limit(1)
      .maybeSingle(),
    // 최근 7일 활동 사용자 (portfolios.updated_at 기준)
    supabase
      .from("portfolios")
      .select("id", { count: "exact", head: true })
      .gte("updated_at", new Date(new Date().getTime() - 7 * 86400000).toISOString()),
    supabase
      .from("earnings_events")
      .select("fetched_at")
      .order("fetched_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const fxAge = ageMin((fx?.data as LatestRow | null)?.ts);
  const stocksAge = ageMin((stocks?.data as { last_price_at?: string } | null)?.last_price_at);
  const barsAge = ageMin((bars?.data as LatestRow | null)?.ts);
  const macroAge = ageMin((macro?.data as LatestRow | null)?.ts);
  const earningsAge = ageMin((earnings?.data as { fetched_at?: string } | null)?.fetched_at);

  function freshness(ageMinutes: number | null, freshThresholdMinutes: number) {
    if (ageMinutes === null) return { state: "missing" as const, label: "데이터 없음" };
    if (ageMinutes <= freshThresholdMinutes) return { state: "ok" as const, label: "정상" };
    if (ageMinutes <= freshThresholdMinutes * 3) return { state: "warn" as const, label: "지연" };
    return { state: "stale" as const, label: "오래됨" };
  }

  // 시장 휴장 시 fetch_prices는 gated → 데이터 안 갱신되는 게 정상.
  const krStatus = getKrMarketStatus();
  const usStatus = getUsMarketStatus();
  const anyMarketOpen =
    krStatus.state === "open" || usStatus.state === "open";

  const checks = [
    {
      name: "환율 (FX)",
      age: fxAge,
      thresh: 60,
      detail: "30분 cron — 60분 내 갱신 정상",
    },
    {
      name: "종목 가격 (last_price)",
      age: stocksAge,
      // 휴장 시엔 last fetch가 오래된 게 정상. 임계값 크게 잡음.
      thresh: anyMarketOpen ? 60 : 60 * 24 * 3,
      detail: anyMarketOpen
        ? "5분 cron — 60분 내 갱신 정상 (장중)"
        : `5분 cron — 현재 KR/US 모두 휴장 (${krStatus.message})`,
    },
    {
      name: "일봉 (stock_bars)",
      age: barsAge,
      // 주말(토일) + 월요일 장 미마감까지 정상 (4일 = 금요일 종가 + 주말 + 월 오전)
      thresh: 60 * 24 * 4,
      detail:
        "KR 16:00 / US 07:00 KST cron — 주말 휴장+장 미마감 포함 4일 이내 정상",
    },
    {
      name: "거시경제 지표 (macro)",
      age: macroAge,
      thresh: 60 * 24 * 2,
      detail: "매일 03:30 KST — 2일 이내 정상",
    },
    {
      name: "실적 일정 (earnings)",
      age: earningsAge,
      thresh: 60 * 24 * 2,
      detail: "매일 04:00 KST — 2일 이내 정상",
    },
  ];

  const activeUserCount = (activeUsers?.count as number | null) ?? 0;
  const overallOk = checks.every((c) => freshness(c.age, c.thresh).state === "ok");

  // ─────────── 일반 사용자 view (단순) ─────────────────────
  if (!isAdmin) {
    return (
      <div className="max-w-2xl mx-auto p-4 space-y-4">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <Activity className="h-5 w-5 text-primary" />
            서비스 상태
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            현재 YGinvest 서비스 작동 상태.
          </p>
        </div>

        <Card
          className={
            overallOk
              ? "border-green-500/40 bg-green-500/5"
              : "border-amber-500/40 bg-amber-500/5"
          }
        >
          <CardContent className="py-6 flex items-center gap-3">
            {overallOk ? (
              <>
                <CheckCircle2 className="h-8 w-8 text-green-500 flex-shrink-0" />
                <div>
                  <div className="font-semibold text-lg">
                    모든 시스템이 정상입니다
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    가격 데이터 / 환율 / 거시지표 모두 최신
                  </div>
                </div>
              </>
            ) : (
              <>
                <AlertCircle className="h-8 w-8 text-amber-500 flex-shrink-0" />
                <div>
                  <div className="font-semibold text-lg">일부 데이터 갱신 지연</div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    운영자가 확인 중입니다. 잠시 후 다시 시도해주세요.
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="py-3 text-xs text-muted-foreground space-y-1.5">
            <p>
              🛡️ 상세 시스템 정보는 운영자만 볼 수 있습니다. 문제 발견 시
              GitHub 또는 친구방에서 알려주세요.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ─────────── 관리자 view (전체 진단) ──────────────────────
  return (
    <div className="max-w-3xl mx-auto p-4 space-y-4">
      <div>
        <h1 className="text-xl font-bold flex items-center gap-2">
          <Activity className="h-5 w-5 text-primary" />
          시스템 상태
          <span className="inline-flex items-center gap-1 text-[10px] rounded-md border border-purple-500/40 bg-purple-500/10 text-purple-600 dark:text-purple-400 px-1.5 py-0.5 font-semibold">
            <ShieldCheck className="h-3 w-3" />
            ADMIN
          </span>
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          워커 job별 마지막 갱신 시각. 운영 모니터링용.
        </p>
      </div>

      <Link
        href="/app/admin/users"
        className="inline-flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-md border border-purple-500/40 bg-purple-500/5 hover:bg-purple-500/10 text-purple-600 dark:text-purple-400"
      >
        <ShieldCheck className="h-3.5 w-3.5" />
        관리자 설정 (사용자 관리)
      </Link>

      <Card
        className={
          overallOk
            ? "border-green-500/40 bg-green-500/5"
            : "border-amber-500/40 bg-amber-500/5"
        }
      >
        <CardContent className="py-3 flex items-center gap-2">
          {overallOk ? (
            <>
              <CheckCircle2 className="h-5 w-5 text-green-500" />
              <span className="font-medium">All systems operational</span>
            </>
          ) : (
            <>
              <AlertCircle className="h-5 w-5 text-amber-500" />
              <span className="font-medium">일부 데이터 갱신 지연</span>
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">데이터 신선도</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {checks.map((c) => {
              const f = freshness(c.age, c.thresh);
              const color =
                f.state === "ok"
                  ? "text-green-500"
                  : f.state === "warn"
                    ? "text-amber-500"
                    : f.state === "stale"
                      ? "text-red-500"
                      : "text-muted-foreground";
              return (
                <div
                  key={c.name}
                  className="flex items-start justify-between gap-2 border-b last:border-0 pb-2 last:pb-0"
                >
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium">{c.name}</div>
                    <div className="text-[10px] text-muted-foreground">
                      {c.detail}
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div className={`text-sm font-medium ${color}`}>
                      {f.label}
                    </div>
                    <div className="text-[10px] text-muted-foreground">
                      {c.age === null
                        ? "—"
                        : c.age < 60
                          ? `${c.age}분 전`
                          : c.age < 60 * 24
                            ? `${Math.floor(c.age / 60)}시간 전`
                            : `${Math.floor(c.age / 60 / 24)}일 전`}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">활동 사용자</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <div className="text-xs text-muted-foreground">최근 7일 활동</div>
              <div className="text-2xl font-bold font-mono">{activeUserCount}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">
                마지막 종목 가격 fetch
              </div>
              <div className="text-xs font-mono">
                {(stocks?.data as { last_price_at?: string } | null)?.last_price_at
                  ? formatMarketTimestamp(
                      (stocks!.data as { last_price_at: string })
                        .last_price_at,
                      "NASDAQ",
                    )
                  : "—"}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <p className="text-[10px] text-muted-foreground text-center">
        Worker (Oracle Cloud VM) + Supabase (Cloud). 매 15분 자동 health monitor + Telegram 알림.
      </p>
    </div>
  );
}
