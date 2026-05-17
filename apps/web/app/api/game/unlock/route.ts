// Plan #33: 영구 해금 — 환생 포인트로 업그레이드 구매.

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { UNLOCK_CATALOG } from "@/lib/game/constants";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let body: { unlock_key?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const key = body.unlock_key;
  if (!key) return NextResponse.json({ error: "unlock_key_required" }, { status: 400 });

  const def = UNLOCK_CATALOG.find((u) => u.key === key);
  if (!def) return NextResponse.json({ error: "unknown_unlock" }, { status: 404 });

  // 현재 레벨 + 포인트 확인
  const [{ data: profile }, { data: existing }] = await Promise.all([
    supabase
      .from("profiles")
      .select("game_points")
      .eq("id", user.id)
      .maybeSingle(),
    supabase
      .from("game_unlocks")
      .select("level")
      .eq("user_id", user.id)
      .eq("unlock_key", key)
      .maybeSingle(),
  ]);

  const currentLevel = existing?.level ?? 0;
  if (currentLevel >= def.maxLevel) {
    return NextResponse.json({ error: "max_level_reached", level: currentLevel }, { status: 400 });
  }

  const userPoints = profile?.game_points ?? 0;
  if (userPoints < def.cost) {
    return NextResponse.json(
      { error: "insufficient_points", required: def.cost, available: userPoints },
      { status: 400 },
    );
  }

  const newLevel = currentLevel + 1;
  // 1. 해금 upsert
  await supabase.from("game_unlocks").upsert(
    {
      user_id: user.id,
      unlock_key: key,
      level: newLevel,
    },
    { onConflict: "user_id,unlock_key" },
  );

  // 2. 포인트 차감
  await supabase
    .from("profiles")
    .update({ game_points: userPoints - def.cost })
    .eq("id", user.id);

  return NextResponse.json({
    ok: true,
    unlock_key: key,
    new_level: newLevel,
    cost: def.cost,
    remaining_points: userPoints - def.cost,
  });
}
