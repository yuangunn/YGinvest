import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const { portfolio_id, from_currency, to_currency, from_amount } = body;
  if (!portfolio_id || !from_currency || !to_currency || !from_amount) {
    return NextResponse.json({ error: "invalid_input" }, { status: 400 });
  }

  const { data, error } = await supabase.rpc("exchange_currency", {
    p_portfolio_id: portfolio_id,
    p_from_currency: from_currency,
    p_to_currency: to_currency,
    p_from_amount: from_amount,
  });
  if (error) {
    // 환율이 24시간 넘게 갱신되지 않으면 PG 함수가 fx_rate_stale 로 거부한다 (워커 중단 등).
    if (error.message.includes("fx_rate_stale")) {
      return NextResponse.json(
        { error: "환율 정보가 오래되어 지금은 환전할 수 없어요. 잠시 후 다시 시도해 주세요." },
        { status: 503 },
      );
    }
    return NextResponse.json({ error: error.message }, { status: 422 });
  }
  return NextResponse.json(data);
}
