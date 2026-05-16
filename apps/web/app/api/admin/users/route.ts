// Plan #29: Admin only — 사용자의 is_admin 토글.
// RLS: profiles_admin_update 정책으로 admin만 update 가능 (서버에서도 한번 더 체크).

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getIsAdmin } from "@/lib/auth-admin";

export async function PATCH(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const isAdmin = await getIsAdmin(supabase, user.id);
  if (!isAdmin) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const targetId = searchParams.get("id");
  if (!targetId) {
    return NextResponse.json({ error: "id_required" }, { status: 400 });
  }

  let body: { is_admin?: boolean };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  if (typeof body.is_admin !== "boolean") {
    return NextResponse.json(
      { error: "is_admin_required_boolean" },
      { status: 400 },
    );
  }

  const { error } = await supabase
    .from("profiles")
    .update({ is_admin: body.is_admin })
    .eq("id", targetId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
