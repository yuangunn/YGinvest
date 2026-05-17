// Plan #40: 인생 단계 — 결혼/자녀/은퇴 API.
// POST { action: 'marry' | 'child' | 'retire' }

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  canMarry,
  canHaveChild,
  MARRIAGE_CASH_REQ,
  CHILD_CASH_REQ,
  RETIREMENT_FULLTIME_DAYS,
  PENSION_BASE,
  PENSION_PER_RANK_BONUS,
  FULLTIME_RANKS,
} from "@/lib/game/constants";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let body: { action?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const action = body.action;

  const { data: character } = await supabase
    .from("game_characters")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!character) return NextResponse.json({ error: "no_character" }, { status: 404 });

  const nowIso = new Date().toISOString();

  if (action === "marry") {
    if (!canMarry(character.intelligence, Number(character.cash), character.is_married)) {
      return NextResponse.json(
        {
          error: "cannot_marry",
          hint: "지력 300+ 그리고 자산 3,000만원+ 필요",
        },
        { status: 400 },
      );
    }
    await supabase
      .from("game_characters")
      .update({
        is_married: true,
        married_at: nowIso,
        cash: Number(character.cash) - MARRIAGE_CASH_REQ,
      })
      .eq("user_id", user.id);

    // 일기 마일스톤
    await supabase.from("game_diary").insert({
      user_id: user.id,
      game_day: character.current_day,
      real_date: nowIso,
      entry_type: "milestone",
      emoji: "💒",
      summary: "결혼! 새 인생의 동반자",
      cash_delta: -MARRIAGE_CASH_REQ,
      metadata: { milestone_type: "marriage" },
    });

    return NextResponse.json({ ok: true, action: "marry" });
  }

  if (action === "child") {
    const marriedDay = character.married_at
      ? Math.floor(
          (new Date(character.married_at).getTime() -
            new Date(character.life_started_at).getTime()) /
            (3_600_000 * 1), // HOURS_PER_GAME_DAY=1
        )
      : 0;
    if (
      !canHaveChild(
        character.intelligence,
        Number(character.cash),
        character.is_married,
        marriedDay,
        character.current_day,
        character.children_count,
      )
    ) {
      return NextResponse.json(
        {
          error: "cannot_have_child",
          hint: "결혼 60일 경과 + 지력 500+ + 자산 5,000만원+ + 자녀 3명 미만",
        },
        { status: 400 },
      );
    }
    await supabase
      .from("game_characters")
      .update({
        children_count: character.children_count + 1,
        cash: Number(character.cash) - CHILD_CASH_REQ,
      })
      .eq("user_id", user.id);

    await supabase.from("game_diary").insert({
      user_id: user.id,
      game_day: character.current_day,
      real_date: nowIso,
      entry_type: "milestone",
      emoji: "👶",
      summary: `${character.children_count + 1}번째 자녀 출생`,
      cash_delta: -CHILD_CASH_REQ,
      metadata: { milestone_type: "child" },
    });

    return NextResponse.json({ ok: true, action: "child" });
  }

  if (action === "retire") {
    // 정규직 누적 일수 확인
    const { data: pension } = await supabase
      .from("game_pension_info")
      .select("fulltime_total_days")
      .eq("user_id", user.id)
      .maybeSingle();
    const totalDays = pension?.fulltime_total_days ?? 0;
    if (totalDays < RETIREMENT_FULLTIME_DAYS) {
      return NextResponse.json(
        {
          error: "not_enough_career",
          hint: `정규직 누적 ${RETIREMENT_FULLTIME_DAYS}일 필요 (현재 ${totalDays}일)`,
          current_days: totalDays,
          required_days: RETIREMENT_FULLTIME_DAYS,
        },
        { status: 400 },
      );
    }

    // 직급 보너스
    const rankIdx = FULLTIME_RANKS.indexOf(
      character.job_title as typeof FULLTIME_RANKS[number],
    );
    const monthlyPension =
      PENSION_BASE + Math.max(0, rankIdx) * PENSION_PER_RANK_BONUS;

    await supabase
      .from("game_characters")
      .update({
        is_retired: true,
        retired_at: nowIso,
        job_type: "unemployed",
        job_title: null,
      })
      .eq("user_id", user.id);

    await supabase
      .from("game_pension_info")
      .upsert(
        {
          user_id: user.id,
          fulltime_total_days: totalDays,
          monthly_pension: monthlyPension,
          last_payout_day: character.current_day,
        },
        { onConflict: "user_id" },
      );

    await supabase.from("game_diary").insert({
      user_id: user.id,
      game_day: character.current_day,
      real_date: nowIso,
      entry_type: "milestone",
      emoji: "🌅",
      summary: `은퇴! 월 연금 ${Math.round(monthlyPension / 10000)}만원`,
      cash_delta: 0,
      metadata: { milestone_type: "retire", monthly_pension: monthlyPension },
    });

    return NextResponse.json({ ok: true, action: "retire", monthly_pension: monthlyPension });
  }

  return NextResponse.json({ error: "unknown_action" }, { status: 400 });
}
