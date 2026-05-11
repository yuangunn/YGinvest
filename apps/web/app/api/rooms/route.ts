import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const params = {
    p_name: body.name,
    p_starting_krw: body.starting_krw,
    p_starting_usd: body.starting_usd,
    p_starts_at: body.starts_at,
    p_ends_at: body.ends_at ?? null,
    p_max_members: body.max_members ?? 10,
    p_late_join_until: body.late_join_until ?? null,
  };
  const { data, error } = await supabase.rpc("create_room", params);
  if (error) return NextResponse.json({ error: error.message }, { status: 422 });
  return NextResponse.json(data);
}

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  // 내가 호스트이거나 멤버인 방 — RLS가 알아서 필터링
  const { data, error } = await supabase
    .from("rooms")
    .select(
      "id, name, host_id, invite_code, starting_krw, starting_usd, starts_at, ends_at, max_members, status, created_at",
    )
    .order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ rooms: data });
}
