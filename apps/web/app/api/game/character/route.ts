// Plan #33: 게임 캐릭터 조회 / 생성.

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { STARTING_CASH } from "@/lib/game/constants";

export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { data: character } = await supabase
    .from("game_characters")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();

  return NextResponse.json({ character });
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let body: { name?: string; gender?: string; education_level?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const name = (body.name ?? "").trim().slice(0, 20);
  const gender = body.gender ?? "other";
  const education = body.education_level ?? "highschool";

  if (!name) {
    return NextResponse.json({ error: "name_required" }, { status: 400 });
  }
  if (!["male", "female", "other"].includes(gender)) {
    return NextResponse.json({ error: "invalid_gender" }, { status: 400 });
  }
  if (!["highschool", "bachelor"].includes(education)) {
    return NextResponse.json({ error: "invalid_education" }, { status: 400 });
  }

  // 대졸 시작은 bachelor_unlock 해금 필요
  if (education === "bachelor") {
    const { data: unlock } = await supabase
      .from("game_unlocks")
      .select("level")
      .eq("user_id", user.id)
      .eq("unlock_key", "bachelor_unlock")
      .maybeSingle();
    if (!unlock) {
      return NextResponse.json(
        { error: "bachelor_locked", hint: "환생 포인트 100pt로 해금 필요" },
        { status: 403 },
      );
    }
  }

  // 시작 자본 보너스 적용
  const { data: unlocks } = await supabase
    .from("game_unlocks")
    .select("unlock_key, level")
    .eq("user_id", user.id);

  const unlockMap: Record<string, number> = {};
  for (const u of unlocks ?? []) unlockMap[u.unlock_key] = u.level;

  let startingCash = STARTING_CASH;
  startingCash += (unlockMap["starting_cash_boost"] ?? 0) * 1_000_000;
  if ((unlockMap["real_estate_starter"] ?? 0) > 0) startingCash += 50_000_000;

  const startingIntelligence = education === "bachelor" ? 500 : 0;

  const record = {
    user_id: user.id,
    name,
    gender,
    education_level: education,
    cash: startingCash,
    starting_cash: startingCash,
    intelligence: startingIntelligence,
    fatigue: 0,
    happiness: 50,
    job_type: "unemployed",
    job_title: null,
    job_started_at: null,
    life_started_at: new Date().toISOString(),
    current_day: 0,
  };

  const { error } = await supabase
    .from("game_characters")
    .upsert(record, { onConflict: "user_id" });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, character: record });
}
