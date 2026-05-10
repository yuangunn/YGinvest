import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const portfolio_id = searchParams.get("portfolio_id");

  let q = supabase
    .from("watchlists")
    .select("symbol, added_at, stocks(name, name_ko, currency, market, last_price)")
    .order("added_at", { ascending: false });
  if (portfolio_id) q = q.eq("portfolio_id", portfolio_id);

  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ items: data });
}
