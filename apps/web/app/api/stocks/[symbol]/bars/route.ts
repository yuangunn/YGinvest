import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ symbol: string }> }
) {
  const { symbol } = await params;
  const { searchParams } = new URL(request.url);
  const interval = searchParams.get("interval") ?? "1d";
  const limit = Number(searchParams.get("limit") ?? "365");

  if (!["15m", "1h", "1d"].includes(interval)) {
    return NextResponse.json({ error: "invalid_interval" }, { status: 400 });
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("stock_bars")
    .select("ts, open, high, low, close, volume")
    .eq("symbol", decodeURIComponent(symbol))
    .eq("interval", interval)
    .order("ts", { ascending: true })
    .limit(limit);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ symbol, interval, bars: data ?? [] });
}
