import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = (searchParams.get("q") ?? "").trim();
  if (q.length === 0) {
    return NextResponse.json({ results: [] });
  }

  const supabase = await createClient();

  // symbol exact + prefix + 이름 trigram. 한 번의 OR로 처리.
  const escaped = q.replace(/[%_]/g, (c) => "\\" + c);
  const { data, error } = await supabase
    .from("stocks")
    .select("symbol, name, name_ko, market, currency, last_price, last_price_at")
    .or(
      [
        `symbol.ilike.${escaped}%`,
        `name.ilike.%${escaped}%`,
        `name_ko.ilike.%${escaped}%`,
      ].join(",")
    )
    .eq("is_active", true)
    .order("market_cap", { ascending: false, nullsFirst: false })
    .limit(20);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ results: data ?? [] });
}
