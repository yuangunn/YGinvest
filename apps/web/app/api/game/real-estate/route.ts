// Plan #33: 부동산 매매.
// POST: 매수 (region_code + with_jeonse 옵션)
// DELETE: 매도 (holding id)

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { computeRealEstatePrice } from "@/lib/game/tick";

export const dynamic = "force-dynamic";

async function fetchKospiDailyChange(
  supabase: Awaited<ReturnType<typeof createClient>>,
): Promise<number> {
  // KOSPI 200 ETF (KODEX 200, 069500.KS)의 최근 2일 close 비교
  const { data: bars } = await supabase
    .from("stock_bars")
    .select("ts, close")
    .eq("symbol", "069500.KS")
    .eq("interval", "1d")
    .order("ts", { ascending: false })
    .limit(2);
  if (!bars || bars.length < 2) return 0;
  return (Number(bars[0].close) - Number(bars[1].close)) / Number(bars[1].close);
}

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const [{ data: listings }, { data: holdings }, { data: character }] = await Promise.all([
    supabase.from("real_estate_listings").select("*").eq("is_active", true),
    supabase
      .from("game_real_estate_holdings")
      .select("*")
      .eq("user_id", user.id),
    supabase
      .from("game_characters")
      .select("current_day")
      .eq("user_id", user.id)
      .maybeSingle(),
  ]);

  const kospi = await fetchKospiDailyChange(supabase);
  const gameDay = character?.current_day ?? 0;

  const listingsWithPrice = (listings ?? []).map((l) => ({
    ...l,
    current_price: computeRealEstatePrice(
      Number(l.base_price),
      Number(l.weekly_index),
      kospi,
      Number(l.kospi_beta),
      Number(l.daily_volatility),
      gameDay,
      l.region_code,
    ),
  }));

  const holdingsWithPrice = (holdings ?? []).map((h) => {
    const listing = listingsWithPrice.find((l) => l.region_code === h.region_code);
    return {
      ...h,
      current_price: listing?.current_price ?? 0,
      region_name: listing?.region_name ?? h.region_code,
      profit:
        (listing?.current_price ?? 0) -
        Number(h.purchase_price),
    };
  });

  return NextResponse.json({
    listings: listingsWithPrice,
    holdings: holdingsWithPrice,
    kospi_daily_change: kospi,
  });
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let body: { region_code?: string; use_jeonse?: boolean };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const region = body.region_code;
  if (!region) return NextResponse.json({ error: "region_required" }, { status: 400 });

  const { data: listing } = await supabase
    .from("real_estate_listings")
    .select("*")
    .eq("region_code", region)
    .eq("is_active", true)
    .maybeSingle();
  if (!listing) return NextResponse.json({ error: "region_not_found" }, { status: 404 });

  const { data: character } = await supabase
    .from("game_characters")
    .select("cash, current_day")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!character) return NextResponse.json({ error: "no_character" }, { status: 404 });

  const kospi = await fetchKospiDailyChange(supabase);
  const currentPrice = computeRealEstatePrice(
    Number(listing.base_price),
    Number(listing.weekly_index),
    kospi,
    Number(listing.kospi_beta),
    Number(listing.daily_volatility),
    character.current_day,
    region,
  );
  const jeonseAmount = body.use_jeonse ? Math.floor(currentPrice * Number(listing.jeonse_ratio)) : 0;
  const myEquity = currentPrice - jeonseAmount;

  if (Number(character.cash) < myEquity) {
    return NextResponse.json(
      {
        error: "insufficient_cash",
        required: myEquity,
        available: character.cash,
        use_jeonse_hint: !body.use_jeonse
          ? "전세금 활용 (갭투자)로 자기자본 줄일 수 있어요"
          : null,
      },
      { status: 400 },
    );
  }

  const { error } = await supabase.from("game_real_estate_holdings").insert({
    user_id: user.id,
    region_code: region,
    purchase_price: currentPrice,
    jeonse_amount: jeonseAmount,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await supabase
    .from("game_characters")
    .update({ cash: Number(character.cash) - myEquity })
    .eq("user_id", user.id);

  return NextResponse.json({
    ok: true,
    region_code: region,
    region_name: listing.region_name,
    purchase_price: currentPrice,
    jeonse_amount: jeonseAmount,
    equity_invested: myEquity,
  });
}

export async function DELETE(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id_required" }, { status: 400 });

  const { data: holding } = await supabase
    .from("game_real_estate_holdings")
    .select("*")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!holding) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const { data: listing } = await supabase
    .from("real_estate_listings")
    .select("*")
    .eq("region_code", holding.region_code)
    .maybeSingle();
  if (!listing) return NextResponse.json({ error: "region_not_found" }, { status: 404 });

  const { data: character } = await supabase
    .from("game_characters")
    .select("cash, current_day")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!character) return NextResponse.json({ error: "no_character" }, { status: 404 });

  const kospi = await fetchKospiDailyChange(supabase);
  const currentPrice = computeRealEstatePrice(
    Number(listing.base_price),
    Number(listing.weekly_index),
    kospi,
    Number(listing.kospi_beta),
    Number(listing.daily_volatility),
    character.current_day,
    holding.region_code,
  );
  const proceeds = currentPrice - Number(holding.jeonse_amount);
  const profit = proceeds - (Number(holding.purchase_price) - Number(holding.jeonse_amount));

  await supabase
    .from("game_real_estate_holdings")
    .delete()
    .eq("id", id);

  await supabase
    .from("game_characters")
    .update({ cash: Number(character.cash) + proceeds })
    .eq("user_id", user.id);

  return NextResponse.json({
    ok: true,
    sale_price: currentPrice,
    proceeds,
    profit,
    profit_pct: profit / (Number(holding.purchase_price) - Number(holding.jeonse_amount)),
  });
}
