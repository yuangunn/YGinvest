import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  if (!body.invite_code) {
    return NextResponse.json({ error: "missing_invite_code" }, { status: 400 });
  }

  const { data, error } = await supabase.rpc("join_room", {
    p_invite_code: body.invite_code,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 422 });
  return NextResponse.json(data);
}
