// Plan #40: 일일 미션 — 오늘의 3개 미션 + 진행률.

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { pickDailyMissions, todayDateKey, MISSION_POOL } from "@/lib/game/missions";

export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const dateKey = todayDateKey();
  const todayMissions = pickDailyMissions(dateKey);

  // 기존 진행 행 fetch
  const { data: existing } = await supabase
    .from("game_daily_missions")
    .select("mission_key, progress, target, completed, reward_points")
    .eq("user_id", user.id)
    .eq("date_key", dateKey);

  const existingMap = new Map(
    (existing ?? []).map((e) => [e.mission_key, e]),
  );

  // 없는 미션은 새로 insert
  const toInsert = todayMissions
    .filter((m) => !existingMap.has(m.key))
    .map((m) => ({
      user_id: user.id,
      mission_key: m.key,
      date_key: dateKey,
      progress: 0,
      target: m.target,
      completed: false,
      reward_points: m.reward,
    }));

  if (toInsert.length > 0) {
    await supabase.from("game_daily_missions").insert(toInsert);
  }

  // 오늘 진행률 자동 계산 (game_diary 기반)
  const now = new Date();
  const kst = new Date(now.getTime() + 9 * 3600_000);
  const todayStart = new Date(Date.UTC(kst.getUTCFullYear(), kst.getUTCMonth(), kst.getUTCDate()) - 9 * 3600_000);

  const { data: todayEntries } = await supabase
    .from("game_diary")
    .select("entry_type, cash_delta, metadata")
    .eq("user_id", user.id)
    .gte("real_date", todayStart.toISOString());

  const stats = {
    trade_buy: 0,
    trade_sell: 0,
    sell_profit: 0,
    intelligence_gain: 0,
    cash_earned: 0,
    events_seen: 0,
    diary_check: 1, // 지금 호출했으니 1
  };

  for (const e of todayEntries ?? []) {
    const meta = (e.metadata ?? {}) as Record<string, unknown>;
    if (e.entry_type === "trade") {
      const side = meta.side as string | undefined;
      const profitPct = meta.profit_pct as number | undefined;
      if (side === "buy") stats.trade_buy++;
      if (side === "sell") {
        stats.trade_sell++;
        if ((profitPct ?? 0) > 0) stats.sell_profit++;
      }
    }
    if (e.entry_type === "event") stats.events_seen++;
    if (e.entry_type === "activity") {
      const intelDelta = meta.intelligence_delta as number | undefined;
      if (intelDelta) stats.intelligence_gain += intelDelta;
    }
    if (Number(e.cash_delta) > 0) stats.cash_earned += Number(e.cash_delta);
  }

  // 미션별 progress 업데이트
  const result = [];
  for (const m of todayMissions) {
    const def = MISSION_POOL.find((p) => p.key === m.key)!;
    const newProgress = Math.min(stats[def.checkType] ?? 0, def.target);
    const wasCompleted = existingMap.get(m.key)?.completed ?? false;
    const nowCompleted = newProgress >= def.target;

    if (!wasCompleted && nowCompleted) {
      // 완료! 보상 지급
      await supabase
        .from("game_daily_missions")
        .update({
          progress: newProgress,
          completed: true,
          completed_at: new Date().toISOString(),
        })
        .eq("user_id", user.id)
        .eq("mission_key", m.key)
        .eq("date_key", dateKey);

      const { data: prof } = await supabase
        .from("profiles")
        .select("game_points")
        .eq("id", user.id)
        .maybeSingle();
      await supabase
        .from("profiles")
        .update({ game_points: (prof?.game_points ?? 0) + def.reward })
        .eq("id", user.id);
    } else if (newProgress !== (existingMap.get(m.key)?.progress ?? 0)) {
      await supabase
        .from("game_daily_missions")
        .update({ progress: newProgress })
        .eq("user_id", user.id)
        .eq("mission_key", m.key)
        .eq("date_key", dateKey);
    }

    result.push({
      ...m,
      progress: newProgress,
      completed: nowCompleted,
      reward_claimed: !wasCompleted && nowCompleted,
    });
  }

  return NextResponse.json({ date_key: dateKey, missions: result });
}
