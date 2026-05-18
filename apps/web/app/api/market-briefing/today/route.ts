// Plan #47.4: 가장 최근 brief (slot 무관) 1개.
// 평일 06:30(morning) + 12:30(noon) 둘 중 최신.

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type KeywordGroup = {
  keyword: string;
  category: string;
  headline_count: number;
  articles: Array<{
    title: string;
    url: string;
    source: string;
    published_at: string | null;
  }>;
};

type MacroSnap = Record<
  string,
  { value: number; change_pct: number; ts: string }
>;

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  // date desc, slot desc → 같은 날짜에서 noon 우선 (알파벳: noon > morning)
  const { data, error } = await supabase
    .from("market_briefing")
    .select(
      "date, slot, summary, keywords, macro_snapshot, source_count, generated_at",
    )
    .order("date", { ascending: false })
    .order("slot", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ briefing: null });

  return NextResponse.json({
    briefing: {
      date: data.date as string,
      slot: data.slot as "morning" | "noon",
      summary: data.summary as string,
      keywords: (data.keywords ?? []) as KeywordGroup[],
      macro_snapshot: (data.macro_snapshot ?? {}) as MacroSnap,
      source_count: data.source_count as number,
      generated_at: data.generated_at as string,
    },
  });
}
