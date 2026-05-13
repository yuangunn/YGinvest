import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

type Body = {
  category: string;
  market_scope?: string;
  symbol: string;
  rank?: number;
  portfolio_id?: string;
};

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as Partial<Body>;
  const { category, market_scope, symbol, rank, portfolio_id } = body;
  if (!category || !symbol) {
    return NextResponse.json({ error: "invalid_input" }, { status: 400 });
  }

  const { error } = await supabase.from("recommendation_clicks").insert({
    user_id: user.id,
    portfolio_id: portfolio_id ?? null,
    category,
    market_scope: market_scope ?? null,
    symbol,
    rank: rank ?? null,
  });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true }, { status: 201 });
}
