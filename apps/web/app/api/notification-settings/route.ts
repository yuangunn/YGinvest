import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const VALID_KEYS = new Set([
  "order_filled",
  "order_expiring_soon",
  "room_starting",
  "room_ending",
  "dividend_received",
  "corporate_action_applied",
]);

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  const { data } = await supabase
    .from("notification_settings")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();
  return NextResponse.json({ settings: data });
}

export async function PATCH(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const patch: Record<string, boolean> = {};
  for (const [k, v] of Object.entries(body)) {
    if (VALID_KEYS.has(k) && typeof v === "boolean") patch[k] = v;
  }
  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "no_valid_keys" }, { status: 400 });
  }

  const { error } = await supabase
    .from("notification_settings")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("user_id", user.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
