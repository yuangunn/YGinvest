// Plan #41: SectionHead — outside-card section heading with optional link.

import Link from "next/link";

type Props = {
  title: string;
  sub?: string;
  href?: string;
  linkLabel?: string;
};

export function SectionHead({ title, sub, href, linkLabel = "전체" }: Props) {
  return (
    <div
      style={{
        padding: "0 4px",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "flex-end",
        marginBottom: 12,
      }}
    >
      <div>
        <h3
          style={{
            margin: 0,
            fontSize: 18,
            fontWeight: 800,
            letterSpacing: "-0.02em",
            color: "var(--yg-fg-primary)",
          }}
        >
          {title}
        </h3>
        {sub && (
          <div
            style={{
              fontSize: 12,
              color: "var(--yg-fg-tertiary)",
              marginTop: 4,
              fontWeight: 600,
            }}
          >
            {sub}
          </div>
        )}
      </div>
      {href && (
        <Link
          href={href}
          style={{
            fontSize: 13,
            color: "var(--yg-fg-tertiary)",
            fontWeight: 600,
            textDecoration: "none",
          }}
        >
          {linkLabel} ›
        </Link>
      )}
    </div>
  );
}
