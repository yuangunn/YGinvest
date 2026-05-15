// Plan #27 B4: 클라이언트 에러 자체 로깅 endpoint.
// 짧은 message + stack을 client_errors 테이블에 insert.
// 클라이언트 측에서 자체 rate-limiting (1분 1건).

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const MAX_MSG = 2000;
const MAX_STACK = 4000;

export async function POST(request: Request) {
  let body: { message?: string; stack?: string; pathname?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const message = String(body.message ?? "").slice(0, MAX_MSG);
  const stack = body.stack ? String(body.stack).slice(0, MAX_STACK) : null;
  const pathname = body.pathname ? String(body.pathname).slice(0, 500) : null;

  if (!message) {
    return NextResponse.json({ error: "empty_message" }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const ua = request.headers.get("user-agent")?.slice(0, 500) ?? null;

  await supabase.from("client_errors").insert({
    user_id: user?.id ?? null,
    pathname,
    message,
    stack,
    user_agent: ua,
  });

  return NextResponse.json({ ok: true });
}
