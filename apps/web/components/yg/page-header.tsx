// Plan #44: PageHeader — sub-page back arrow + title + optional right slot.

"use client";

import { useRouter } from "next/navigation";
import { YGIcon } from "@/components/yg/icon";

type Props = {
  title: React.ReactNode;
  sub?: React.ReactNode;
  right?: React.ReactNode;
  /** override the back behavior (default: router.back()) */
  onBack?: () => void;
};

export function PageHeader({ title, sub, right, onBack }: Props) {
  const router = useRouter();
  const handleBack = onBack ?? (() => router.back());
  return (
    <header
      style={{
        padding: "8px 16px 8px",
        display: "flex",
        alignItems: "center",
        gap: 8,
        background: "var(--yg-bg-card)",
        borderBottom: "1px solid var(--yg-line-faint)",
        position: "sticky",
        top: 0,
        zIndex: 20,
      }}
    >
      <button
        type="button"
        onClick={handleBack}
        className="yg-tap"
        aria-label="뒤로"
        style={{
          all: "unset",
          cursor: "pointer",
          padding: 8,
          marginLeft: -4,
          borderRadius: 10,
          color: "var(--yg-fg-primary)",
          display: "inline-flex",
        }}
      >
        <div style={{ transform: "rotate(180deg)", display: "inline-flex" }}>
          <YGIcon.ChevronRight s={22} c="var(--yg-fg-primary)" />
        </div>
      </button>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: 16,
            fontWeight: 800,
            letterSpacing: "-0.02em",
            color: "var(--yg-fg-primary)",
            lineHeight: 1.2,
          }}
        >
          {title}
        </div>
        {sub && (
          <div
            style={{
              fontSize: 11,
              color: "var(--yg-fg-tertiary)",
              fontWeight: 600,
              marginTop: 2,
            }}
          >
            {sub}
          </div>
        )}
      </div>
      {right && <div style={{ flex: "0 0 auto" }}>{right}</div>}
    </header>
  );
}
