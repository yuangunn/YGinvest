// Plan #33: 게임 내 주식 매수/매도.
//
// 본 앱 stocks 테이블의 시세를 그대로 차용. 잔고는 game_characters.cash와
// game_holdings로 별도 관리 (사행성 회피).

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let body: { symbol?: string; side?: string; quantity?: number };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const symbol = body.symbol?.trim();
  const side = body.side;
  const qty = Number(body.quantity);

  if (!symbol) return NextResponse.json({ error: "symbol_required" }, { status: 400 });
  if (side !== "buy" && side !== "sell") {
    return NextResponse.json({ error: "invalid_side" }, { status: 400 });
  }
  if (!Number.isFinite(qty) || qty <= 0) {
    return NextResponse.json({ error: "invalid_quantity" }, { status: 400 });
  }

  // 본 앱 시세 가져오기
  const { data: stock } = await supabase
    .from("stocks")
    .select("symbol, last_price, currency, name, name_ko")
    .eq("symbol", symbol)
    .maybeSingle();
  if (!stock || !stock.last_price) {
    return NextResponse.json({ error: "stock_not_found_or_no_price" }, { status: 404 });
  }

  // 게임 내에서는 KRW만 사용 (USD 종목은 환율 1300원 가정 — 단순화)
  const FX_USD_KRW = 1300;
  const priceKrw =
    stock.currency === "KRW" ? Number(stock.last_price) : Number(stock.last_price) * FX_USD_KRW;
  const totalCost = priceKrw * qty;

  // 캐릭터 + 보유 fetch
  const { data: character } = await supabase
    .from("game_characters")
    .select("cash")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!character) return NextResponse.json({ error: "no_character" }, { status: 404 });

  const { data: existing } = await supabase
    .from("game_holdings")
    .select("quantity, avg_cost")
    .eq("user_id", user.id)
    .eq("symbol", symbol)
    .maybeSingle();

  if (side === "buy") {
    if (Number(character.cash) < totalCost) {
      return NextResponse.json(
        { error: "insufficient_cash", required: totalCost, available: character.cash },
        { status: 400 },
      );
    }

    // avg_cost 갱신 (이미 있으면 가중평균)
    let newQty = qty;
    let newAvg = priceKrw;
    if (existing) {
      const oldQty = Number(existing.quantity);
      const oldAvg = Number(existing.avg_cost);
      newQty = oldQty + qty;
      newAvg = (oldQty * oldAvg + qty * priceKrw) / newQty;
    }

    await supabase
      .from("game_holdings")
      .upsert(
        {
          user_id: user.id,
          symbol,
          quantity: newQty,
          avg_cost: newAvg,
        },
        { onConflict: "user_id,symbol" },
      );

    await supabase
      .from("game_characters")
      .update({ cash: Number(character.cash) - totalCost })
      .eq("user_id", user.id);

    return NextResponse.json({
      ok: true,
      side: "buy",
      symbol,
      quantity: qty,
      price_krw: priceKrw,
      total: totalCost,
      new_avg_cost: newAvg,
    });
  }

  // sell
  if (!existing || Number(existing.quantity) < qty) {
    return NextResponse.json(
      { error: "insufficient_quantity", held: existing?.quantity ?? 0 },
      { status: 400 },
    );
  }

  const newQty = Number(existing.quantity) - qty;
  if (newQty === 0) {
    await supabase
      .from("game_holdings")
      .delete()
      .eq("user_id", user.id)
      .eq("symbol", symbol);
  } else {
    await supabase
      .from("game_holdings")
      .update({ quantity: newQty })
      .eq("user_id", user.id)
      .eq("symbol", symbol);
  }

  await supabase
    .from("game_characters")
    .update({ cash: Number(character.cash) + totalCost })
    .eq("user_id", user.id);

  const profit = (priceKrw - Number(existing.avg_cost)) * qty;
  return NextResponse.json({
    ok: true,
    side: "sell",
    symbol,
    quantity: qty,
    price_krw: priceKrw,
    total: totalCost,
    profit,
    profit_pct: (priceKrw - Number(existing.avg_cost)) / Number(existing.avg_cost),
  });
}
