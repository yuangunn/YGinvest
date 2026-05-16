// Plan #32: Yahoo Finance 검색 → ETF 후보 반환.
//
// Yahoo의 공개 search endpoint를 프록시. 클라이언트 직접 호출은 CORS로 막힘.
// 결과에서 quoteType='ETF'만 필터링.

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getIsAdmin } from "@/lib/auth-admin";

export const dynamic = "force-dynamic";

type YahooSearchQuote = {
  symbol: string;
  shortname?: string;
  longname?: string;
  quoteType: string;        // 'ETF', 'EQUITY', 'INDEX', ...
  exchange?: string;        // 'NMS', 'NYQ', 'KSC', ...
  exchDisp?: string;        // 'NasdaqGS', 'KSE', ...
  typeDisp?: string;        // 'ETF', 'Equity'
};

type YahooSearchResponse = {
  quotes?: YahooSearchQuote[];
};

export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!(await getIsAdmin(supabase, user.id))) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q")?.trim();
  if (!q) {
    return NextResponse.json({ error: "q_required" }, { status: 400 });
  }
  if (q.length < 2) {
    return NextResponse.json({ quotes: [] });
  }

  const url = `https://query2.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(q)}&quotesCount=15&newsCount=0`;

  let data: YahooSearchResponse;
  try {
    const res = await fetch(url, {
      headers: {
        // Yahoo는 가끔 default fetch UA에 429 — 표준 브라우저 UA로 우회
        "User-Agent":
          "Mozilla/5.0 (compatible; YGinvest/1.0; +https://yginvest.vercel.app)",
        Accept: "application/json",
      },
      // 클라우드 환경에서 외부 API 호출 — 짧은 timeout
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) {
      return NextResponse.json(
        { error: "yahoo_search_failed", status: res.status },
        { status: 502 },
      );
    }
    data = (await res.json()) as YahooSearchResponse;
  } catch (err) {
    return NextResponse.json(
      {
        error: "yahoo_fetch_error",
        message: err instanceof Error ? err.message : String(err),
      },
      { status: 502 },
    );
  }

  // ETF만 필터링
  const etfs = (data.quotes ?? []).filter(
    (q) => q.quoteType === "ETF" || q.typeDisp === "ETF",
  );

  // 이미 DB에 있는 심볼 체크 (UI에서 "이미 추가됨" 표시용)
  const symbols = etfs.map((e) => e.symbol);
  const existingRows = symbols.length
    ? await supabase
        .from("stocks")
        .select("symbol, instrument_type")
        .in("symbol", symbols)
    : { data: [] };
  const existingMap = new Map<string, string>(
    (existingRows.data ?? []).map((r) => [r.symbol, r.instrument_type]),
  );

  return NextResponse.json({
    quotes: etfs.map((e) => ({
      symbol: e.symbol,
      name: e.longname ?? e.shortname ?? e.symbol,
      exchange: e.exchDisp ?? e.exchange ?? null,
      already_added: existingMap.has(e.symbol),
      instrument_type: existingMap.get(e.symbol) ?? null,
    })),
  });
}
