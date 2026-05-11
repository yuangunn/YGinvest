"use client";

import { useTheme } from "next-themes";
import { Monitor, Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";

// SSR에서는 theme이 undefined이므로 useTheme 호출 자체가 client-only여야 함.
// dynamic import + ssr:false 대신, client에서만 mount된 후 상태 표시.
// useState lazy init은 "Calling setState synchronously within an effect"
// 룰을 피함 — 함수 initializer는 1회만 실행됨.
export function ThemeToggle() {
  const { theme, setTheme, resolvedTheme } = useTheme();
  // mounted 추적 대신 resolvedTheme의 존재로 판정 (next-themes는 마운트 후에만 set)
  const active = theme ?? resolvedTheme;

  const next =
    active === "light" ? "dark" : active === "dark" ? "system" : "light";
  const Icon =
    active === "light" ? Sun : active === "dark" ? Moon : Monitor;

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={() => setTheme(next)}
      title={active ? `현재: ${active} → 다음: ${next}` : "테마"}
      aria-label={active ? `테마 토글 (현재: ${active})` : "테마 토글"}
    >
      <Icon className="h-4 w-4" />
    </Button>
  );
}
