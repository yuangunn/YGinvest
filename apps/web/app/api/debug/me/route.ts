// Plan #29.1: 디버그 endpoint — 현재 로그인 사용자 정보 + admin 상태 확인.
// admin 뱃지 안 보이는 문제 진단용.

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json(
      { error: "not_authenticated", authError: authError?.message },
      { status: 401 },
    );
  }

  // profile 행 조회 (user context로)
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id, display_name, is_admin")
    .eq("id", user.id)
    .maybeSingle();

  return NextResponse.json({
    user: {
      id: user.id,
      email: user.email,
    },
    profile,
    profileError: profileError?.message ?? null,
    isAdmin: !!profile?.is_admin,
    deployedAt: new Date().toISOString(),
  });
}
