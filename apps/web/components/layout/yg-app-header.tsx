// Plan #42: YG 앱 헤더 — 모든 /app 페이지 상단 (single source).
//
// 다이나믹 아일랜드/펀치홀 회피: env(safe-area-inset-top).
// 디자인: Pretendard, deep ink brand, minimal icons.

import Link from "next/link";
import { YGLogo, YGIcon } from "@/components/yg/icon";
import { ChangelogLink } from "@/components/changelog-link";

type Props = {
  isAdmin: boolean;
  latestChangelogSha: string | null;
};

export function YGAppHeader({ isAdmin, latestChangelogSha }: Props) {
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
          <ChangelogLink latestSha={latestChangelogSha} />
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
