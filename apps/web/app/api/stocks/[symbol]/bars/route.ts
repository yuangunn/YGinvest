import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { fetchBarsViaWorker } from "@/lib/workerRpc";
import { aggregateBars, type AggInterval } from "@/lib/aggregate-bars";

const VALID = new Set(["15m", "1h", "1d", "1wk", "1mo"]);
// 일봉은 영구 보존이라 상한 없이 받으면 수천 행이 될 수 있다.
const MAX_DAILY_LIMIT = 2000;
const DEFAULT_DAILY_LIMIT = 365;

export async function GET(
  request: Request,
  { params }: { params: Promise<{ symbol: string }> },
) {
  const { symbol } = await params;
  const decodedSymbol = decodeURIComponent(symbol);
  const { searchParams } = new URL(request.url);
  const interval = searchParams.get("interval") ?? "1d";
  const limitRaw = Number(searchParams.get("limit") ?? DEFAULT_DAILY_LIMIT);
  const limit = Number.isFinite(limitRaw) && limitRaw > 0
    ? Math.min(Math.floor(limitRaw), MAX_DAILY_LIMIT)
    : DEFAULT_DAILY_LIMIT;

  if (!VALID.has(interval)) {
    return NextResponse.json({ error: "invalid_interval" }, { status: 400 });
  }

  // 1d / 1wk / 1mo: DB의 일봉을 사용 (1d 직접 / 나머지는 집계)
  if (interval === "1d" || interval === "1wk" || interval === "1mo") {
    const supabase = await createClient();
    // 일봉은 limit 그대로, 주/월/연봉은 충분한 일봉을 가져온 뒤 집계
    const fetchLimit = interval === "1d" ? limit : Math.max(limit, DEFAULT_DAILY_LIMIT);
    // 최신 N봉: 내림차순으로 자른 뒤 오름차순으로 뒤집는다.
    // (오름차순 + limit 은 "가장 오래된 N봉"이라 최신 봉이 차트에서 사라졌다)
    const { data, error } = await supabase
      .from("stock_bars")
      .select("ts, open, high, low, close, volume")
      .eq("symbol", decodedSymbol)
      .eq("interval", "1d")
      .order("ts", { ascending: false })
      .limit(fetchLimit);
    if (error)
      return NextResponse.json({ error: error.message }, { status: 500 });
    const daily = (data ?? []).reverse();
    if (interval === "1d") {
      return NextResponse.json({
        symbol: decodedSymbol,
        interval,
        bars: daily,
      });
    }
    const bars = aggregateBars(daily, interval as AggInterval);
    return NextResponse.json({ symbol: decodedSymbol, interval, bars });
  }

  // 15m / 1h: 워커 RPC
  try {
    const period = interval === "15m" ? "60d" : "2y";
    const bars = await fetchBarsViaWorker(decodedSymbol, interval, period);
    return NextResponse.json({ symbol: decodedSymbol, interval, bars });
  } catch {
    return NextResponse.json({ error: "worker_unreachable" }, { status: 503 });
  }
}
