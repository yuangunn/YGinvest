// Plan #33: 게임 메인 진입점 — character 없으면 onboarding, 있으면 dashboard.

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { GameOnboarding } from "@/components/game/onboarding";
import { GameDashboard } from "@/components/game/dashboard";

export const dynamic = "force-dynamic";

export default async function RoguelikePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const [
    { data: character },
    { data: profile },
    { data: unlocks },
  ] = await Promise.all([
    supabase.from("game_characters").select("*").eq("user_id", user.id).maybeSingle(),
    supabase
      .from("profiles")
      .select("game_points, game_rebirth_count, display_name")
      .eq("id", user.id)
      .maybeSingle(),
    supabase
      .from("game_unlocks")
      .select("unlock_key, level")
      .eq("user_id", user.id),
  ]);

  const unlockMap: Record<string, number> = {};
  for (const u of unlocks ?? []) unlockMap[u.unlock_key] = u.level;

  if (!character) {
    return (
      <GameOnboarding
        userName={profile?.display_name ?? "투자자"}
        points={profile?.game_points ?? 0}
        rebirthCount={profile?.game_rebirth_count ?? 0}
        bachelorUnlocked={!!unlockMap["bachelor_unlock"]}
      />
    );
  }

  return (
    <GameDashboard
      initialCharacter={character}
      points={profile?.game_points ?? 0}
      rebirthCount={profile?.game_rebirth_count ?? 0}
      unlocks={unlockMap}
    />
  );
}
