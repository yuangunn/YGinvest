// Plan #47.4: 시황 아카이브 — 최근 brief 목록 (slot 포함).
//
// Query: ?limit=30 (기본 30, max 100)
// 응답: { briefings: [{ date, slot, headline, keyword_count, generated_at }] }

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type Keyword = {
  keyword: string;
  category: string;
};

function firstLine(summary: string): string {
  return (summary.split("\n").map((l) => l.trim()).filter(Boolean)[0] ?? "");
}

export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const limit = Math.min(Number(searchParams.get("limit") ?? "30"), 100);

  const { data, error } = await supabase
    .from("market_briefing")
    .select("date, slot, summary, keywords, generated_at")
    .order("date", { ascending: false })
    .order("slot", { ascending: false })
    .limit(limit);

  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });

  const briefings = (data ?? []).map((b) => ({
    date: b.date as string,
    slot: b.slot as "morning" | "noon",
    headline: firstLine((b.summary as string) ?? ""),
    keywords: ((b.keywords ?? []) as Keyword[])
      .slice(0, 5)
      .map((k) => ({ keyword: k.keyword, category: k.category })),
    generated_at: b.generated_at as string,
  }));

  return NextResponse.json({ briefings });
}
