// Plan #41: YG TopBar — logo + brand + bell + settings + (admin badge).

import Link from "next/link";
import { YGLogo, YGIcon } from "@/components/yg/icon";
import { ChangelogLink } from "@/components/changelog-link";

type Props = {
  isAdmin: boolean;
  latestChangelogSha: string | null;
};

export function YGTopBar({ isAdmin, latestChangelogSha }: Props) {
  return (
    <header
      style={{
        padding: "12px 20px 4px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <YGLogo size={26} color="var(--yg-brand)" />
        <span
          style={{
            fontSize: 17,
            fontWeight: 800,
            letterSpacing: "-0.02em",
            color: "var(--yg-fg-primary)",
          }}
        >
          YGinvest
        </span>
        {isAdmin && (
          <span
            style={{
              marginLeft: 6,
              padding: "3px 7px",
              borderRadius: 6,
              background: "var(--yg-bg-tint-red)",
              color: "var(--yg-up-deep)",
              fontSize: 10,
              fontWeight: 800,
              letterSpacing: "0.04em",
            }}
            title="관리자"
          >
            ADMIN
          </span>
        )}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 14, color: "var(--yg-fg-secondary)" }}>
        <ChangelogLink latestSha={latestChangelogSha} />
        {isAdmin && (
          <Link href="/app/health" title="시스템 상태" style={{ color: "var(--yg-fg-secondary)", display: "inline-flex" }}>
            <YGIcon.Bell s={22} c="var(--yg-fg-secondary)" />
          </Link>
        )}
        <Link href="/app/settings" style={{ color: "var(--yg-fg-secondary)", display: "inline-flex" }}>
          <YGIcon.Settings s={22} c="var(--yg-fg-secondary)" />
        </Link>
      </div>
    </header>
  );
}
