// Plan #36: 게임 모드 변경 — learning / income / balanced.

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const VALID_MODES = ["learning", "income", "balanced"];

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let body: { mode?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const mode = body.mode;
  if (!mode || !VALID_MODES.includes(mode)) {
    return NextResponse.json({ error: "invalid_mode" }, { status: 400 });
  }

  const { error } = await supabase
    .from("game_characters")
    .update({ play_mode: mode })
    .eq("user_id", user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, mode });
}
