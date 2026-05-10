import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isMarketOpenForSymbol, type MarketEnum } from "@/lib/market-hours";

type OrderBody = {
  portfolio_id: string;
  symbol: string;
  side: "buy" | "sell";
  type: "market" | "limit";
  quantity: number;
  limit_price?: number;
};

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  const body = (await request.json().catch(() => ({}))) as Partial<OrderBody>;
  const { portfolio_id, symbol, side, type, quantity, limit_price } = body;
  if (!portfolio_id || !symbol || !side || !type || !quantity) {
    return NextResponse.json({ error: "invalid_input" }, { status: 400 });
  }
  if (type === "limit" && (limit_price == null || limit_price <= 0)) {
    return NextResponse.json({ error: "limit_price_required" }, { status: 400 });
  }

  // 시장가는 장중에만
  if (type === "market") {
    const { data: stock } = await supabase
      .from("stocks")
      .select("market")
      .eq("symbol", symbol)
      .single();
    if (!stock) return NextResponse.json({ error: "stock_not_found" }, { status: 404 });
    if (!isMarketOpenForSymbol(stock.market as MarketEnum)) {
      return NextResponse.json({ error: "market_closed" }, { status: 422 });
    }
  }

  const fnName = type === "market" ? "place_market_order" : "place_limit_order";
  const params: Record<string, unknown> = {
    p_portfolio_id: portfolio_id,
    p_symbol: symbol,
    p_side: side,
    p_quantity: quantity,
  };
  if (type === "limit") params.p_limit_price = limit_price;

  const { data, error } = await supabase.rpc(fnName, params);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: mapErrorStatus(error.message) });
  }
  return NextResponse.json(data);
}

export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const portfolio_id = searchParams.get("portfolio_id");
  const status = searchParams.get("status");

  let query = supabase.from("orders").select("*").order("created_at", { ascending: false }).limit(100);
  if (portfolio_id) query = query.eq("portfolio_id", portfolio_id);
  if (status) query = query.eq("status", status);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ orders: data });
}

function mapErrorStatus(msg: string): number {
  if (msg.includes("unauthorized") || msg.includes("unauthenticated")) return 401;
  if (msg.includes("not_found")) return 404;
  // spec §10.1: 503으로 매핑하여 사용자에게 "재시도" 토스트 안내
  if (msg.includes("price_stale")) return 503;
  if (
    msg.includes("insufficient") ||
    msg.includes("invalid_") ||
    msg.includes("market_closed")
  )
    return 422;
  return 500;
}
