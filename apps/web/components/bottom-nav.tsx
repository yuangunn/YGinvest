"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS: { href: string; label: string; icon: string }[] = [
  { href: "/app/dashboard", label: "홈", icon: "🏠" },
  { href: "/app/trade/search", label: "거래", icon: "💱" },
  { href: "/app/portfolio/overview", label: "자산", icon: "📊" },
  { href: "/app/learn", label: "학습", icon: "📚" },
  { href: "/app/settings", label: "설정", icon: "⚙️" },
];

function isActive(pathname: string, href: string): boolean {
  // 그룹 prefix 매칭: /app/portfolio/* → 자산, /app/trade/* → 거래
  if (href === "/app/portfolio/overview") {
    return pathname.startsWith("/app/portfolio");
  }
  if (href === "/app/trade/search") {
    return pathname.startsWith("/app/trade");
  }
  if (href === "/app/learn") {
    return pathname.startsWith("/app/learn");
  }
  return pathname.startsWith(href);
}

export function BottomNav() {
  const pathname = usePathname();
  return (
    <nav
      aria-label="모바일 하단 네비게이션"
      className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-background/95 backdrop-blur border-t border-border"
      style={{ paddingBottom: "env(safe-area-inset-bottom, 0)" }}
    >
      <ul className="flex">
        {TABS.map((t) => {
          const active = isActive(pathname, t.href);
          return (
            <li key={t.href} className="flex-1">
              <Link
                href={t.href}
                aria-current={active ? "page" : undefined}
                className={`flex flex-col items-center gap-0.5 py-2 text-xs ${
                  active
                    ? "text-foreground font-medium"
                    : "text-muted-foreground"
                }`}
              >
                <span className="text-base leading-none" aria-hidden>
                  {t.icon}
                </span>
                <span>{t.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
