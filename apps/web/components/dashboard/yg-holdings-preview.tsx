// Plan #41: 보유 종목 / 거래 내역 빠른 진입 (2 컬럼).

import Link from "next/link";
import { YGIcon } from "@/components/yg/icon";

type Props = {
  holdingsCount: number;
};

export function YGHoldingsPreview({ holdingsCount }: Props) {
  return (
    <div style={{ display: "flex", gap: 10 }}>
      <Link
        href="/app/portfolio/holdings"
        className="yg-card yg-tap"
        style={{
          flex: 1,
          padding: 14,
          display: "flex",
          alignItems: "center",
          gap: 12,
          textDecoration: "none",
          color: "var(--yg-fg-primary)",
        }}
      >
        <div
          style={{
            width: 36,
            height: 36,
            borderRadius: 10,
            background: "var(--yg-bg-tint-ink)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "var(--yg-fg-primary)",
          }}
        >
          <YGIcon.Briefcase s={20} />
        </div>
        <div>
          <div
            style={{
              fontSize: 13,
              color: "var(--yg-fg-tertiary)",
              fontWeight: 600,
            }}
          >
            보유 종목
          </div>
          <div
            className="yg-num"
            style={{
              fontSize: 16,
              fontWeight: 800,
              letterSpacing: "-0.02em",
            }}
          >
            {holdingsCount}
            <span
              style={{
                fontSize: 13,
                marginLeft: 2,
                fontWeight: 700,
                color: "var(--yg-fg-secondary)",
              }}
            >
              개
            </span>
          </div>
        </div>
      </Link>
      <Link
        href="/app/portfolio/transactions"
        className="yg-card yg-tap"
        style={{
          flex: 1,
          padding: 14,
          display: "flex",
          alignItems: "center",
          gap: 12,
          textDecoration: "none",
          color: "var(--yg-fg-primary)",
        }}
      >
        <div
          style={{
            width: 36,
            height: 36,
            borderRadius: 10,
            background: "var(--yg-bg-tint-ink)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "var(--yg-fg-primary)",
          }}
        >
          <YGIcon.Chart s={20} />
        </div>
        <div>
          <div
            style={{
              fontSize: 13,
              color: "var(--yg-fg-tertiary)",
              fontWeight: 600,
            }}
          >
            거래 내역
          </div>
          <div
            style={{
              fontSize: 14,
              fontWeight: 700,
              color: "var(--yg-fg-secondary)",
            }}
          >
            전체 보기 ›
          </div>
        </div>
      </Link>
    </div>
  );
}
