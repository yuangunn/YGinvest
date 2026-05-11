import { redirect, notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LeaderboardTable } from "@/components/leaderboard-table";
import { InviteCodeDisplay } from "@/components/invite-code-display";

const KRW = new Intl.NumberFormat("ko-KR", {
  style: "currency",
  currency: "KRW",
  maximumFractionDigits: 0,
});

export default async function RoomDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const { data: room } = await supabase
    .from("rooms")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (!room) notFound();

  const { data: members } = await supabase
    .from("room_members")
    .select("user_id, portfolio_id, profiles(display_name)")
    .eq("room_id", id);

  // 리더보드 데이터: 멤버 portfolio별 최신 snapshot
  const portfolioIds = (members ?? []).map((m) => m.portfolio_id);
  const { data: snapshots } = portfolioIds.length
    ? await supabase
        .from("portfolio_snapshots")
        .select("portfolio_id, total_value_krw, return_pct, ts")
        .in("portfolio_id", portfolioIds)
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

  const entries = (members ?? [])
    .map((m) => {
      const profile = Array.isArray(m.profiles) ? m.profiles[0] : m.profiles;
      const snap = latest.get(m.portfolio_id);
      return {
        portfolio_id: m.portfolio_id,
        display_name: profile?.display_name ?? "익명",
        avatar_url: null,
        total_value_krw: snap?.total ?? null,
        return_pct: snap?.pct ?? null,
        snapshot_ts: snap?.ts ?? null,
      };
    })
    .sort(
      (a, b) => (b.return_pct ?? -Infinity) - (a.return_pct ?? -Infinity),
    );

  const myMember = (members ?? []).find((m) => m.user_id === user.id);
  const isHost = room.host_id === user.id;

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-4">
      <div>
        <h1 className="text-2xl font-bold">{room.name}</h1>
        <div className="text-xs text-muted-foreground mt-1">
          상태: {room.status} · 멤버 {(members ?? []).length}/{room.max_members}
          {room.ends_at
            ? ` · ~${new Date(room.ends_at).toLocaleDateString("ko-KR")}`
            : " · 무제한"}
        </div>
      </div>

      {(isHost || myMember) && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">초대 코드</CardTitle>
          </CardHeader>
          <CardContent>
            <InviteCodeDisplay code={room.invite_code} />
            <div className="text-xs text-muted-foreground mt-2">
              친구에게 이 코드를 공유하세요.{" "}
              {room.max_members - (members ?? []).length}자리 남음.
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">방 정보</CardTitle>
        </CardHeader>
        <CardContent className="text-sm space-y-1">
          <div>
            시작 자금: {KRW.format(Number(room.starting_krw))} + $
            {Number(room.starting_usd).toFixed(2)}
          </div>
          <div>
            시작일: {new Date(room.starts_at).toLocaleString("ko-KR")}
          </div>
          <div>
            종료일:{" "}
            {room.ends_at
              ? new Date(room.ends_at).toLocaleString("ko-KR")
              : "무제한"}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">리더보드</CardTitle>
        </CardHeader>
        <CardContent>
          <LeaderboardTable
            entries={entries}
            currentUserPortfolioId={myMember?.portfolio_id}
          />
        </CardContent>
      </Card>
    </div>
  );
}
