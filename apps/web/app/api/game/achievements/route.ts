// Plan #40: 업적 조회 + 자동 체크 + 신규 unlock 기록.

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { ACHIEVEMENTS, checkAchievements } from "@/lib/game/achievements";

export const dynamic = "force-dynamic";

const FX_USD_KRW = 1300;

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  // 1. 현재 character + 자산 + 게임 데이터 수집
  const [
    { data: character },
    { data: profile },
    { data: trades },
    { data: holdings },
    { data: realEstate },
    { data: events },
    { data: alreadyUnlocked },
  ] = await Promise.all([
    supabase.from("game_characters").select("*").eq("user_id", user.id).maybeSingle(),
    supabase
      .from("profiles")
      .select("game_rebirth_count")
      .eq("id", user.id)
      .maybeSingle(),
    // 매수/매도 history (game_diary)
    supabase
      .from("game_diary")
      .select("metadata, entry_type")
      .eq("user_id", user.id)
      .eq("entry_type", "trade"),
    supabase.from("game_holdings").select("symbol").eq("user_id", user.id),
    supabase
      .from("game_real_estate_holdings")
      .select("id")
      .eq("user_id", user.id),
    supabase
      .from("game_diary")
      .select("metadata")
      .eq("user_id", user.id)
      .eq("entry_type", "event"),
    supabase
      .from("game_achievements")
      .select("achievement_key")
      .eq("user_id", user.id),
  ]);

  if (!character) return NextResponse.json({ error: "no_character" }, { status: 404 });

  // 자산 계산
  let stocksValue = 0;
  const heldSymbols = (holdings ?? []).map((h) => h.symbol);
  if (heldSymbols.length > 0) {
    const { data: stocks } = await supabase
      .from("stocks")
      .select("symbol, last_price, currency")
      .in("symbol", heldSymbols);
    const stockMap = new Map((stocks ?? []).map((s) => [s.symbol, s]));
    const { data: gh } = await supabase
      .from("game_holdings")
      .select("symbol, quantity")
      .eq("user_id", user.id);
    for (const h of gh ?? []) {
      const s = stockMap.get(h.symbol);
      if (!s?.last_price) continue;
      const p =
        s.currency === "KRW"
          ? Number(s.last_price)
          : Number(s.last_price) * FX_USD_KRW;
      stocksValue += p * Number(h.quantity);
    }
  }

  // 부동산 평가 (단순화)
  let realEstateValue = 0;
  if ((realEstate ?? []).length > 0) {
    const { data: holdingsFull } = await supabase
      .from("game_real_estate_holdings")
      .select("region_code, jeonse_amount")
      .eq("user_id", user.id);
    for (const re of holdingsFull ?? []) {
      const { data: listing } = await supabase
        .from("real_estate_listings")
        .select("base_price, weekly_index")
        .eq("region_code", re.region_code)
        .maybeSingle();
      if (!listing) continue;
      const current = Number(listing.base_price) * Number(listing.weekly_index);
      realEstateValue += current - Number(re.jeonse_amount);
    }
  }

  const totalAssets = Number(character.cash) + stocksValue + realEstateValue;

  // 트레이딩 분석
  let highestSellPct = 0;
  let hasBought = false;
  let hasSoldProfit = false;
  for (const t of trades ?? []) {
    const meta = t.metadata as { side?: string; profit_pct?: number } | null;
    if (!meta) continue;
    if (meta.side === "buy") hasBought = true;
    if (meta.side === "sell") {
      const pct = meta.profit_pct ?? 0;
      if (pct > 0) hasSoldProfit = true;
      if (pct > highestSellPct) highestSellPct = pct;
    }
  }

  // 이벤트 분석
  let lotteryWon = false;
  let crisisSurvived = false;
  for (const e of events ?? []) {
    const meta = e.metadata as { event_key?: string } | null;
    if (meta?.event_key === "lottery_small") lotteryWon = true;
    if (meta?.event_key === "economic_crisis") crisisSurvived = true;
  }

  const ctx = {
    intelligence: character.intelligence,
    job_type: character.job_type,
    job_title: character.job_title,
    total_assets: totalAssets,
    rebirth_count: profile?.game_rebirth_count ?? 0,
    days_played: character.current_day,
    is_married: character.is_married ?? false,
    children_count: character.children_count ?? 0,
    is_retired: character.is_retired ?? false,
    highest_sell_pct: highestSellPct,
    has_bought: hasBought,
    has_sold_profit: hasSoldProfit,
    has_real_estate: (realEstate ?? []).length > 0,
    lottery_won: lotteryWon,
    survived_crisis: crisisSurvived && (profile?.game_rebirth_count ?? 0) > 0,
  };

  const unlockable = checkAchievements(ctx);
  const alreadyKeys = new Set(
    (alreadyUnlocked ?? []).map((a) => a.achievement_key),
  );
  const newlyUnlocked = unlockable.filter((k) => !alreadyKeys.has(k));

  // 신규 unlock → 기록 + 포인트 적립
  let totalReward = 0;
  if (newlyUnlocked.length > 0) {
    const rows = newlyUnlocked.map((k) => ({
      user_id: user.id,
      achievement_key: k,
    }));
    await supabase.from("game_achievements").insert(rows);

    // 포인트 적립
    for (const k of newlyUnlocked) {
      const def = ACHIEVEMENTS.find((a) => a.key === k);
      if (def) totalReward += def.reward;
    }
    if (totalReward > 0) {
      const { data: prof } = await supabase
        .from("profiles")
        .select("game_points")
        .eq("id", user.id)
        .maybeSingle();
      await supabase
        .from("profiles")
        .update({ game_points: (prof?.game_points ?? 0) + totalReward })
        .eq("id", user.id);
    }
  }

  // 응답: 전체 업적 + 본인 unlock 여부 + 신규 unlock
  const allUnlockedSet = new Set([
    ...alreadyKeys,
    ...newlyUnlocked,
  ]);

  return NextResponse.json({
    achievements: ACHIEVEMENTS.map((a) => ({
      ...a,
      unlocked: allUnlockedSet.has(a.key),
      newly_unlocked: newlyUnlocked.includes(a.key),
    })),
    newly_unlocked_count: newlyUnlocked.length,
    total_reward: totalReward,
  });
}
