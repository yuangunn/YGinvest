// Plan #37: 환생 통계 — 본인 통계 + leaderboard.

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  // 1. 내 환생 기록
  const { data: myRebirths } = await supabase
    .from("game_rebirths")
    .select(
      "rebirth_number, starting_cash, total_assets, return_pct, days_played, points_earned, rebirthed_at",
    )
    .eq("user_id", user.id)
    .order("rebirth_number", { ascending: false })
    .limit(50);

  const list = myRebirths ?? [];
  let myStats = null;
  if (list.length > 0) {
    const avgDays = list.reduce((s, r) => s + r.days_played, 0) / list.length;
    const avgReturn = list.reduce((s, r) => s + Number(r.return_pct), 0) / list.length;
    const totalPoints = list.reduce((s, r) => s + r.points_earned, 0);
    const fastest = list.reduce((min, r) => Math.min(min, r.days_played), Infinity);
    const highestReturn = list.reduce(
      (max, r) => Math.max(max, Number(r.return_pct)),
      0,
    );
    myStats = {
      total_rebirths: list.length,
      avg_days_to_rebirth: Math.round(avgDays),
      avg_return_pct: avgReturn,
      total_points: totalPoints,
      fastest_rebirth_days: fastest === Infinity ? null : fastest,
      highest_return_pct: highestReturn,
    };
  }

  // 2. 전체 leaderboard (Top 20)
  // profiles + game_rebirth_count + game_points로 정렬
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

  return NextResponse.json({
    my_rebirths: list,
    my_stats: myStats,
    leaderboard: {
      by_rebirth_count: topByCount ?? [],
      by_points: topByPoints ?? [],
    },
  });
}
