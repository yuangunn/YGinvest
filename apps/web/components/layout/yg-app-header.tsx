// Plan #42: YG 앱 헤더 — 모든 /app 페이지 상단 (single source).
//
// 다이나믹 아일랜드/펀치홀 회피: env(safe-area-inset-top).
// 디자인: Pretendard, deep ink brand, minimal icons.
//
// 포트폴리오 전환(PortfolioSwitcher): 친구방에 가입해 포트폴리오가 2개 이상일 때만
// 노출. Plan #42 헤더 개편 때 떨어져 나가 방 포트폴리오로 거래할 방법이 없었다.

import Link from "next/link";
import { YGLogo, YGIcon } from "@/components/yg/icon";
import { ChangelogLink } from "@/components/changelog-link";
import { ThemeToggleYG } from "@/components/yg/theme-toggle-yg";
import {
  PortfolioSwitcher,
  type SwitchablePortfolio,
} from "@/components/portfolio-switcher";

type Props = {
  isAdmin: boolean;
  latestChangelogSha: string | null;
  portfolios?: SwitchablePortfolio[];
  selectedPortfolioId?: string | null;
};

export function YGAppHeader({
  isAdmin,
  latestChangelogSha,
  portfolios = [],
  selectedPortfolioId = null,
}: Props) {
  return (
    <header
      style={{
        background: "var(--yg-bg-card)",
        borderBottom: "1px solid var(--yg-line-faint)",
        position: "sticky",
        top: 0,
        zIndex: 30,
        // 다이나믹 아일랜드 / 펀치홀 회피
        paddingTop: "max(env(safe-area-inset-top), 8px)",
      }}
    >
      <div
        style={{
          padding: "10px 20px 12px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
        }}
      >
        <Link
          href="/app/dashboard"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            textDecoration: "none",
            color: "var(--yg-fg-primary)",
          }}
        >
          <YGLogo size={26} color="var(--yg-brand)" />
          <span
            style={{
              fontSize: 17,
              fontWeight: 800,
              letterSpacing: "-0.02em",
            }}
          >
            YGinvest
          </span>
          {isAdmin && (
            <span
              style={{
                marginLeft: 4,
                padding: "3px 7px",
                borderRadius: 6,
                background: "var(--yg-bg-tint-red)",
                color: "var(--yg-up-deep)",
                fontSize: 10,
                fontWeight: 800,
                letterSpacing: "0.04em",
              }}
            >
              ADMIN
            </span>
          )}
        </Link>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 14,
            color: "var(--yg-fg-secondary)",
          }}
        >
          {portfolios.length > 1 && (
            <PortfolioSwitcher
              portfolios={portfolios}
              selectedId={selectedPortfolioId}
            />
          )}
          <ChangelogLink latestSha={latestChangelogSha} />
          <ThemeToggleYG />
          {isAdmin && (
            <Link
              href="/app/health"
              title="시스템 상태"
              style={{
                color: "var(--yg-fg-secondary)",
                display: "inline-flex",
              }}
            >
              <YGIcon.Bell s={20} c="var(--yg-fg-secondary)" />
            </Link>
          )}
          <Link
            href="/app/settings"
            title="설정"
            style={{
              color: "var(--yg-fg-secondary)",
              display: "inline-flex",
            }}
          >
            <YGIcon.Settings s={20} c="var(--yg-fg-secondary)" />
          </Link>
        </div>
      </div>
    </header>
  );
}
