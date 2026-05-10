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
  if (error) return NextResponse.json({ error: error.message }, { status: 422 });
  return NextResponse.json(data);
}
