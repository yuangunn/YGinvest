// Plan #33: 환생 — 5% 수익 조건 체크 + 포인트 부여 + 캐릭터 리셋.

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  REBIRTH_THRESHOLD_PCT,
  calculateRebirthPoints,
} from "@/lib/game/constants";

export const dynamic = "force-dynamic";

const FX_USD_KRW = 1300;

export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { data: character } = await supabase
    .from("game_characters")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!character) return NextResponse.json({ error: "no_character" }, { status: 404 });

  // 게임 자산 합산: cash + 주식 평가액 + 부동산 평가액
  const { data: holdings } = await supabase
    .from("game_holdings")
    .select("symbol, quantity, avg_cost")
    .eq("user_id", user.id);

  let stocksValue = 0;
  for (const h of holdings ?? []) {
    const { data: stock } = await supabase
      .from("stocks")
      .select("last_price, currency")
      .eq("symbol", h.symbol)
      .maybeSingle();
    if (!stock?.last_price) continue;
    const priceKrw =
      stock.currency === "KRW"
        ? Number(stock.last_price)
        : Number(stock.last_price) * FX_USD_KRW;
    stocksValue += priceKrw * Number(h.quantity);
  }

  const { data: realEstates } = await supabase
    .from("game_real_estate_holdings")
    .select("region_code, purchase_price, jeonse_amount")
    .eq("user_id", user.id);

  // 부동산은 단순화 — 현재 base_price × weekly_index로 평가
  let realEstateValue = 0;
  for (const re of realEstates ?? []) {
    const { data: listing } = await supabase
      .from("real_estate_listings")
      .select("base_price, weekly_index")
      .eq("region_code", re.region_code)
      .maybeSingle();
    if (!listing) continue;
    const currentPrice = Number(listing.base_price) * Number(listing.weekly_index);
    // 갭투자 시 자기자본 평가 = 현재가 - 전세금
    const equity = currentPrice - Number(re.jeonse_amount);
    realEstateValue += equity;
  }

  const totalAssets = Number(character.cash) + stocksValue + realEstateValue;
  const startingCash = Number(character.starting_cash);
  const returnPct = (totalAssets - startingCash) / startingCash;

  // 환생 임계점 (점진적 난이도 — 환생 횟수마다 ↑)
  const { data: profile } = await supabase
    .from("profiles")
    .select("game_rebirth_count, game_points")
    .eq("id", user.id)
    .maybeSingle();
  const rebirthCount = profile?.game_rebirth_count ?? 0;
  // 일단 항상 5%. 너무 쉽다 싶으면 + rebirthCount * 0.025
  const threshold = REBIRTH_THRESHOLD_PCT;

  if (returnPct < threshold) {
    return NextResponse.json({
      error: "below_threshold",
      current_return_pct: returnPct,
      required_pct: threshold,
      total_assets: totalAssets,
      starting_cash: startingCash,
      shortage: startingCash * (1 + threshold) - totalAssets,
    }, { status: 400 });
  }

  // 환생!
  const daysPlayed = character.current_day;
  const pointsEarned = calculateRebirthPoints(returnPct, daysPlayed);
  const newRebirthCount = rebirthCount + 1;

  // 1. 환생 기록 저장
  await supabase.from("game_rebirths").insert({
    user_id: user.id,
    rebirth_number: newRebirthCount,
    starting_cash: startingCash,
    ending_cash: Number(character.cash),
    total_assets: totalAssets,
    return_pct: returnPct,
    days_played: daysPlayed,
    points_earned: pointsEarned,
  });

  // 2. profile 갱신 (포인트 + 환생 횟수)
  await supabase
    .from("profiles")
    .update({
      game_points: (profile?.game_points ?? 0) + pointsEarned,
      game_rebirth_count: newRebirthCount,
    })
    .eq("id", user.id);

  // 3. 기존 캐릭터 / 보유 / 부동산 / schedule 삭제 → 새 라이프 시작 가능
  await Promise.all([
    supabase.from("game_holdings").delete().eq("user_id", user.id),
    supabase.from("game_real_estate_holdings").delete().eq("user_id", user.id),
    supabase.from("game_schedule").delete().eq("user_id", user.id),
    supabase.from("game_characters").delete().eq("user_id", user.id),
  ]);

  return NextResponse.json({
    ok: true,
    rebirth_number: newRebirthCount,
    points_earned: pointsEarned,
    total_points: (profile?.game_points ?? 0) + pointsEarned,
    final_assets: totalAssets,
    return_pct: returnPct,
    days_played: daysPlayed,
    next_step: "/app/roguelike (onboarding으로 자동 이동)",
  });
}
