import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { callAI, type Provider } from "@/lib/ai-providers";

export const maxDuration = 60;

type Body = {
  symbol: string;
  provider?: Provider; // 사용자가 어떤 provider 사용할지 선택 (없으면 첫 등록 사용)
};

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }
  const body = (await request.json().catch(() => ({}))) as Partial<Body>;
  if (!body.symbol) {
    return NextResponse.json({ error: "symbol_required" }, { status: 400 });
  }

  // 1) Fetch user's AI keys
  const { data: keys } = await supabase
    .from("user_ai_keys")
    .select("provider, model, api_key")
    .eq("user_id", user.id);
  if (!keys || keys.length === 0) {
    return NextResponse.json(
      { error: "no_api_key", message: "설정 > AI 키 등록 필요" },
      { status: 400 },
    );
  }
  const selected = body.provider
    ? keys.find((k) => k.provider === body.provider)
    : keys[0];
  if (!selected) {
    return NextResponse.json(
      { error: "provider_not_configured" },
      { status: 400 },
    );
  }

  // 2) Fetch stock context
  const { data: stock } = await supabase
    .from("stocks")
    .select(
      "symbol, name, name_ko, market, currency, sector, last_price, per, market_cap, fifty_two_week_high, fifty_two_week_low",
    )
    .eq("symbol", body.symbol)
    .maybeSingle();
  if (!stock) {
    return NextResponse.json({ error: "stock_not_found" }, { status: 404 });
  }

  // 최근 60일봉 (모멘텀 컨텍스트)
  const { data: bars } = await supabase
    .from("stock_bars")
    .select("ts, close, volume")
    .eq("symbol", body.symbol)
    .eq("interval", "1d")
    .order("ts", { ascending: false })
    .limit(60);

  const recentBars = (bars ?? []).reverse();
  let priceChange = "";
  if (recentBars.length >= 2) {
    const first = recentBars[0].close;
    const last = recentBars[recentBars.length - 1].close;
    const pct = ((last - first) / first) * 100;
    priceChange = `최근 ${recentBars.length}거래일: ${pct >= 0 ? "+" : ""}${pct.toFixed(1)}%`;
  }

  // 같은 sector의 동종 종목 5개 (peer context)
  let peers = "";
  if (stock.sector) {
    const marketFilter = stock.market.startsWith("KRX_")
      ? ["KRX_KS", "KRX_KQ"]
      : ["NYSE", "NASDAQ"];
    const { data: peerData } = await supabase
      .from("stocks")
      .select("symbol, name, name_ko, per, market_cap")
      .eq("sector", stock.sector)
      .in("market", marketFilter)
      .neq("symbol", stock.symbol)
      .order("market_cap", { ascending: false, nullsFirst: false })
      .limit(5);
    if (peerData) {
      peers = peerData
        .map(
          (p) =>
            `${p.name_ko ?? p.name} (${p.symbol}, PER ${p.per ?? "—"})`,
        )
        .join(", ");
    }
  }

  // 3) Build prompt
  const stockName = stock.name_ko ?? stock.name;
  const systemPrompt = `당신은 한국 시장에 정통한 시뮬레이션 트레이딩 분석가입니다.
주어진 종목 데이터를 바탕으로 한국어로 200-400자 이내 간결하게 분석하세요.
포함할 요소:
1. 종목의 핵심 비즈니스 요약 (1문장)
2. 현재 valuation 평가 (PER + 섹터 비교)
3. 52주 위치 + 모멘텀 해석
4. 단기 view (Buy/Hold/Sell + 근거 1-2 문장)
5. 주의해야 할 리스크 (1문장)

마지막 줄에 ⚠️ 시뮬레이션 분석이며 실제 투자 자문이 아닙니다.`;

  const userPrompt = `종목: ${stockName} (${stock.symbol})
시장: ${stock.market}
통화: ${stock.currency}
섹터: ${stock.sector ?? "미상"}
현재가: ${stock.last_price ?? "—"}
PER: ${stock.per ?? "—"}
시가총액: ${stock.market_cap ?? "—"}
52주 최고: ${stock.fifty_two_week_high ?? "—"} / 최저: ${stock.fifty_two_week_low ?? "—"}
${priceChange ? `\n${priceChange}` : ""}
${peers ? `\n동종 종목: ${peers}` : ""}

이 종목에 대해 분석해 주세요.`;

  // 4) Call AI
  try {
    const result = await callAI(
      selected.provider as Provider,
      selected.api_key,
      selected.model,
      systemPrompt,
      userPrompt,
    );
    return NextResponse.json({
      ok: true,
      provider: selected.provider,
      model: result.model,
      text: result.text,
      tokens: result.tokens,
    });
  } catch (err) {
    return NextResponse.json(
      {
        error: "ai_call_failed",
        message: err instanceof Error ? err.message : "unknown",
      },
      { status: 502 },
    );
  }
}
