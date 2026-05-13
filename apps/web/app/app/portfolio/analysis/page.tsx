import Link from "next/link";
import { redirect } from "next/navigation";
import { TrendingUp, TrendingDown, Clock, Award } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getSelectedPortfolioId } from "@/lib/portfolio-context";

type Trade = {
  id: string;
  symbol: string;
  side: string;
  quantity: number;
  price: number;
  currency: string;
  fee: number;
  created_at: string;
};

type StockMeta = {
  symbol: string;
  name: string;
  name_ko: string | null;
  last_price: number | null;
};

export default async function PortfolioAnalysisPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const portfolioId = await getSelectedPortfolioId(supabase, user.id);
  if (!portfolioId) redirect("/app/portfolio/overview");

  const { data: trades } = await supabase
    .from("trades")
    .select("id, symbol, side, quantity, price, currency, fee, created_at")
    .eq("portfolio_id", portfolioId)
    .order("created_at", { ascending: true });

  const rows = (trades as Trade[] | null) ?? [];

  if (rows.length === 0) {
    return (
      <div className="max-w-3xl mx-auto p-4 space-y-4">
        <h1 className="text-xl font-bold flex items-center gap-2">
          <Award className="h-5 w-5 text-primary" />
          매매 분석
        </h1>
        <Card>
          <CardContent className="py-6 text-center">
            <p className="text-sm text-muted-foreground">아직 거래 내역이 없어요</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Stock metadata for current prices
  const symbols = [...new Set(rows.map((r) => r.symbol))];
  const { data: stocks } = await supabase
    .from("stocks")
    .select("symbol, name, name_ko, last_price")
    .in("symbol", symbols);
  const stockMap = new Map<string, StockMeta>(
    ((stocks as StockMeta[] | null) ?? []).map((s) => [s.symbol, s]),
  );

  // Compute realized + unrealized per symbol (FIFO matching)
  type Lot = { qty: number; price: number; date: string };
  type Position = {
    symbol: string;
    realizedPnL: number;
    realizedCurrency: string;
    openLots: Lot[];
    totalBuys: number;
    totalSells: number;
    holdingDays: number; // 가중 평균 holding period
  };
  const positions = new Map<string, Position>();

  for (const t of rows) {
    const pos = positions.get(t.symbol) ?? {
      symbol: t.symbol,
      realizedPnL: 0,
      realizedCurrency: t.currency,
      openLots: [],
      totalBuys: 0,
      totalSells: 0,
      holdingDays: 0,
    };

    if (t.side === "buy") {
      pos.openLots.push({
        qty: Number(t.quantity),
        price: Number(t.price),
        date: t.created_at,
      });
      pos.totalBuys += Number(t.quantity);
    } else {
      // FIFO match
      let remaining = Number(t.quantity);
      const sellPrice = Number(t.price);
      const sellDate = new Date(t.created_at).getTime();
      let weightedHold = 0;
      let matchedQty = 0;
      while (remaining > 0 && pos.openLots.length > 0) {
        const lot = pos.openLots[0];
        const match = Math.min(remaining, lot.qty);
        const gain = (sellPrice - lot.price) * match;
        pos.realizedPnL += gain;
        const holdMs = sellDate - new Date(lot.date).getTime();
        weightedHold += (holdMs / 86400000) * match;
        matchedQty += match;
        remaining -= match;
        lot.qty -= match;
        if (lot.qty <= 0) pos.openLots.shift();
      }
      pos.totalSells += Number(t.quantity);
      if (matchedQty > 0) {
        pos.holdingDays =
          (pos.holdingDays * (pos.totalSells - matchedQty) +
            weightedHold) /
          pos.totalSells;
      }
    }
    positions.set(t.symbol, pos);
  }

  // Add unrealized for open lots
  type Result = {
    symbol: string;
    realizedPnL: number;
    unrealizedPnL: number;
    totalPnL: number;
    holdingDays: number;
    currency: string;
  };
  const results: Result[] = [];
  for (const pos of positions.values()) {
    const stock = stockMap.get(pos.symbol);
    const currentPrice = stock?.last_price ? Number(stock.last_price) : 0;
    let unrealized = 0;
    for (const lot of pos.openLots) {
      unrealized += (currentPrice - lot.price) * lot.qty;
    }
    results.push({
      symbol: pos.symbol,
      realizedPnL: pos.realizedPnL,
      unrealizedPnL: unrealized,
      totalPnL: pos.realizedPnL + unrealized,
      holdingDays: pos.holdingDays,
      currency: pos.realizedCurrency,
    });
  }

  const winners = results.filter((r) => r.totalPnL > 0).sort((a, b) => b.totalPnL - a.totalPnL);
  const losers = results.filter((r) => r.totalPnL < 0).sort((a, b) => a.totalPnL - b.totalPnL);

  const totalRealized = results.reduce((s, r) => s + r.realizedPnL, 0);
  const totalUnrealized = results.reduce((s, r) => s + r.unrealizedPnL, 0);
  const totalPnL = totalRealized + totalUnrealized;

  // Avg holding period (가중 평균)
  const avgHoldDays =
    results.filter((r) => r.holdingDays > 0).reduce((s, r) => s + r.holdingDays, 0) /
    Math.max(1, results.filter((r) => r.holdingDays > 0).length);

  const winRate =
    winners.length > 0 || losers.length > 0
      ? (winners.length / (winners.length + losers.length)) * 100
      : 0;

  return (
    <div className="max-w-3xl mx-auto p-4 space-y-4">
      <div>
        <h1 className="text-xl font-bold flex items-center gap-2">
          <Award className="h-5 w-5 text-primary" />
          매매 분석
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          FIFO 매칭 기반 실현/미실현 손익 분석
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">📊 총괄</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
            <Stat
              label="실현 손익"
              value={fmtPnl(totalRealized, results[0]?.currency ?? "KRW")}
              positive={totalRealized > 0}
            />
            <Stat
              label="미실현 손익"
              value={fmtPnl(totalUnrealized, results[0]?.currency ?? "KRW")}
              positive={totalUnrealized > 0}
            />
            <Stat
              label="총 손익"
              value={fmtPnl(totalPnL, results[0]?.currency ?? "KRW")}
              positive={totalPnL > 0}
              primary
            />
            <Stat
              label="승률"
              value={`${winRate.toFixed(0)}%`}
              hint={`${winners.length}승 ${losers.length}패`}
            />
            <Stat
              label="평균 보유"
              value={`${avgHoldDays.toFixed(0)}일`}
            />
            <Stat label="총 거래" value={`${rows.length}건`} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-green-500" />
            수익 종목 ({winners.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {winners.length === 0 ? (
            <p className="text-sm text-muted-foreground">없음</p>
          ) : (
            <SymbolList items={winners.slice(0, 10)} meta={stockMap} />
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <TrendingDown className="h-4 w-4 text-red-500" />
            손실 종목 ({losers.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {losers.length === 0 ? (
            <p className="text-sm text-muted-foreground">없음</p>
          ) : (
            <SymbolList items={losers.slice(0, 10)} meta={stockMap} />
          )}
        </CardContent>
      </Card>

      {avgHoldDays > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Clock className="h-4 w-4 text-blue-500" />
              보유 기간 분포
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground mb-2">
              평균 {avgHoldDays.toFixed(0)}일 — {avgHoldDays < 7 ? "초단기" : avgHoldDays < 30 ? "단기" : avgHoldDays < 180 ? "스윙" : "장기"} 트레이딩 성향
            </p>
            {results.filter((r) => r.holdingDays > 0).slice(0, 10).map((r) => {
              const m = stockMap.get(r.symbol);
              const name = m?.name_ko ?? m?.name ?? r.symbol;
              return (
                <div key={r.symbol} className="flex justify-between text-xs py-1">
                  <span>{name}</span>
                  <span className="text-muted-foreground tabular-nums">
                    {r.holdingDays.toFixed(0)}일
                  </span>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      <p className="text-xs text-muted-foreground text-center">
        ⚠️ FIFO (First-In-First-Out) 매칭 기반. 수수료/세금은 포함하지 않은 단순 P&L입니다.
      </p>
    </div>
  );
}

function Stat({
  label,
  value,
  hint,
  positive,
  primary,
}: {
  label: string;
  value: string;
  hint?: string;
  positive?: boolean;
  primary?: boolean;
}) {
  return (
    <div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div
        className={`font-mono tabular-nums ${
          primary ? "text-base font-bold" : "text-sm font-medium"
        } ${positive === true ? "text-green-500" : positive === false ? "text-red-500" : ""}`}
      >
        {value}
      </div>
      {hint && <div className="text-[10px] text-muted-foreground">{hint}</div>}
    </div>
  );
}

type Result = {
  symbol: string;
  realizedPnL: number;
  unrealizedPnL: number;
  totalPnL: number;
  holdingDays: number;
  currency: string;
};

function SymbolList({
  items,
  meta,
}: {
  items: Result[];
  meta: Map<string, { name: string; name_ko: string | null }>;
}) {
  return (
    <div className="space-y-1">
      {items.map((r) => {
        const m = meta.get(r.symbol);
        const name = m?.name_ko ?? m?.name ?? r.symbol;
        return (
          <Link
            key={r.symbol}
            href={`/app/trade/${encodeURIComponent(r.symbol)}`}
            className="flex items-center justify-between gap-2 rounded p-2 hover:bg-muted/30 text-sm"
          >
            <div className="min-w-0">
              <div className="font-medium truncate">{name}</div>
              <div className="text-[10px] text-muted-foreground">
                {r.symbol}
                {r.holdingDays > 0 && ` · ${r.holdingDays.toFixed(0)}일 보유`}
              </div>
            </div>
            <div
              className={`font-mono text-sm tabular-nums flex-shrink-0 ${
                r.totalPnL >= 0 ? "text-green-500" : "text-red-500"
              }`}
            >
              {fmtPnl(r.totalPnL, r.currency)}
            </div>
          </Link>
        );
      })}
    </div>
  );
}

function fmtPnl(v: number, currency: string): string {
  const sign = v >= 0 ? "+" : "";
  const abs = Math.abs(v);
  if (currency === "KRW") {
    return `${sign}₩${Math.round(v).toLocaleString()}`;
  }
  return `${sign}$${v >= 0 ? abs.toFixed(2) : (-abs).toFixed(2)}`;
}
