import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { PORTFOLIO_COOKIE_NAME } from "@/lib/portfolio-context";

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const portfolioId = body.portfolio_id;
  if (!portfolioId) {
    return NextResponse.json({ error: "missing_portfolio_id" }, { status: 400 });
  }

  // 검증: 사용자 본인의 포트폴리오인지
  const { data } = await supabase
    .from("portfolios")
    .select("id")
    .eq("id", portfolioId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!data) {
    return NextResponse.json({ error: "portfolio_not_found" }, { status: 404 });
  }

  const res = NextResponse.json({ ok: true, portfolio_id: portfolioId });
  res.cookies.set(PORTFOLIO_COOKIE_NAME, portfolioId, {
    path: "/",
    httpOnly: false, // 서버 SSR에서만 읽지만, 클라가 알아도 위험 X (검증은 서버에서)
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 365,
  });
  return res;
}
