// Plan #46: 글로벌 리더보드 — MV 기반 (opt-in 사용자만).
//
// Query: ?category=overall|return_30d|sharpe&limit=100
// 응답: { leaderboard: [...], me: { rank, ... } | null }

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

type Category = "overall" | "return_30d" | "sharpe";
const VALID_CATEGORIES = new Set<Category>(["overall", "return_30d", "sharpe"]);

type RankingRow = {
  user_id: string;
  visibility: "public" | "anonymous";
  nickname: string | null;
  portfolio_id: string;
  return_overall_pct: number | null;
  return_30d_pct: number | null;
  sharpe_30d: number | null;
  trade_count: number;
  snapshot_ts: string;
  qualified: boolean;
  portfolio_age: string;
};

function sortColumn(category: Category): keyof RankingRow {
  if (category === "return_30d") return "return_30d_pct";
  if (category === "sharpe") return "sharpe_30d";
  return "return_overall_pct";
}

function displayName(
  row: Pick<RankingRow, "visibility" | "nickname">,
): string {
  if (row.visibility === "public" && row.nickname) return row.nickname;
  return "익명";
}

export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const categoryRaw = (searchParams.get("category") ?? "overall") as Category;
  const category: Category = VALID_CATEGORIES.has(categoryRaw)
    ? categoryRaw
    : "overall";
  const limit = Math.min(Number(searchParams.get("limit") ?? "100"), 200);

  // 카테고리별 정렬 컬럼
  const orderCol = sortColumn(category);

  // 자격: trade_count >= 5
  // return_30d / sharpe는 NULL 제외
  let query = supabase
    .from("leaderboard_rankings")
    .select(
      "user_id, visibility, nickname, portfolio_id, return_overall_pct, return_30d_pct, sharpe_30d, trade_count, snapshot_ts, qualified, portfolio_age",
    )
    .eq("qualified", true);

  if (category !== "overall") {
    query = query.not(orderCol, "is", null);
  }

  // 종합/꾸준함은 portfolio_age >= 30일 (sharpe 자체가 30일 기준이라 자동)
  if (category === "overall") {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString();
    query = query.lte("portfolio_age", thirtyDaysAgo);
  }

  const { data: rows, error } = await query
    .order(orderCol, { ascending: false, nullsFirst: false })
    .limit(limit);

  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });

  const list = (rows ?? []) as RankingRow[];

  // 본인 등수 계산 (TOP N에 없으면 별도 조회)
  let meRank: number | null = null;
  let meRow: RankingRow | null = null;

  const meInList = list.findIndex((r) => r.user_id === user.id);
  if (meInList >= 0) {
    meRank = meInList + 1;
    meRow = list[meInList];
  } else {
    // 본인이 opt-in 했는지 + 자격 있는지 확인 후 전체 등수 계산
    const { data: meRowsRaw } = await supabase
      .from("leaderboard_rankings")
      .select(
        "user_id, visibility, nickname, portfolio_id, return_overall_pct, return_30d_pct, sharpe_30d, trade_count, snapshot_ts, qualified, portfolio_age",
      )
      .eq("user_id", user.id)
      .maybeSingle();
    const meCandidate = meRowsRaw as RankingRow | null;
    if (meCandidate && meCandidate.qualified) {
      const myVal = meCandidate[orderCol] as number | null;
      if (myVal !== null) {
        const { count } = await supabase
          .from("leaderboard_rankings")
          .select("*", { count: "exact", head: true })
          .eq("qualified", true)
          .gt(orderCol, myVal);
        meRank = (count ?? 0) + 1;
        meRow = meCandidate;
      }
    }
  }

  return NextResponse.json({
    category,
    leaderboard: list.map((r, i) => ({
      rank: i + 1,
      user_id: r.user_id === user.id ? r.user_id : null, // 본인 식별용
      nickname: displayName(r),
      return_overall_pct: r.return_overall_pct,
      return_30d_pct: r.return_30d_pct,
      sharpe_30d: r.sharpe_30d,
      trade_count: r.trade_count,
      snapshot_ts: r.snapshot_ts,
      is_me: r.user_id === user.id,
    })),
    me: meRow
      ? {
          rank: meRank,
          nickname: displayName(meRow),
          return_overall_pct: meRow.return_overall_pct,
          return_30d_pct: meRow.return_30d_pct,
          sharpe_30d: meRow.sharpe_30d,
          trade_count: meRow.trade_count,
          qualified: meRow.qualified,
        }
      : null,
  });
}
