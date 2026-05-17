// Plan #45: YG Section Card — handoff trade-detail.jsx 패턴.
//
// 사용처: 거래 상세, 포트폴리오, Discovery 등 모든 카드형 섹션.
// margin: '0 20px' 일관성으로 너비 통일.

import type { ReactNode } from "react";

type Props = {
  title?: string;
  link?: { href: string; label: string };
  rightAccessory?: ReactNode;
  children: ReactNode;
  padding?: number;
  noMargin?: boolean; // yg-stack 안에 들어갈 때
};

export function YGSectionCard({
  title,
  link,
  rightAccessory,
  children,
  padding = 18,
  noMargin = false,
}: Props) {
  return (
    <div
      className="yg-card"
      style={{
        padding,
        margin: noMargin ? undefined : "12px 20px 0",
      }}
    >
      {(title || rightAccessory) && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 12,
          }}
        >
          {title && (
            <h3
              style={{
                margin: 0,
                fontSize: 18,
                fontWeight: 700,
                letterSpacing: "-0.015em",
                color: "var(--yg-fg-primary)",
              }}
            >
              {title}
            </h3>
          )}
          {link ? (
            <a
              href={link.href}
              style={{
                fontSize: 14,
                fontWeight: 600,
                color: "var(--yg-fg-tertiary)",
                textDecoration: "none",
              }}
            >
              {link.label} ›
            </a>
          ) : (
            rightAccessory
          )}
        </div>
      )}
      {children}
    </div>
  );
}
