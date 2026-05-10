import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

async function getGlobalPortfolioId(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string
) {
  const { data } = await supabase
    .from("portfolios")
    .select("id")
    .eq("user_id", userId)
    .is("room_id", null)
    .single();
  return data?.id ?? null;
}

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ symbol: string }> }
) {
  const { symbol } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  const portfolioId = await getGlobalPortfolioId(supabase, user.id);
  if (!portfolioId) return NextResponse.json({ error: "no_portfolio" }, { status: 404 });

  const { error } = await supabase
    .from("watchlists")
    .insert({ portfolio_id: portfolioId, symbol: decodeURIComponent(symbol) });

  if (error) {
    // 23505: unique violation — already in watchlist, treat as success
    if (error.code === "23505") {
      return NextResponse.json({ ok: true, already: true });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ symbol: string }> }
) {
  const { symbol } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  const portfolioId = await getGlobalPortfolioId(supabase, user.id);
  if (!portfolioId) return NextResponse.json({ error: "no_portfolio" }, { status: 404 });

  const { error } = await supabase
    .from("watchlists")
    .delete()
    .eq("portfolio_id", portfolioId)
    .eq("symbol", decodeURIComponent(symbol));

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
