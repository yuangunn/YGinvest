import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { fetchBarsViaWorker } from "@/lib/workerRpc";
import { aggregateBars, type AggInterval } from "@/lib/aggregate-bars";

const VALID = new Set(["15m", "1h", "1d", "1wk", "1mo"]);

export async function GET(
  request: Request,
  { params }: { params: Promise<{ symbol: string }> },
) {
  const { symbol } = await params;
  const decodedSymbol = decodeURIComponent(symbol);
  const { searchParams } = new URL(request.url);
  const interval = searchParams.get("interval") ?? "1d";
  const limit = Number(searchParams.get("limit") ?? "365");

  if (!VALID.has(interval)) {
    return NextResponse.json({ error: "invalid_interval" }, { status: 400 });
  }

  // 1d / 1wk / 1mo: DB의 일봉을 사용 (1d 직접 / 나머지는 집계)
  if (interval === "1d" || interval === "1wk" || interval === "1mo") {
    const supabase = await createClient();
    // 일봉은 limit 그대로, 주/월/연봉은 충분한 일봉을 가져온 뒤 집계
    const fetchLimit = interval === "1d" ? limit : Math.max(limit, 365);
    const { data, error } = await supabase
      .from("stock_bars")
      .select("ts, open, high, low, close, volume")
      .eq("symbol", decodedSymbol)
      .eq("interval", "1d")
      .order("ts", { ascending: true })
      .limit(fetchLimit);
    if (error)
      return NextResponse.json({ error: error.message }, { status: 500 });
    const daily = data ?? [];
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
