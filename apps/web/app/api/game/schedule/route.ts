// Plan #33: 게임 스케줄 조회 / 저장.
// 사용자가 30일치 미리 짜둔 일정 — 한 번에 batch upsert.

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const VALID_ACTIVITIES = [
  "parttime", "fulltime", "study", "rest", "shopping",
  "dining", "healing", "exercise", "job_search", "free",
];

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { data: schedules } = await supabase
    .from("game_schedule")
    .select("game_day, activity, executed_at, result_summary")
    .eq("user_id", user.id)
    .order("game_day", { ascending: true });

  return NextResponse.json({ schedules: schedules ?? [] });
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let body: { schedules?: { game_day: number; activity: string }[] };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const items = body.schedules ?? [];
  if (!Array.isArray(items) || items.length === 0) {
    return NextResponse.json({ error: "schedules_required" }, { status: 400 });
  }
  if (items.length > 60) {
    return NextResponse.json({ error: "too_many_schedules" }, { status: 400 });
  }

  // validation
  for (const item of items) {
    if (typeof item.game_day !== "number" || item.game_day < 0 || item.game_day > 365) {
      return NextResponse.json({ error: "invalid_game_day" }, { status: 400 });
    }
    if (!VALID_ACTIVITIES.includes(item.activity)) {
      return NextResponse.json({ error: "invalid_activity" }, { status: 400 });
    }
  }

  // 이미 실행된 schedule은 수정 불가 — 미실행만 upsert
  const { data: executedDays } = await supabase
    .from("game_schedule")
    .select("game_day")
    .eq("user_id", user.id)
    .not("executed_at", "is", null);

  const lockedDays = new Set((executedDays ?? []).map((r) => r.game_day));
  const allowed = items.filter((i) => !lockedDays.has(i.game_day));

  if (allowed.length === 0) {
    return NextResponse.json({ ok: true, saved: 0 });
  }

  const records = allowed.map((i) => ({
    user_id: user.id,
    game_day: i.game_day,
    activity: i.activity,
  }));

  const { error } = await supabase
    .from("game_schedule")
    .upsert(records, { onConflict: "user_id,game_day" });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    saved: allowed.length,
    locked: items.length - allowed.length,
  });
}
