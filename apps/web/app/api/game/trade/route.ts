// Plan #33: 게임 내 주식 매수/매도.
//
// 본 앱 stocks 테이블의 시세를 그대로 차용. 잔고는 game_characters.cash와
// game_holdings로 별도 관리 (사행성 회피).

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { GAME_FX_USD_KRW } from "@/lib/fx";

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

  // 게임 내에서는 KRW만 사용 (USD 종목은 고정 환율 가정 — 단순화)
  const priceKrw =
    stock.currency === "KRW" ? Number(stock.last_price) : Number(stock.last_price) * GAME_FX_USD_KRW;
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

    // Plan #37: 매수 일기 로그
    const symbolName = stock.name_ko ?? stock.name ?? symbol;
    await supabase.from("game_diary").insert({
      user_id: user.id,
      game_day: 0, // 게임 day 계산 X — current_day는 client에서 알 수 없음
      real_date: new Date().toISOString(),
      entry_type: "trade",
      emoji: "🛒",
      summary: `${symbolName} ${qty}주 매수 (${Math.round(priceKrw).toLocaleString()}원/주)`,
      cash_delta: -totalCost,
      metadata: { symbol, side: "buy", quantity: qty, price: priceKrw },
    });

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

  const profit = (priceKrw - Number(existing.avg_cost)) * qty;
  const profitPct = (priceKrw - Number(existing.avg_cost)) / Number(existing.avg_cost);

  // Plan #43: invested_pnl 누적 — 매도 차익만 (알바 수익 제외)
  // 환생 조건이 이 컬럼 기준이라 게임 본질(매도 타이밍 학습)에 충실.
  const { data: charBefore } = await supabase
    .from("game_characters")
    .select("invested_pnl")
    .eq("user_id", user.id)
    .maybeSingle();
  const prevPnl = Number(charBefore?.invested_pnl ?? 0);

  await supabase
    .from("game_characters")
    .update({
      cash: Number(character.cash) + totalCost,
      invested_pnl: prevPnl + profit,
    })
    .eq("user_id", user.id);

  // Plan #37: 매도 일기 로그 (수익률 강조)
  const symbolName = stock.name_ko ?? stock.name ?? symbol;
  const pctText = `${profitPct >= 0 ? "+" : ""}${(profitPct * 100).toFixed(2)}%`;
  await supabase.from("game_diary").insert({
    user_id: user.id,
    game_day: 0,
    real_date: new Date().toISOString(),
    entry_type: "trade",
    emoji: profit >= 0 ? "💰" : "📉",
    summary: `${symbolName} ${qty}주 매도 ${pctText} (${profit >= 0 ? "+" : ""}${Math.round(profit / 10000)}만원)`,
    cash_delta: totalCost,
    metadata: {
      symbol,
      side: "sell",
      quantity: qty,
      price: priceKrw,
      profit,
      profit_pct: profitPct,
    },
  });

  return NextResponse.json({
    ok: true,
    side: "sell",
    symbol,
    quantity: qty,
    price_krw: priceKrw,
    total: totalCost,
    profit,
    profit_pct: profitPct,
  });
}
