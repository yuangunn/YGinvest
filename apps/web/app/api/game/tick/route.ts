// Plan #33: 게임 tick — 사용자 진입 시 호출.
// 밀린 스케줄 실행 + character 갱신 + 결과 반환.

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  applyScheduleTicks,
  type GameCharacter,
  type ScheduleRow,
} from "@/lib/game/tick";

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

  // 미실행 schedule fetch
  const { data: schedules } = await supabase
    .from("game_schedule")
    .select("*")
    .eq("user_id", user.id)
    .is("executed_at", null)
    .order("game_day", { ascending: true });

  const { data: unlocksRows } = await supabase
    .from("game_unlocks")
    .select("unlock_key, level")
    .eq("user_id", user.id);

  const unlocks: Record<string, number> = {};
  for (const u of unlocksRows ?? []) unlocks[u.unlock_key] = u.level;

  const nowIso = new Date().toISOString();
  const result = applyScheduleTicks(
    character as GameCharacter,
    (schedules ?? []) as ScheduleRow[],
    unlocks,
    nowIso,
  );

  if (result.executedSchedules.length === 0) {
    // 변경 없음 — 빠른 반환
    return NextResponse.json({
      character: result.character,
      executed: [],
      events: [],
    });
  }

  // character 갱신
  await supabase
    .from("game_characters")
    .update({
      cash: result.character.cash,
      fatigue: result.character.fatigue,
      intelligence: result.character.intelligence,
      happiness: result.character.happiness,
      job_type: result.character.job_type,
      job_title: result.character.job_title,
      current_day: result.character.current_day,
      updated_at: nowIso,
    })
    .eq("user_id", user.id);

  // schedule executed 마킹 (batched)
  for (const s of result.executedSchedules) {
    await supabase
      .from("game_schedule")
      .update({ executed_at: nowIso, result_summary: s.result_summary })
      .eq("user_id", user.id)
      .eq("game_day", s.game_day);
  }

  return NextResponse.json({
    character: result.character,
    executed: result.executedSchedules,
    events: result.events,
  });
}
