"use client";

// Plan #44: PillTabs — 세그먼트 컨트롤 (pill 스타일).

type Item = { k: string; l: string };

type Props = {
  items: readonly Item[];
  value: string;
  onChange: (k: string) => void;
  size?: "sm" | "md";
};

export function PillTabs({ items, value, onChange, size = "md" }: Props) {
  const padding = size === "sm" ? "6px 12px" : "8px 14px";
  const fontSize = size === "sm" ? 12 : 13;
  return (
    <div
      style={{
        display: "inline-flex",
        gap: 6,
        background: "var(--yg-bg-tint-ink)",
        padding: 3,
        borderRadius: 99,
      }}
    >
      {items.map((t) => {
        const isActive = value === t.k;
        return (
          <button
            key={t.k}
            type="button"
            onClick={() => onChange(t.k)}
            style={{
              all: "unset",
              cursor: "pointer",
              padding,
              borderRadius: 99,
              fontSize,
              fontWeight: 700,
              letterSpacing: "-0.01em",
              background: isActive ? "var(--yg-bg-card)" : "transparent",
              color: isActive
                ? "var(--yg-fg-primary)"
                : "var(--yg-fg-tertiary)",
              boxShadow: isActive
                ? "0 1px 2px rgba(15,17,21,0.08)"
                : "none",
              transition: "background 120ms ease",
            }}
          >
            {t.l}
          </button>
        );
      })}
    </div>
  );
}
