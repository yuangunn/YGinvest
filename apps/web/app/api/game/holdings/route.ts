// Plan #33: 게임 내 주식 보유 조회 (현재 시세 포함).

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { data: holdings } = await supabase
    .from("game_holdings")
    .select("symbol, quantity, avg_cost")
    .eq("user_id", user.id);

  if (!holdings || holdings.length === 0) {
    return NextResponse.json({ holdings: [] });
  }

  const symbols = holdings.map((h) => h.symbol);
  const { data: stocks } = await supabase
    .from("stocks")
    .select("symbol, name, name_ko, currency, last_price")
    .in("symbol", symbols);

  const stockMap = new Map((stocks ?? []).map((s) => [s.symbol, s]));

  return NextResponse.json({
    holdings: holdings.map((h) => {
      const s = stockMap.get(h.symbol);
      return {
        ...h,
        name: s?.name ?? h.symbol,
        name_ko: s?.name_ko ?? null,
        currency: s?.currency ?? "KRW",
        current_price: s?.last_price ?? null,
      };
    }),
  });
}
