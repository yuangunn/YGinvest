import { redirect } from "next/navigation";
import { Activity, CheckCircle2, AlertCircle } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatMarketTimestamp } from "@/lib/time-format";

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
      thresh: 60,
      detail: "5분 cron — 60분 내 갱신 정상 (장중)",
    },
    {
      name: "일봉 (stock_bars)",
      age: barsAge,
      thresh: 60 * 24 * 2,
      detail: "KR 장 마감 후 + US 장 마감 후 daily — 2일 이내 정상",
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

  return (
    <div className="max-w-3xl mx-auto p-4 space-y-4">
      <div>
        <h1 className="text-xl font-bold flex items-center gap-2">
          <Activity className="h-5 w-5 text-primary" />
          시스템 상태
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          워커 job별 마지막 갱신 시각. 운영 모니터링용.
        </p>
      </div>

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
        Worker (Railway) + Supabase (Cloud). 운영자가 5분 간격으로 점검 권장.
      </p>
    </div>
  );
}
