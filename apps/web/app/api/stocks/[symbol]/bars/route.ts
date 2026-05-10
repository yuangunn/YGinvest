import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { fetchBarsViaWorker } from "@/lib/workerRpc";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ symbol: string }> }
) {
  const { symbol } = await params;
  const decodedSymbol = decodeURIComponent(symbol);
  const { searchParams } = new URL(request.url);
  const interval = searchParams.get("interval") ?? "1d";
  const limit = Number(searchParams.get("limit") ?? "365");

  if (!["15m", "1h", "1d"].includes(interval)) {
    return NextResponse.json({ error: "invalid_interval" }, { status: 400 });
  }

  // 1d는 DB 캐시에서, 인트라데이는 워커 RPC로 on-demand
  if (interval === "1d") {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("stock_bars")
      .select("ts, open, high, low, close, volume")
      .eq("symbol", decodedSymbol)
      .eq("interval", "1d")
      .order("ts", { ascending: true })
      .limit(limit);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ symbol: decodedSymbol, interval, bars: data ?? [] });
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
