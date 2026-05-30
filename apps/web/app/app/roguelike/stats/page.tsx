// Plan #37: 환생 통계 페이지 — 본인 기록 + 전체 leaderboard.

import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Trophy, Award, Zap, TrendingUp } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/supabase/user";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const dynamic = "force-dynamic";

const KRW = new Intl.NumberFormat("ko-KR", {
  style: "currency",
  currency: "KRW",
  maximumFractionDigits: 0,
});

type Rebirth = {
  rebirth_number: number;
  starting_cash: number;
  total_assets: number;
  return_pct: number;
  days_played: number;
  points_earned: number;
  rebirthed_at: string;
};

type LeaderboardEntry = {
  id: string;
  display_name: string | null;
  game_rebirth_count: number;
  game_points: number;
};

export default async function GameStatsPage() {
  const supabase = await createClient();
  const user = await getCurrentUser();
  if (!user) redirect("/auth/login");

  // 본인 환생 기록
  const { data: myRebirths } = await supabase
    .from("game_rebirths")
    .select(
      "rebirth_number, starting_cash, total_assets, return_pct, days_played, points_earned, rebirthed_at",
    )
    .eq("user_id", user.id)
    .order("rebirth_number", { ascending: false })
    .limit(50);
  const list: Rebirth[] = (myRebirths ?? []) as Rebirth[];

  // 통계 계산
  let myStats: {
    total_rebirths: number;
    avg_days: number;
    avg_return: number;
    total_points: number;
    fastest: number | null;
    highest: number;
  } | null = null;
  if (list.length > 0) {
    const avgDays = list.reduce((s, r) => s + r.days_played, 0) / list.length;
    const avgReturn = list.reduce((s, r) => s + Number(r.return_pct), 0) / list.length;
    const totalPoints = list.reduce((s, r) => s + r.points_earned, 0);
    const fastest = list.reduce((min, r) => Math.min(min, r.days_played), Infinity);
    const highest = list.reduce((max, r) => Math.max(max, Number(r.return_pct)), 0);
    myStats = {
      total_rebirths: list.length,
      avg_days: Math.round(avgDays),
      avg_return: avgReturn,
      total_points: totalPoints,
      fastest: fastest === Infinity ? null : fastest,
      highest,
    };
  }

  // Leaderboard
  const { data: topByCount } = await supabase
    .from("profiles")
    .select("id, display_name, game_rebirth_count, game_points")
    .gt("game_rebirth_count", 0)
    .order("game_rebirth_count", { ascending: false })
    .limit(20);

  const { data: topByPoints } = await supabase
    .from("profiles")
    .select("id, display_name, game_rebirth_count, game_points")
    .gt("game_points", 0)
    .order("game_points", { ascending: false })
    .limit(20);

  const byCount: LeaderboardEntry[] = (topByCount ?? []) as LeaderboardEntry[];
  const byPoints: LeaderboardEntry[] = (topByPoints ?? []) as LeaderboardEntry[];

  return (
    <div className="max-w-3xl mx-auto p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Link
          href="/app/roguelike"
          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-3 w-3" /> 게임으로
        </Link>
      </div>

      <h1 className="text-2xl font-bold flex items-center gap-2">
        <Trophy className="h-6 w-6 text-amber-500" />
        환생 통계 + 리더보드
      </h1>

      {/* 내 통계 */}
      {myStats && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">📊 내 환생 기록</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              <StatCell
                icon={<Trophy className="h-3 w-3" />}
                label="누적 환생"
                value={`${myStats.total_rebirths}회`}
                color="text-amber-500"
              />
              <StatCell
                icon={<Award className="h-3 w-3" />}
                label="누적 포인트"
                value={`${myStats.total_points}pt`}
                color="text-purple-500"
              />
              <StatCell
                icon={<Zap className="h-3 w-3" />}
                label="최단 환생"
                value={myStats.fastest != null ? `${myStats.fastest}일` : "—"}
                color="text-emerald-500"
              />
              <StatCell
                icon={<TrendingUp className="h-3 w-3" />}
                label="최고 수익률"
                value={`${(myStats.highest * 100).toFixed(2)}%`}
                color="text-blue-500"
              />
              <StatCell
                icon={null}
                label="평균 환생일"
                value={`${myStats.avg_days}일`}
              />
              <StatCell
                icon={null}
                label="평균 수익률"
                value={`${(myStats.avg_return * 100).toFixed(2)}%`}
              />
            </div>
          </CardContent>
        </Card>
      )}

      {/* 환생 기록 리스트 */}
      {list.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">🌅 내 환생 히스토리</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-1 max-h-80 overflow-y-auto">
              {list.map((r) => (
                <div
                  key={r.rebirth_number}
                  className="flex items-center justify-between text-xs rounded p-2 hover:bg-muted/30"
                >
                  <div>
                    <div className="font-semibold">
                      #{r.rebirth_number}
                      <span className="text-muted-foreground font-normal ml-1.5">
                        {new Date(r.rebirthed_at).toLocaleDateString("ko-KR")}
                      </span>
                    </div>
                    <div className="text-[10px] text-muted-foreground">
                      {r.days_played}일 · {KRW.format(Number(r.starting_cash))} →{" "}
                      {KRW.format(Number(r.total_assets))}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-mono text-emerald-600 dark:text-emerald-400 font-semibold">
                      +{(Number(r.return_pct) * 100).toFixed(2)}%
                    </div>
                    <div className="text-[10px] text-muted-foreground">
                      💎 +{r.points_earned}pt
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Leaderboard - 환생 횟수 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">🏆 리더보드 — 환생 횟수</CardTitle>
        </CardHeader>
        <CardContent>
          <LeaderboardList list={byCount} sortKey="rebirth_count" myId={user.id} />
        </CardContent>
      </Card>

      {/* Leaderboard - 누적 포인트 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">💎 리더보드 — 누적 포인트</CardTitle>
        </CardHeader>
        <CardContent>
          <LeaderboardList list={byPoints} sortKey="points" myId={user.id} />
        </CardContent>
      </Card>

      {!myStats && (
        <Card>
          <CardContent className="py-6 text-center text-sm text-muted-foreground">
            아직 환생 기록이 없어요.
            <br />
            <Link href="/app/roguelike" className="text-primary hover:underline">
              게임 시작하기 →
            </Link>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function StatCell({
  icon, label, value, color,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  color?: string;
}) {
  return (
    <div className="rounded-md border bg-muted/30 p-2.5">
      <div className="text-[10px] text-muted-foreground flex items-center gap-1">
        {icon}
        {label}
      </div>
      <div className={`text-base font-bold tabular-nums mt-0.5 ${color ?? ""}`}>
        {value}
      </div>
    </div>
  );
}

function LeaderboardList({
  list, sortKey, myId,
}: {
  list: LeaderboardEntry[];
  sortKey: "rebirth_count" | "points";
  myId: string;
}) {
  if (list.length === 0) {
    return <p className="text-xs text-muted-foreground">아직 기록 없음</p>;
  }
  return (
    <div className="space-y-1">
      {list.map((p, idx) => {
        const isMe = p.id === myId;
        const value =
          sortKey === "rebirth_count"
            ? `${p.game_rebirth_count}회`
            : `${p.game_points}pt`;
        return (
          <div
            key={p.id}
            className={`flex items-center justify-between rounded p-2 ${
              isMe ? "bg-primary/10 border border-primary/40" : ""
            }`}
          >
            <div className="flex items-center gap-2 min-w-0">
              <span
                className={`text-xs font-bold w-6 tabular-nums ${
                  idx === 0
                    ? "text-amber-500"
                    : idx === 1
                      ? "text-slate-400"
                      : idx === 2
                        ? "text-orange-600"
                        : "text-muted-foreground"
                }`}
              >
                {idx + 1}
              </span>
              <span className="text-sm truncate">
                {p.display_name ?? "익명"} {isMe && "(나)"}
              </span>
            </div>
            <span className="text-sm font-mono font-semibold tabular-nums">
              {value}
            </span>
          </div>
        );
      })}
    </div>
  );
}
