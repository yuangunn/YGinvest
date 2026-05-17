"use client";

// Plan #45: YG 스타일 테마 토글 (라이트 / 다크 / 시스템).
// 헤더에 사이즈 20px 아이콘으로 들어가는 minimal 버튼.

import { useTheme } from "next-themes";
import { useEffect, useState } from "react";

export function ThemeToggleYG() {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  // next-themes는 SSR에서 theme이 undefined — hydration mismatch 방지.
  useEffect(() => {
    setMounted(true);
  }, []);

  const active = mounted ? (theme ?? resolvedTheme) : "light";
  const next =
    active === "light" ? "dark" : active === "dark" ? "system" : "light";

  return (
    <button
      type="button"
      onClick={() => setTheme(next)}
      title={mounted ? `테마: ${active} → ${next}` : "테마 토글"}
      aria-label={mounted ? `테마 토글 (현재: ${active})` : "테마 토글"}
      style={{
        all: "unset",
        cursor: "pointer",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: 20,
        height: 20,
        color: "var(--yg-fg-secondary)",
      }}
    >
      {/* 아이콘은 active 상태에 따라 변경. 마운트 전엔 sun을 기본으로 표시(라이트 모드 기본). */}
      {active === "dark" ? (
        // Moon
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
        </svg>
      ) : active === "system" ? (
        // Monitor
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="2" y="3" width="20" height="14" rx="2" />
          <line x1="8" y1="21" x2="16" y2="21" />
          <line x1="12" y1="17" x2="12" y2="21" />
        </svg>
      ) : (
        // Sun
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
        </svg>
      )}
    </button>
  );
}
