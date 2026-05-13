/**
 * Plan #22 — 큐레이션 / Valuation engine (rule-based).
 *
 * 알고리즘:
 *   fair_value_pe   = sector_median_pe × stock_eps
 *     where stock_eps = current_price / current_per (PER에서 역산)
 *   target_price    = fair_value_pe × growth_premium
 *     growth_premium = 1.0 + min(0.3, max(-0.2, momentum_factor))
 *     momentum_factor = (current - 52w_low) / (52w_high - 52w_low) - 0.5
 *       (0.5 above midpoint → up to +30% premium; 0.5 below → up to -20% discount)
 *   upside          = target / current - 1
 *   rating          = upside band → Strong Buy / Buy / Hold / Sell / Strong Sell
 *
 * 한계:
 *  - sector_median_pe만 사용 (PB/ROE는 worker RPC가 따로 제공해야 함)
 *  - 음수 PER, NULL은 분석 불가
 *  - 미국 종목은 NYSE/NASDAQ 합쳐 sector pool 사용
 */

export type StockForValuation = {
  symbol: string;
  per: number | null;
  last_price: number | null;
  market: string;
  sector: string | null;
  fifty_two_week_high: number | null;
  fifty_two_week_low: number | null;
};

export type SectorStats = {
  sector: string;
  marketScope: "KR" | "US";
  count: number;
  medianPer: number | null;
};

export type Rating =
  | "strong_buy"
  | "buy"
  | "hold"
  | "sell"
  | "strong_sell"
  | "n/a";

export const RATING_LABEL: Record<Rating, string> = {
  strong_buy: "Strong Buy",
  buy: "Buy",
  hold: "Hold",
  sell: "Sell",
  strong_sell: "Strong Sell",
  "n/a": "데이터 부족",
};

export const RATING_COLOR: Record<Rating, string> = {
  strong_buy: "text-green-600 bg-green-500/10 border-green-500/30",
  buy: "text-green-500 bg-green-500/5 border-green-500/20",
  hold: "text-muted-foreground bg-muted border-border",
  sell: "text-red-500 bg-red-500/5 border-red-500/20",
  strong_sell: "text-red-600 bg-red-500/10 border-red-500/30",
  "n/a": "text-muted-foreground bg-muted border-border",
};

export type Valuation = {
  symbol: string;
  hasData: boolean;
  reason?: string; // why n/a
  currentPrice?: number;
  currentPer?: number;
  sectorMedianPer?: number;
  sectorPeerCount?: number;
  eps?: number;
  fairValuePe?: number;
  growthPremium?: number;
  targetPrice?: number;
  upsidePct?: number;
  rating: Rating;
  factors: string[]; // human-readable reason chips
};

export function marketScope(market: string): "KR" | "US" | null {
  if (market.startsWith("KRX_")) return "KR";
  if (market === "NYSE" || market === "NASDAQ") return "US";
  return null;
}

export function computeValuation(
  stock: StockForValuation,
  sectorStats: SectorStats | null,
): Valuation {
  const factors: string[] = [];
  const result: Valuation = { symbol: stock.symbol, hasData: false, rating: "n/a", factors };

  if (!stock.last_price || !stock.per || stock.per <= 0) {
    result.reason = "현재가 또는 PER 데이터 없음 / 적자";
    return result;
  }
  if (!stock.sector) {
    result.reason = "섹터 미지정";
    return result;
  }
  if (!sectorStats || !sectorStats.medianPer || sectorStats.count < 3) {
    result.reason = `${stock.sector} 섹터 동종 종목 부족 (${sectorStats?.count ?? 0}개)`;
    return result;
  }

  const currentPrice = Number(stock.last_price);
  const currentPer = Number(stock.per);
  const sectorMedianPer = sectorStats.medianPer;
  const eps = currentPrice / currentPer;
  const fairValuePe = sectorMedianPer * eps;

  // Momentum factor — position within 52w range
  let growthPremium = 1.0;
  if (
    stock.fifty_two_week_high &&
    stock.fifty_two_week_low &&
    Number(stock.fifty_two_week_high) > Number(stock.fifty_two_week_low)
  ) {
    const high = Number(stock.fifty_two_week_high);
    const low = Number(stock.fifty_two_week_low);
    const position = (currentPrice - low) / (high - low); // 0 to 1
    const momentumFactor = position - 0.5; // -0.5 to 0.5
    growthPremium = 1.0 + Math.max(-0.2, Math.min(0.3, momentumFactor));
    if (position > 0.7) factors.push("52주 상단권 (모멘텀)");
    else if (position < 0.3) factors.push("52주 하단권 (저점 매수 후보)");
  }

  const targetPrice = fairValuePe * growthPremium;
  const upsidePct = targetPrice / currentPrice - 1;

  // Rating band
  let rating: Rating;
  if (upsidePct >= 0.2) rating = "strong_buy";
  else if (upsidePct >= 0.05) rating = "buy";
  else if (upsidePct >= -0.05) rating = "hold";
  else if (upsidePct >= -0.2) rating = "sell";
  else rating = "strong_sell";

  // Factor chips
  if (currentPer < sectorMedianPer * 0.7) {
    factors.push(
      `PER ${currentPer.toFixed(1)} < 섹터 중간 ${sectorMedianPer.toFixed(1)} 30%+ 저평가`,
    );
  } else if (currentPer < sectorMedianPer * 0.9) {
    factors.push(`PER 저평가 (섹터 대비 ${((1 - currentPer / sectorMedianPer) * 100).toFixed(0)}%)`);
  } else if (currentPer > sectorMedianPer * 1.3) {
    factors.push(`PER 고평가 (섹터 대비 ${((currentPer / sectorMedianPer - 1) * 100).toFixed(0)}%)`);
  } else {
    factors.push("PER 섹터 평균 수준");
  }

  return {
    symbol: stock.symbol,
    hasData: true,
    currentPrice,
    currentPer,
    sectorMedianPer,
    sectorPeerCount: sectorStats.count,
    eps,
    fairValuePe,
    growthPremium,
    targetPrice,
    upsidePct,
    rating,
    factors,
  };
}

/**
 * sector_stats 계산 — 같은 (sector, market_scope) 내 모든 종목의 median PER.
 * `pers`는 양수 PER만 (적자 제외).
 */
export function medianOf(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}
