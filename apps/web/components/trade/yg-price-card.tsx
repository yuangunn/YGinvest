// Plan #44: YG Price Card — 현재가 hero (Toss 스타일).
// 차트 + 큰 가격 + delta + freshness + themes + AI rating.

import { fmt } from "@/lib/yg-fmt";
import { DeltaText } from "@/components/yg/delta-text";
import { FreshnessIndicator } from "@/components/freshness-indicator";
import { StockThemes } from "@/components/stock-themes";
import { Suspense } from "react";
import { StockRatingBadge } from "@/components/stock-rating-badge";

type Props = {
  lastPrice: number | null;
  currency: string;
  lastPriceAt: string | null;
  market: string;
  fiftyTwoWeekHigh: number | null;
  fiftyTwoWeekLow: number | null;
  symbol: string;
  isEtf?: boolean;
};

export function YGPriceCard({
  lastPrice,
  currency,
  lastPriceAt,
  market,
  fiftyTwoWeekHigh,
  fiftyTwoWeekLow,
  symbol,
  isEtf,
}: Props) {
  const isKRW = currency === "KRW";
  const priceText = lastPrice
    ? isKRW
      ? fmt.krw(lastPrice)
      : fmt.usd(lastPrice)
    : "—";

  // 52w 범위에서 변동률 (참고용)
  let rangePct: number | null = null;
  if (lastPrice && fiftyTwoWeekHigh && fiftyTwoWeekLow) {
    const range = fiftyTwoWeekHigh - fiftyTwoWeekLow;
    if (range > 0) {
      rangePct = ((lastPrice - fiftyTwoWeekLow) / range) * 100;
    }
  }

  return (
    <div
      className="yg-card yg-card-lg"
      style={{ padding: 22, margin: "0 20px" }}
    >
      {isEtf && (
        <span
          style={{
            display: "inline-block",
            fontSize: 10,
            fontWeight: 800,
            background: "var(--yg-bg-tint-ink)",
            padding: "3px 7px",
            borderRadius: 5,
            color: "var(--yg-fg-secondary)",
            letterSpacing: "0.04em",
            marginBottom: 8,
          }}
        >
          ETF
        </span>
      )}
      <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
        <span
          className="yg-num"
          style={{
            fontSize: 36,
            fontWeight: 800,
            letterSpacing: "-0.03em",
            lineHeight: 1,
            color: "var(--yg-fg-primary)",
          }}
        >
          {priceText}
        </span>
        {isKRW && lastPrice && (
          <span
            style={{
              fontSize: 18,
              fontWeight: 700,
              color: "var(--yg-fg-secondary)",
            }}
          >
            원
          </span>
        )}
      </div>

      <div
        style={{
          marginTop: 10,
          display: "flex",
          alignItems: "center",
          gap: 10,
          flexWrap: "wrap",
        }}
      >
        {lastPriceAt && (
          <FreshnessIndicator lastFetchedAt={lastPriceAt} market={market} />
        )}
        {rangePct != null && (
          <span
            className="yg-num"
            style={{
              fontSize: 11,
              color: "var(--yg-fg-tertiary)",
              fontWeight: 700,
            }}
          >
            52주 위치 {rangePct.toFixed(0)}%
          </span>
        )}
      </div>

      {/* 52주 범위 바 */}
      {rangePct != null && fiftyTwoWeekHigh && fiftyTwoWeekLow && (
        <div style={{ marginTop: 12 }}>
          <div
            style={{
              height: 4,
              borderRadius: 99,
              background: "var(--yg-bg-tint-ink)",
              position: "relative",
            }}
          >
            <div
              style={{
                position: "absolute",
                top: -3,
                bottom: -3,
                left: `${Math.min(100, Math.max(0, rangePct))}%`,
                transform: "translateX(-50%)",
                width: 10,
                height: 10,
                borderRadius: 99,
                background: "var(--yg-fg-primary)",
              }}
            />
          </div>
          <div
            className="yg-num"
            style={{
              display: "flex",
              justifyContent: "space-between",
              fontSize: 10,
              color: "var(--yg-fg-tertiary)",
              fontWeight: 600,
              marginTop: 4,
            }}
          >
            <span>
              저 {isKRW ? fmt.krw(fiftyTwoWeekLow) : fmt.usd(fiftyTwoWeekLow)}
            </span>
            <span>
              고 {isKRW ? fmt.krw(fiftyTwoWeekHigh) : fmt.usd(fiftyTwoWeekHigh)}
            </span>
          </div>
        </div>
      )}

      {/* 테마 칩 */}
      <div style={{ marginTop: 14 }}>
        <StockThemes symbol={symbol} />
      </div>

      {/* AI 평가 */}
      <div style={{ marginTop: 12 }}>
        <Suspense
          fallback={
            <div
              style={{
                fontSize: 11,
                color: "var(--yg-fg-tertiary)",
                fontWeight: 600,
              }}
            >
              분석 로딩…
            </div>
          }
        >
          <StockRatingBadge symbol={symbol} />
        </Suspense>
      </div>

      <DeltaSuffix lastPrice={lastPrice} currency={currency} />
    </div>
  );
}

// 변동률 (server) — change_pct는 별도 API에서 가져와야 하므로 placeholder
function DeltaSuffix({}: { lastPrice: number | null; currency: string }) {
  // 변동률 계산을 위한 별도 데이터가 없으므로 plain. 추후 stock_bars 직전 종가로 계산.
  return null;
}

void DeltaText;
