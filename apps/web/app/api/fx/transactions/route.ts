import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const portfolio_id = searchParams.get("portfolio_id");
  let q = supabase.from("fx_transactions").select("*").order("executed_at", { ascending: false }).limit(50);
  if (portfolio_id) q = q.eq("portfolio_id", portfolio_id);

  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ transactions: data });
}
