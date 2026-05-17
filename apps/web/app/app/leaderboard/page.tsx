// Plan #46: 글로벌 리더보드 — opt-in 사용자 + 3 카테고리 + 매일 04:00 KST 갱신.

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/yg/page-header";
import { GlobalLeaderboardClient } from "@/components/leaderboard/global-leaderboard-client";

export default async function GlobalLeaderboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  return (
    <div style={{ paddingBottom: 24 }}>
      <PageHeader
        title="글로벌 리더보드"
        sub="opt-in 참여 · 종합 / 이번 달 / 꾸준함"
      />
      <GlobalLeaderboardClient />
    </div>
  );
}
