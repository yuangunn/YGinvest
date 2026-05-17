// Plan #41: YG Asset Hero — 큰 자산 카드 (KRW + USD).

import Link from "next/link";
import { fmt } from "@/lib/yg-fmt";

type Props = {
  krwBalance: number;
  usdBalance: number;
  startingKrw: number;
  startingUsd: number;
  /** 보유 종목 평가액 (KRW 환산). 없으면 0. */
  holdingsValueKrw?: number;
  /** 현재 USD/KRW 환율. fx_rates의 최신값. */
  fxRate: number;
  /** 시작 시점 환율 (portfolio.fx_rate_at_start) */
  startingFxRate: number;
};

export function YGAssetHero({
  krwBalance,
  usdBalance,
  startingKrw,
  startingUsd,
  holdingsValueKrw = 0,
  fxRate,
  startingFxRate,
}: Props) {
  // Plan #43: portfolio overview와 동일한 계산식.
  // 총자산 = KRW 현금 + USD 현금×fx + 보유 종목 평가액(KRW 환산)
  const totalKRW = krwBalance + usdBalance * fxRate + holdingsValueKrw;
  const startingTotalKRW = startingKrw + startingUsd * startingFxRate;
  const changeAbs = totalKRW - startingTotalKRW;
  const changePct =
    startingTotalKRW > 0 ? (changeAbs / startingTotalKRW) * 100 : 0;
  const up = changePct >= 0;

  return (
    <div
      className="yg-card yg-card-lg yg-tap"
      style={{
        padding: 22,
        display: "flex",
        flexDirection: "column",
        gap: 16,
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <span
          style={{
            fontSize: 13,
            color: "var(--yg-fg-tertiary)",
            fontWeight: 600,
          }}
        >
          총 평가금액
        </span>
        <Link
          href="/app/portfolio/overview"
          style={{
            fontSize: 12,
            color: "var(--yg-fg-tertiary)",
            fontWeight: 600,
            textDecoration: "none",
          }}
        >
          전체 보기 ›
        </Link>
      </div>

      <div
        className="yg-num"
        style={{
          fontSize: 34,
          fontWeight: 800,
          letterSpacing: "-0.03em",
          lineHeight: 1,
          display: "flex",
          alignItems: "baseline",
          gap: 4,
          color: "var(--yg-fg-primary)",
        }}
      >
        {fmt.krw(totalKRW)}
        <span
          style={{
            fontSize: 18,
            fontWeight: 700,
            marginLeft: 2,
            color: "var(--yg-fg-secondary)",
          }}
        >
          원
        </span>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span
          className={up ? "yg-chip yg-chip-up" : "yg-chip yg-chip-down"}
          style={{ padding: "4px 8px", fontSize: 12 }}
        >
          {up ? "▲" : "▼"} {Math.abs(changePct).toFixed(2)}%
        </span>
        <span
          className="yg-num"
          style={{
            fontSize: 13,
            color: up ? "var(--yg-up-deep)" : "var(--yg-down-deep)",
            fontWeight: 700,
          }}
        >
          {up ? "+" : ""}
          {fmt.krw(changeAbs)}원 (전체)
        </span>
      </div>

      <div style={{ height: 1, background: "var(--yg-line-faint)" }} />

      <div style={{ display: "flex", gap: 16 }}>
        <div style={{ flex: 1 }}>
          <div
            style={{
              fontSize: 11,
              color: "var(--yg-fg-tertiary)",
              fontWeight: 600,
              marginBottom: 4,
            }}
          >
            원화 · 시작 {fmt.krwShort(startingKrw)}
          </div>
          <div
            className="yg-num"
            style={{
              fontSize: 17,
              fontWeight: 800,
              letterSpacing: "-0.02em",
              color: "var(--yg-fg-primary)",
            }}
          >
            {fmt.krw(krwBalance)}원
          </div>
        </div>
        <div style={{ width: 1, background: "var(--yg-line-faint)" }} />
        <div style={{ flex: 1 }}>
          <div
            style={{
              fontSize: 11,
              color: "var(--yg-fg-tertiary)",
              fontWeight: 600,
              marginBottom: 4,
            }}
          >
            달러 · 시작 ${startingUsd.toLocaleString()}
          </div>
          <div
            className="yg-num"
            style={{
              fontSize: 17,
              fontWeight: 800,
              letterSpacing: "-0.02em",
              color: "var(--yg-fg-primary)",
            }}
          >
            {fmt.usd(usdBalance)}
          </div>
        </div>
      </div>
    </div>
  );
}
