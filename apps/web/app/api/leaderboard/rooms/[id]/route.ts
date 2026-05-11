import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  // 방 멤버의 portfolio들
  const { data: members } = await supabase
    .from("room_members")
    .select("user_id, portfolio_id, profiles(display_name, avatar_url)")
    .eq("room_id", id);
  if (!members || members.length === 0) {
    return NextResponse.json({ leaderboard: [] });
  }

  const ids = members.map((m) => m.portfolio_id);
  const { data: snapshots } = await supabase
    .from("portfolio_snapshots")
    .select("portfolio_id, total_value_krw, return_pct, ts")
    .in("portfolio_id", ids)
    .order("ts", { ascending: false });

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

  const ranked = members
    .map((m) => {
      const profile = Array.isArray(m.profiles) ? m.profiles[0] : m.profiles;
      const snap = latest.get(m.portfolio_id);
      return {
        portfolio_id: m.portfolio_id,
        display_name: profile?.display_name ?? "익명",
        avatar_url: profile?.avatar_url ?? null,
        total_value_krw: snap?.total ?? null,
        return_pct: snap?.pct ?? null,
        snapshot_ts: snap?.ts ?? null,
      };
    })
    .sort(
      (a, b) => (b.return_pct ?? -Infinity) - (a.return_pct ?? -Infinity),
    );

  return NextResponse.json({ leaderboard: ranked });
}
