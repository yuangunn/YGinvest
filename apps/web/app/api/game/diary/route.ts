// Plan #36: 일기 조회 — 최근 N개 entry 반환.

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const limit = Math.min(200, Number(searchParams.get("limit") ?? 100));

  const { data: entries } = await supabase
    .from("game_diary")
    .select("game_day, real_date, entry_type, emoji, summary, cash_delta, metadata")
    .eq("user_id", user.id)
    .order("game_day", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(limit);

  return NextResponse.json({ entries: entries ?? [] });
}
