// Plan #47: 오늘의 시황 브리핑 조회.
// 가장 최근 row 1개 반환 (오늘 없으면 어제 fallback).

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

  const { data, error } = await supabase
    .from("market_briefing")
    .select(
      "date, summary, keywords, macro_snapshot, source_count, generated_at",
    )
    .order("date", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data)
    return NextResponse.json({ briefing: null });

  return NextResponse.json({
    briefing: {
      date: data.date as string,
      summary: data.summary as string,
      keywords: (data.keywords ?? []) as KeywordGroup[],
      macro_snapshot: (data.macro_snapshot ?? {}) as MacroSnap,
      source_count: data.source_count as number,
      generated_at: data.generated_at as string,
    },
  });
}
