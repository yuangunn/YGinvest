import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LeaderboardTable } from "@/components/leaderboard-table";

export default async function GlobalLeaderboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  // RLS: portfolios "본인 읽기" + "같은 방 멤버 읽기"가 적용됨.
  // 따라서 본 페이지에서 보이는 portfolios는 본인 글로벌 + 본인이 속한 방의 멤버 글로벌(room_id IS NULL이지만 같은 사용자가 아닐 수 있음 — 룸 가입자라 보이는 row)
  // v1 한계: 진정한 글로벌 랭킹은 v1.5 material view에서 service_role API로 제공.
  const { data: portfolios } = await supabase
    .from("portfolios")
    .select("id, user_id, profiles(display_name)")
    .is("room_id", null)
    .eq("status", "active");

  const ids = (portfolios ?? []).map((p) => p.id);
  const { data: snapshots } = ids.length
    ? await supabase
        .from("portfolio_snapshots")
        .select("portfolio_id, total_value_krw, return_pct, ts")
        .in("portfolio_id", ids)
        .order("ts", { ascending: false })
    : { data: [] };

  const latest = new Map<string, { total: number; pct: number; ts: string }>();
  for (const s of snapshots ?? []) {
    if (!latest.has(s.portfolio_id)) {
      latest.set(s.portfolio_id, {
        total: Number(s.total_value_krw),
        pct: Number(s.return_pct),
        ts: s.ts,
      });
    }
  }

  const entries = (portfolios ?? [])
    .map((p) => {
      const profile = Array.isArray(p.profiles) ? p.profiles[0] : p.profiles;
      const snap = latest.get(p.id);
      return {
        portfolio_id: p.id,
        display_name: profile?.display_name ?? "익명",
        avatar_url: null,
        total_value_krw: snap?.total ?? null,
        return_pct: snap?.pct ?? null,
        snapshot_ts: snap?.ts ?? null,
      };
    })
    .filter((e) => e.return_pct !== null)
    .sort(
      (a, b) => (b.return_pct ?? -Infinity) - (a.return_pct ?? -Infinity),
    )
    .slice(0, 100);

  // 내 portfolio 찾기 (entries에 있을 수도/없을 수도)
  const myPortfolio = (portfolios ?? []).find((p) => p.user_id === user.id);
  const myEntry = myPortfolio
    ? entries.find((e) => e.portfolio_id === myPortfolio.id)
    : null;

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-4">
      <h1 className="text-2xl font-bold">글로벌 리더보드</h1>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            상위 100명 (누적 수익률)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <LeaderboardTable
            entries={entries}
            currentUserPortfolioId={myEntry?.portfolio_id}
          />
        </CardContent>
      </Card>
    </div>
  );
}
