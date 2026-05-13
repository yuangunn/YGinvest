"use client";

import { useEffect, useRef } from "react";
import { useRouter, usePathname } from "next/navigation";

/**
 * Plan #24 — 모바일 swipe 제스처로 bottom-nav 탭 간 좌우 이동.
 * 가로 스와이프 > 100px 또는 속도 > 0.3px/ms 시 발동.
 * 세로 스크롤과 충돌 방지: 가로 변위 > 세로 변위 × 1.5 일 때만.
 */

const TABS = [
  "/app/dashboard",
  "/app/trade/search",
  "/app/portfolio/overview",
  "/app/learn",
  "/app/settings",
];

function currentIdx(path: string): number {
  if (path.startsWith("/app/dashboard")) return 0;
  if (path.startsWith("/app/trade")) return 1;
  if (path.startsWith("/app/portfolio")) return 2;
  if (path.startsWith("/app/learn")) return 3;
  if (path.startsWith("/app/settings")) return 4;
  return -1;
}

export function SwipeNav() {
  const router = useRouter();
  const pathname = usePathname();
  const startRef = useRef<{ x: number; y: number; t: number } | null>(null);

  useEffect(() => {
    function onStart(e: TouchEvent) {
      if (e.touches.length !== 1) return;
      startRef.current = {
        x: e.touches[0].clientX,
        y: e.touches[0].clientY,
        t: Date.now(),
      };
    }
    function onEnd(e: TouchEvent) {
      const start = startRef.current;
      startRef.current = null;
      if (!start) return;
      const touch = e.changedTouches[0];
      const dx = touch.clientX - start.x;
      const dy = touch.clientY - start.y;
      const dt = Date.now() - start.t;
      const ax = Math.abs(dx);
      const ay = Math.abs(dy);
      // 충분히 가로 + 너무 세로 X
      if (ax < 60 || ax < ay * 1.5) return;
      // 속도가 너무 느리고 거리도 짧으면 무시
      if (dt > 500 && ax < 120) return;
      // 가장자리에서 시작하지 않은 경우 (브라우저 swipe 충돌 방지)
      if (start.x < 20 || start.x > window.innerWidth - 20) return;
      // 입력 요소 위 swipe는 무시
      const target = e.target as HTMLElement;
      if (
        target.closest(
          "input, textarea, select, button, [contenteditable], canvas, [role=dialog]",
        )
      ) {
        return;
      }

      const idx = currentIdx(pathname);
      if (idx === -1) return;

      const next = dx < 0 ? idx + 1 : idx - 1;
      if (next < 0 || next >= TABS.length) return;
      router.push(TABS[next]);
    }

    document.addEventListener("touchstart", onStart, { passive: true });
    document.addEventListener("touchend", onEnd);
    return () => {
      document.removeEventListener("touchstart", onStart);
      document.removeEventListener("touchend", onEnd);
    };
  }, [pathname, router]);

  return null;
}
