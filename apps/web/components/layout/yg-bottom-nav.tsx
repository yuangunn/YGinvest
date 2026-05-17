"use client";

// Plan #42: YG 하단 탭바 — 5개 (홈/거래/보유/게임/내정보).
// Safe-area inset 적용 (제스처 영역 회피).

import Link from "next/link";
import { usePathname } from "next/navigation";
import { YGIcon } from "@/components/yg/icon";

type Tab = {
  key: string;
  label: string;
  href: string;
  Icon: typeof YGIcon.Briefcase;
  matcher: (path: string) => boolean;
};

const TABS: Tab[] = [
  {
    key: "home",
    label: "홈",
    href: "/app/dashboard",
    Icon: YGIcon.Home,
    matcher: (p) => p === "/app/dashboard" || p === "/app",
  },
  {
    key: "trade",
    label: "거래",
    href: "/app/trade/search",
    Icon: YGIcon.Search,
    matcher: (p) => p.startsWith("/app/trade"),
  },
  {
    key: "holdings",
    label: "보유",
    href: "/app/portfolio/overview",
    Icon: YGIcon.Chart,
    matcher: (p) => p.startsWith("/app/portfolio") || p.startsWith("/app/watchlist"),
  },
  {
    key: "game",
    label: "게임",
    href: "/app/roguelike",
    Icon: YGIcon.Game,
    matcher: (p) => p.startsWith("/app/roguelike"),
  },
  {
    key: "me",
    label: "내정보",
    href: "/app/settings",
    Icon: YGIcon.Settings,
    matcher: (p) =>
      p.startsWith("/app/settings") ||
      p.startsWith("/app/changelog") ||
      p.startsWith("/app/help"),
  },
];

export function YGBottomNav() {
  const pathname = usePathname();
  return (
    <nav
      aria-label="모바일 하단 네비게이션"
      style={{
        position: "fixed",
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 40,
        background: "var(--yg-bg-card)",
        borderTop: "1px solid var(--yg-line)",
        // 하단 safe area (iOS home indicator)
        paddingBottom: "max(env(safe-area-inset-bottom), 6px)",
      }}
    >
      <ul
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(5, 1fr)",
          margin: 0,
          padding: 0,
          listStyle: "none",
        }}
      >
        {TABS.map((t) => {
          const isActive = t.matcher(pathname);
          const Icon = t.Icon;
          return (
            <li key={t.key}>
              <Link
                href={t.href}
                aria-current={isActive ? "page" : undefined}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 3,
                  padding: "10px 0 6px",
                  textDecoration: "none",
                  color: isActive
                    ? "var(--yg-fg-primary)"
                    : "var(--yg-fg-tertiary)",
                  transition: "color 120ms ease",
                }}
              >
                <Icon s={22} c="currentColor" />
                <span
                  style={{
                    fontSize: 10.5,
                    fontWeight: isActive ? 800 : 600,
                    letterSpacing: "-0.01em",
                  }}
                >
                  {t.label}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
