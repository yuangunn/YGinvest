import { redirect } from "next/navigation";
import { GitCompare } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/supabase/user";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getSelectedPortfolioId } from "@/lib/portfolio-context";
import { fetchUsdKrwRate, toKrw } from "@/lib/fx";

type Trade = {
  symbol: string;
  side: string;
  quantity: number;
  price: number;
  currency: string;
  created_at: string;
};

type StockMeta = {
  symbol: string;
  last_price: number | null;
  currency: string;
};

// 단순 가정: KOSPI 연평균 7%, S&P 500 연평균 10%
// (실제로는 stock_bars의 ^KS11/^GSPC 데이터를 fetch해야 정확)
function annualizedReturn(market: "KR" | "US"): number {
  return market === "KR" ? 0.07 : 0.10;
}

export default async function WhatIfPage() {
  const supabase = await createClient();
  const user = await getCurrentUser();
  if (!user) redirect("/auth/login");

  const portfolioId = await getSelectedPortfolioId(supabase, user.id);
  if (!portfolioId) redirect("/app/portfolio/overview");

  const { data: tradesRaw } = await supabase
    .from("trades")
    .select("symbol, side, quantity, price, currency, created_at")
    .eq("portfolio_id", portfolioId)
    .order("created_at", { ascending: true });

  const trades = (tradesRaw as Trade[] | null) ?? [];

  if (trades.length === 0) {
    return (
      <div className="max-w-3xl mx-auto p-4 space-y-4">
        <h1 className="text-xl font-bold flex items-center gap-2">
          <GitCompare className="h-5 w-5 text-primary" />
          What-If 시나리오
        </h1>
        <Card>
          <CardContent className="py-6 text-center">
            <p className="text-sm text-muted-foreground">
              거래 내역이 없습니다.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // 현재가 lookup
  const symbols = [...new Set(trades.map((t) => t.symbol))];
  const { data: stocksData } = await supabase
    .from("stocks")
    .select("symbol, last_price, currency")
    .in("symbol", symbols);
  const stockMap = new Map<string, StockMeta>(
    ((stocksData as StockMeta[] | null) ?? []).map((s) => [s.symbol, s]),
  );

  // 실시간 USD→KRW 환율 (lib/fx 단일 소스)
  const fxRate = await fetchUsdKrwRate(supabase);

  // 매수의 KRW 가치 + 매수 시점 (시장 환산)
  let totalBuyKrw = 0;
  let totalSellKrw = 0;
  type Holding = { qty: number; avgCost: number; currency: string };
  const holdings = new Map<string, Holding>();

  // 매수가 이루어진 평균 시점 (가중평균)
  let buyTimeWeight = 0;
  let buyTimeWeightSum = 0;

  // Buy-and-hold sim (모든 매수금을 KOSPI/S&P에 넣었으면)
  let bhValue = 0;
  let bhInflow = 0; // 누적 투입

  const now = new Date().getTime();

  for (const t of trades) {
    const qty = Number(t.quantity);
    const price = Number(t.price);
    const tradedValue = qty * price;
    const valueKrw = toKrw(tradedValue, t.currency, fxRate);
    const tradeTime = new Date(t.created_at).getTime();
    const yearsAgo = (now - tradeTime) / (365.25 * 86400000);
    const market: "KR" | "US" = t.currency === "KRW" ? "KR" : "US";

    if (t.side === "buy") {
      totalBuyKrw += valueKrw;
      buyTimeWeight += yearsAgo * valueKrw;
      buyTimeWeightSum += valueKrw;

      // Buy-and-hold: 매수금만큼 시장에 넣었다 가정 → 현재까지 시장 평균 수익률
      const growth = Math.pow(1 + annualizedReturn(market), yearsAgo);
      bhValue += valueKrw * growth;
      bhInflow += valueKrw;

      const h = holdings.get(t.symbol) ?? { qty: 0, avgCost: 0, currency: t.currency };
      const newTotal = h.qty + qty;
      h.avgCost =
        newTotal > 0 ? (h.qty * h.avgCost + qty * price) / newTotal : price;
      h.qty = newTotal;
      h.currency = t.currency;
      holdings.set(t.symbol, h);
    } else {
      totalSellKrw += valueKrw;
      const h = holdings.get(t.symbol);
      if (h) {
        h.qty = Math.max(0, h.qty - qty);
        if (h.qty <= 0) holdings.delete(t.symbol);
      }
    }
  }

  // 현재 holdings의 market value
  let currentHoldKrw = 0;
  for (const [sym, h] of holdings) {
    const meta = stockMap.get(sym);
    const cur = Number(meta?.last_price ?? h.avgCost);
    const valueKrw = toKrw(h.qty * cur, h.currency, fxRate);
    currentHoldKrw += valueKrw;
  }

  // 모의 실현 수익
  const myTotalValue = totalSellKrw + currentHoldKrw;
  const myNetGain = myTotalValue - totalBuyKrw;
  const myReturnPct = totalBuyKrw > 0 ? (myNetGain / totalBuyKrw) * 100 : 0;

  // Buy-and-hold 수익
  const bhGain = bhValue - bhInflow;
  const bhReturnPct = bhInflow > 0 ? (bhGain / bhInflow) * 100 : 0;

  // 알파 (vs Buy-and-hold)
  const alphaKrw = myNetGain - bhGain;

  // 인플레이션 보정 (한국 연평균 ~2.5%)
  const avgYearsHeld = buyTimeWeightSum > 0 ? buyTimeWeight / buyTimeWeightSum : 0;
  const inflationFactor = Math.pow(1.025, avgYearsHeld);
  const realReturnPct = (myReturnPct + 100) / inflationFactor - 100;

  const fmt = (v: number) => `₩${Math.round(v).toLocaleString()}`;

  return (
    <div className="max-w-3xl mx-auto p-4 space-y-4">
      <div>
        <h1 className="text-xl font-bold flex items-center gap-2">
          <GitCompare className="h-5 w-5 text-primary" />
          What-If 시나리오
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          내 모의 거래 vs &quot;그냥 인덱스에 넣었다면?&quot; 비교 — 종목 선택의 가치 점검.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">내 모의 포트폴리오</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-3">
            <Stat label="총 매수금" value={fmt(totalBuyKrw)} />
            <Stat label="실현 + 평가" value={fmt(myTotalValue)} primary />
            <Stat
              label="수익률"
              value={`${myReturnPct >= 0 ? "+" : ""}${myReturnPct.toFixed(2)}%`}
              positive={myReturnPct >= 0}
            />
          </div>
        </CardContent>
      </Card>

      <Card className={alphaKrw >= 0 ? "border-green-500/30" : "border-red-500/30"}>
        <CardHeader>
          <CardTitle className="text-base">
            🆚 만약 그냥 인덱스에 넣었다면?
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-xs text-muted-foreground mb-3">
            매수 시점/금액 그대로 KOSPI(KRW) / S&P 500(USD)에 넣었다고 가정 (연평균 7%/10% 가정).
          </div>
          <div className="grid grid-cols-3 gap-3 mb-3">
            <Stat label="투입금" value={fmt(bhInflow)} />
            <Stat label="현재 가치" value={fmt(bhValue)} />
            <Stat
              label="시장 수익률"
              value={`${bhReturnPct >= 0 ? "+" : ""}${bhReturnPct.toFixed(2)}%`}
              positive={bhReturnPct >= 0}
            />
          </div>
          <div className="pt-3 border-t">
            <div className="text-xs text-muted-foreground">
              내 알파 (vs 시장)
            </div>
            <div
              className={`text-2xl font-bold font-mono tabular-nums ${
                alphaKrw >= 0 ? "text-green-500" : "text-red-500"
              }`}
            >
              {alphaKrw >= 0 ? "+" : ""}
              {fmt(alphaKrw)}
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              {alphaKrw >= 0 ? (
                <>
                  ✅ 인덱스보다 잘했습니다. <strong>{fmt(alphaKrw)}</strong> 만큼 추가 수익.
                </>
              ) : (
                <>
                  📉 인덱스를 못 이겼습니다 — 차라리 ETF 묻어두는 게 나았을 수도. 통계상 액티브 투자자의 70-80%가 인덱스 이기지 못함.
                </>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">💸 실질 수익률</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-3">
            <Stat
              label="명목 수익률"
              value={`${myReturnPct.toFixed(2)}%`}
            />
            <Stat
              label="실질 수익률 (인플레 반영)"
              value={`${realReturnPct.toFixed(2)}%`}
              positive={realReturnPct >= 0}
            />
          </div>
          <p className="text-xs text-muted-foreground mt-3">
            한국 평균 인플레 2.5%/연 가정. 보유기간 평균 {avgYearsHeld.toFixed(1)}년 → 누적 인플레{" "}
            {((inflationFactor - 1) * 100).toFixed(1)}% 차감.
          </p>
          {realReturnPct < 0 && myReturnPct > 0 && (
            <p className="text-xs text-amber-500 mt-2">
              ⚠️ 명목으로는 수익이지만 실질로는 손실 — 구매력 기준으로는 적자.
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="text-xs text-muted-foreground py-3 space-y-2">
          <p className="font-semibold text-foreground">📚 시사점</p>
          <ul className="list-disc ml-4 space-y-1">
            <li>
              <strong>인덱스 이기기 어려움</strong>: SPIVA 보고서 — 미국 액티브 펀드의 85% 이상이 10년 기준 S&P 500 underperform.
            </li>
            <li>
              <strong>비용 효과</strong>: 인덱스 ETF는 운용보수 0.05~0.15%, 액티브는 1%+. 30년 누적 차이 큼.
            </li>
            <li>
              <strong>실질 수익률</strong>: 인플레보다 못 이기면 자산 가치 감소. 5% 명목수익 = 2.5% 실질수익 (인플레 2.5% 가정).
            </li>
            <li>
              <strong>저축 vs 투자</strong>: 예금 3% 인플레 2.5% → 실질 0.5%. 인플레가 4%면 예금은 손실.
            </li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}

function Stat({
  label,
  value,
  positive,
  primary,
}: {
  label: string;
  value: string;
  positive?: boolean;
  primary?: boolean;
}) {
  return (
    <div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div
        className={`font-mono tabular-nums ${
          primary ? "text-base font-bold" : "text-sm font-medium"
        } ${
          positive === true
            ? "text-green-500"
            : positive === false
              ? "text-red-500"
              : ""
        }`}
      >
        {value}
      </div>
    </div>
  );
}
