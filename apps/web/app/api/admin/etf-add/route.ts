// Plan #32: Yahoo 검색 결과의 ETF를 stocks 테이블에 추가.
//
// admin만 실행 가능. POST body: { symbol: string }
// 처리 흐름:
//  1. 이미 있는지 확인
//  2. Yahoo quote endpoint로 메타 fetch (currency, exchange, price 등)
//  3. stocks upsert with instrument_type='etf'
// enrich_etfs job이 다음 새벽에 운용보수/AUM 등 추가 fetch.

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getIsAdmin } from "@/lib/auth-admin";

export const dynamic = "force-dynamic";

type YahooQuoteResult = {
  symbol: string;
  shortName?: string;
  longName?: string;
  currency?: string;
  fullExchangeName?: string;
  exchange?: string;
  regularMarketPrice?: number;
  quoteType?: string;
};

type YahooQuoteResponse = {
  quoteResponse?: {
    result?: YahooQuoteResult[];
    error?: { code: string; description: string } | null;
  };
};

// Yahoo exchange code → 우리 market enum
const EXCHANGE_MAP: Record<string, string> = {
  NMS: "NASDAQ",
  NGM: "NASDAQ",
  NCM: "NASDAQ",
  NYQ: "NYSE",
  PCX: "NYSE",        // NYSE Arca
  ASE: "NYSE",        // NYSE American
  BATS: "NYSE",
  KSC: "KRX_KS",
  KOE: "KRX_KQ",
  KQE: "KRX_KQ",
};

export async function POST(request: Request) {
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

  let body: { symbol?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const symbol = body.symbol?.trim();
  if (!symbol) {
    return NextResponse.json({ error: "symbol_required" }, { status: 400 });
  }

  // 이미 있는지 확인
  const { data: existing } = await supabase
    .from("stocks")
    .select("symbol, instrument_type")
    .eq("symbol", symbol)
    .maybeSingle();

  if (existing && existing.instrument_type === "etf") {
    return NextResponse.json({ ok: true, already_added: true, symbol });
  }

  // Yahoo에서 메타 fetch
  const url = `https://query2.finance.yahoo.com/v7/finance/quote?symbols=${encodeURIComponent(symbol)}`;
  let yahooData: YahooQuoteResponse;
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; YGinvest/1.0; +https://yginvest.vercel.app)",
        Accept: "application/json",
      },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) {
      return NextResponse.json(
        { error: "yahoo_quote_failed", status: res.status },
        { status: 502 },
      );
    }
    yahooData = (await res.json()) as YahooQuoteResponse;
  } catch (err) {
    return NextResponse.json(
      {
        error: "yahoo_fetch_error",
        message: err instanceof Error ? err.message : String(err),
      },
      { status: 502 },
    );
  }

  const result = yahooData.quoteResponse?.result?.[0];
  if (!result) {
    return NextResponse.json(
      { error: "symbol_not_found_at_yahoo", symbol },
      { status: 404 },
    );
  }

  if (result.quoteType !== "ETF") {
    return NextResponse.json(
      {
        error: "not_an_etf",
        symbol,
        quote_type: result.quoteType,
        hint: "이 심볼은 ETF가 아닙니다. 일반 주식이면 다른 경로로 추가하세요.",
      },
      { status: 400 },
    );
  }

  const market =
    (result.exchange && EXCHANGE_MAP[result.exchange]) ||
    (symbol.endsWith(".KS") ? "KRX_KS" : symbol.endsWith(".KQ") ? "KRX_KQ" : "NASDAQ");
  const currency = result.currency ?? (market.startsWith("KRX_") ? "KRW" : "USD");

  const now = new Date().toISOString();
  const record = {
    symbol,
    market,
    currency,
    name: result.longName ?? result.shortName ?? symbol,
    name_ko: market.startsWith("KRX_") ? (result.longName ?? result.shortName ?? null) : null,
    instrument_type: "etf",
    last_price: result.regularMarketPrice ?? null,
    last_price_at: result.regularMarketPrice ? now : null,
    is_active: true,
    updated_at: now,
  };

  const { error } = await supabase
    .from("stocks")
    .upsert(record, { onConflict: "symbol" });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    symbol,
    market,
    currency,
    name: record.name,
    note: "운용보수/AUM/holdings는 다음 새벽 enrich_etfs job에서 자동 채워집니다.",
  });
}
