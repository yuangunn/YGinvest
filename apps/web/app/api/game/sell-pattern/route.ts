// Plan #40: 매도 패턴 분석 — 본 앱 trades 테이블에서 사용자의 매도 시점 통계.
//
// 인사이트:
//   - 평균 매도 수익률
//   - 매수 후 평균 보유 일수
//   - "팔지 않은 종목"의 현재 수익률 (홀딩 vs 매도 비교)

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getSelectedPortfolioId } from "@/lib/portfolio-context";

export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const portfolioId = await getSelectedPortfolioId(supabase, user.id);
  if (!portfolioId) {
    return NextResponse.json({ insights: [] });
  }

  // 본 앱의 trades fetch (있는지 모름 — 일단 확인)
  // 본 앱 trades 테이블 구조: portfolio_id, symbol, side, quantity, price, executed_at
  const { data: trades } = await supabase
    .from("trades")
    .select("symbol, side, quantity, price, executed_at")
    .eq("portfolio_id", portfolioId)
    .order("executed_at", { ascending: true });

  if (!trades || trades.length === 0) {
    return NextResponse.json({
      insights: ["아직 본 앱 거래 내역이 없어요. 첫 매수를 해보세요!"],
      stats: null,
    });
  }

  // 매수/매도 페어링: 같은 심볼에서 매수 → 매도 pair 찾기
  // 간단화: 매도 1건마다 그 이전 매수의 평균 매수가와 비교
  const symbolBuys = new Map<string, { qty: number; cost: number; firstBuyAt: string }[]>();
  const sellAnalytics: Array<{
    symbol: string;
    sellPct: number;
    daysHeld: number;
    sellPrice: number;
  }> = [];

  for (const t of trades) {
    const sym = t.symbol;
    const price = Number(t.price);
    const qty = Number(t.quantity);

    if (t.side === "buy") {
      const arr = symbolBuys.get(sym) ?? [];
      arr.push({ qty, cost: price * qty, firstBuyAt: t.executed_at });
      symbolBuys.set(sym, arr);
    } else if (t.side === "sell") {
      // 매도 → FIFO로 매수 차감
      let remainingQty = qty;
      const buys = symbolBuys.get(sym) ?? [];
      let totalCost = 0;
      let totalQty = 0;
      let earliestBuyAt: string | null = null;
      while (remainingQty > 0 && buys.length > 0) {
        const buy = buys[0];
        if (!earliestBuyAt) earliestBuyAt = buy.firstBuyAt;
        if (buy.qty <= remainingQty) {
          totalCost += buy.cost;
          totalQty += buy.qty;
          remainingQty -= buy.qty;
          buys.shift();
        } else {
          const partial = remainingQty / buy.qty;
          totalCost += buy.cost * partial;
          totalQty += remainingQty;
          buy.qty -= remainingQty;
          buy.cost -= buy.cost * partial;
          remainingQty = 0;
        }
      }
      symbolBuys.set(sym, buys);

      if (totalQty > 0 && earliestBuyAt) {
        const avgBuyPrice = totalCost / totalQty;
        const sellPct = (price - avgBuyPrice) / avgBuyPrice;
        const daysHeld = Math.floor(
          (new Date(t.executed_at).getTime() - new Date(earliestBuyAt).getTime()) /
            86_400_000,
        );
        sellAnalytics.push({
          symbol: sym,
          sellPct,
          daysHeld,
          sellPrice: price,
        });
      }
    }
  }

  if (sellAnalytics.length === 0) {
    return NextResponse.json({
      insights: [
        "🎯 본 앱에서 아직 매도를 안 했어요.",
        "장기 투자만으론 실력 안 늘어요. 적절한 매도 타이밍 찾기가 핵심!",
      ],
      stats: { total_buys: trades.filter((t) => t.side === "buy").length, total_sells: 0 },
    });
  }

  // 통계 계산
  const total = sellAnalytics.length;
  const avgSellPct =
    sellAnalytics.reduce((s, a) => s + a.sellPct, 0) / total;
  const avgDaysHeld =
    sellAnalytics.reduce((s, a) => s + a.daysHeld, 0) / total;
  const profitableSells = sellAnalytics.filter((a) => a.sellPct > 0).length;
  const winRate = profitableSells / total;
  const maxSellPct = sellAnalytics.reduce((m, a) => Math.max(m, a.sellPct), 0);
  const minSellPct = sellAnalytics.reduce((m, a) => Math.min(m, a.sellPct), 0);

  // 인사이트 문구 생성
  const insights: string[] = [];
  insights.push(
    `📊 총 ${total}번 매도. 평균 ${(avgSellPct * 100).toFixed(2)}% 수익 (승률 ${(winRate * 100).toFixed(0)}%).`,
  );
  insights.push(
    `⏱️ 평균 ${Math.round(avgDaysHeld)}일 보유 후 매도.`,
  );
  if (avgSellPct < 0.03 && total >= 3) {
    insights.push(
      "💡 평균 수익률이 3% 미만이에요. 너무 빨리 파는 경향. 5%까지 기다려보세요.",
    );
  } else if (avgSellPct > 0.1) {
    insights.push("🎉 평균 수익률 10% 이상! 매도 타이밍 매우 우수.");
  } else if (avgSellPct >= 0.05) {
    insights.push("✅ 적절한 매도 타이밍을 잡고 있어요.");
  }
  if (winRate < 0.5 && total >= 5) {
    insights.push(
      "⚠️ 승률 50% 미만 — 손절 룰 점검 필요. 매수 전 시나리오를 미리 정해보세요.",
    );
  }
  insights.push(`🚀 최고 매도 수익: +${(maxSellPct * 100).toFixed(2)}%`);
  if (minSellPct < 0) {
    insights.push(`📉 최악 매도 손실: ${(minSellPct * 100).toFixed(2)}%`);
  }

  return NextResponse.json({
    insights,
    stats: {
      total_sells: total,
      avg_sell_pct: avgSellPct,
      avg_days_held: avgDaysHeld,
      win_rate: winRate,
      max_sell_pct: maxSellPct,
      min_sell_pct: minSellPct,
      total_buys: trades.filter((t) => t.side === "buy").length,
    },
  });
}
