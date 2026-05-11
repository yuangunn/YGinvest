import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const limit = Number(searchParams.get("limit") ?? "100");

  // 각 글로벌 portfolio의 최신 snapshot.
  // RLS상 모든 사용자가 자기 자신의 portfolio는 보지만, 글로벌 리더보드는
  // 정책적으로 본인 외 사용자 portfolio + profile에 대한 read 허용이 필요.
  // 현재 RLS: portfolios "본인 읽기" + "같은 방 멤버 읽기" / profiles는 모두 select 허용.
  // → 글로벌(room_id IS NULL) 리더보드는 portfolio_snapshots의 RLS에 의존.
  //   현재 snapshots RLS: 본인 + 같은 방 멤버. 글로벌은 본인 것만 보임.
  //   v1에서 글로벌은 limited (다른 유저 snapshot 안 보임) — 이 라우트는 본인 행만 반환.
  //   완전한 글로벌 랭킹은 v1.5에서 material view + service_role API로 처리.
  const { data: portfolios } = await supabase
    .from("portfolios")
    .select("id, user_id, profiles(display_name, avatar_url)")
    .is("room_id", null)
    .eq("status", "active");
  if (!portfolios) return NextResponse.json({ leaderboard: [] });

  const ids = portfolios.map((p) => p.id);
  const { data: snapshots } = await supabase
    .from("portfolio_snapshots")
    .select("portfolio_id, total_value_krw, return_pct, ts")
    .in("portfolio_id", ids)
    .order("ts", { ascending: false });

  // portfolio별 latest snapshot
  const latest = new Map<string, { total: number; pct: number; ts: string }>();
  for (const s of snapshots ?? []) {
    if (!latest.has(s.portfolio_id)) {
      latest.set(s.portfolio_id, {
        total: Number(s.total_value_krw),
        pct: Number(s.return_pct),
        ts: s.ts,
      });
    }
  }

  const ranked = portfolios
    .map((p) => {
      const profile = Array.isArray(p.profiles) ? p.profiles[0] : p.profiles;
      const snap = latest.get(p.id);
      return {
        portfolio_id: p.id,
        display_name: profile?.display_name ?? "익명",
        avatar_url: profile?.avatar_url ?? null,
        total_value_krw: snap?.total ?? null,
        return_pct: snap?.pct ?? null,
        snapshot_ts: snap?.ts ?? null,
      };
    })
    .filter((r) => r.return_pct !== null)
    .sort((a, b) => b.return_pct! - a.return_pct!)
    .slice(0, limit);

  return NextResponse.json({ leaderboard: ranked });
}
