// Plan #45: 글로벌 리더보드 — YG 디자인.

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/yg/page-header";
import { LeaderboardTable } from "@/components/leaderboard-table";

export default async function GlobalLeaderboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

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

  const myPortfolio = (portfolios ?? []).find((p) => p.user_id === user.id);
  const myEntry = myPortfolio
    ? entries.find((e) => e.portfolio_id === myPortfolio.id)
    : null;

  return (
    <div style={{ paddingBottom: 24 }}>
      <PageHeader
        title="글로벌 리더보드"
        sub={`상위 ${entries.length}명 · 누적 수익률`}
      />

      <div style={{ padding: "8px 20px 0" }}>
        <div className="yg-card" style={{ padding: 18 }}>
          {entries.length === 0 ? (
            <div
              style={{
                fontSize: 13,
                color: "var(--yg-fg-tertiary)",
                fontWeight: 600,
                textAlign: "center",
                padding: 20,
              }}
            >
              아직 랭킹 데이터가 없어요
            </div>
          ) : (
            <LeaderboardTable
              entries={entries}
              currentUserPortfolioId={myEntry?.portfolio_id}
            />
          )}
        </div>
      </div>
    </div>
  );
}
