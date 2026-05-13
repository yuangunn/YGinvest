import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * POST /api/themes/favorite { theme_id }   → add
 * DELETE /api/themes/favorite { theme_id } → remove
 */
async function authed() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { supabase, user };
}

export async function POST(request: Request) {
  const { supabase, user } = await authed();
  if (!user) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }
  const body = (await request.json().catch(() => ({}))) as {
    theme_id?: string;
  };
  if (!body.theme_id) {
    return NextResponse.json({ error: "theme_id_required" }, { status: 400 });
  }
  const { error } = await supabase
    .from("theme_favorites")
    .insert({ user_id: user.id, theme_id: body.theme_id });
  if (error && !error.message.includes("duplicate")) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request) {
  const { supabase, user } = await authed();
  if (!user) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }
  const body = (await request.json().catch(() => ({}))) as {
    theme_id?: string;
  };
  if (!body.theme_id) {
    return NextResponse.json({ error: "theme_id_required" }, { status: 400 });
  }
  const { error } = await supabase
    .from("theme_favorites")
    .delete()
    .eq("user_id", user.id)
    .eq("theme_id", body.theme_id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
