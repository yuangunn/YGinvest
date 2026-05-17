// Plan #36: 게임 tick — 모드 기반 자동 진행 + 일기 + 이벤트.
// 사용자 진입 시 호출. 마지막 처리 이후 모든 day 처리해 character 갱신 + diary insert.

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { applyTickWithDiary, type GameCharacter } from "@/lib/game/tick";
import { INTELLIGENCE_FOR_GED } from "@/lib/game/constants";

export const dynamic = "force-dynamic";

export async function POST() {
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
  if (!character) {
    return NextResponse.json({ error: "no_character" }, { status: 404 });
  }

  const { data: unlocksRows } = await supabase
    .from("game_unlocks")
    .select("unlock_key, level")
    .eq("user_id", user.id);
  const unlocks: Record<string, number> = {};
  for (const u of unlocksRows ?? []) unlocks[u.unlock_key] = u.level;

  // 검정고시 이미 축하했나? (한 번만 노출)
  const { count: gedCount } = await supabase
    .from("game_diary")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .eq("entry_type", "milestone")
    .gte("metadata->>milestone_type", "ged")
    .lte("metadata->>milestone_type", "ged");
  // 더 간단: 이미 지력이 GED 임계 이상이면 이전에 축하했다고 가정
  const gedAlreadyCelebrated =
    character.intelligence >= INTELLIGENCE_FOR_GED &&
    (gedCount ?? 0) > 0;

  const nowIso = new Date().toISOString();
  const result = applyTickWithDiary(
    character as GameCharacter,
    unlocks,
    nowIso,
    gedAlreadyCelebrated,
  );

  if (result.diaryEntries.length === 0) {
    return NextResponse.json({
      character: result.updatedCharacter,
      new_entries: 0,
    });
  }

  // character 갱신
  await supabase
    .from("game_characters")
    .update({
      cash: result.updatedCharacter.cash,
      intelligence: result.updatedCharacter.intelligence,
      education_level: result.updatedCharacter.education_level,
      job_type: result.updatedCharacter.job_type,
      job_title: result.updatedCharacter.job_title,
      job_started_at: result.updatedCharacter.job_started_at,
      current_day: result.updatedCharacter.current_day,
      updated_at: nowIso,
    })
    .eq("user_id", user.id);

  // diary batch insert (rows에 user_id 추가)
  const rows = result.diaryEntries.map((e) => ({
    user_id: user.id,
    game_day: e.game_day,
    real_date: e.real_date,
    entry_type: e.entry_type,
    emoji: e.emoji,
    summary: e.summary,
    cash_delta: e.cash_delta,
    metadata: e.metadata ?? null,
  }));
  await supabase.from("game_diary").insert(rows);

  return NextResponse.json({
    character: result.updatedCharacter,
    new_entries: rows.length,
  });
}
