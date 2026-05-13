"use client";

import { useEffect, useState, useRef } from "react";
import { RefreshCw } from "lucide-react";

/**
 * Plan #23 — Pull-to-refresh for mobile PWA.
 * touchstart at scrollTop=0, then pull down past threshold → refresh.
 */
const THRESHOLD = 80;

export function PullToRefresh() {
  const [pull, setPull] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const startY = useRef<number | null>(null);

  useEffect(() => {
    function onTouchStart(e: TouchEvent) {
      if (window.scrollY > 0) return;
      startY.current = e.touches[0].clientY;
    }
    function onTouchMove(e: TouchEvent) {
      if (startY.current === null) return;
      if (window.scrollY > 0) {
        startY.current = null;
        setPull(0);
        return;
      }
      const dy = e.touches[0].clientY - startY.current;
      if (dy > 0) {
        // damping factor — 거리 빨라질수록 천천히 커짐
        const damped = Math.min(dy * 0.5, THRESHOLD * 1.5);
        setPull(damped);
      }
    }
    function onTouchEnd() {
      if (pull >= THRESHOLD) {
        setRefreshing(true);
        // 짧은 지연 후 새로고침 (animation 보임)
        setTimeout(() => {
          window.location.reload();
        }, 300);
      } else {
        setPull(0);
      }
      startY.current = null;
    }
    document.addEventListener("touchstart", onTouchStart, { passive: true });
    document.addEventListener("touchmove", onTouchMove, { passive: true });
    document.addEventListener("touchend", onTouchEnd);
    return () => {
      document.removeEventListener("touchstart", onTouchStart);
      document.removeEventListener("touchmove", onTouchMove);
      document.removeEventListener("touchend", onTouchEnd);
    };
  }, [pull]);

  if (pull === 0 && !refreshing) return null;

  const progress = Math.min(pull / THRESHOLD, 1);
  const ready = pull >= THRESHOLD;

  return (
    <div
      className="fixed top-0 inset-x-0 z-30 flex justify-center pointer-events-none"
      style={{
        transform: `translateY(${refreshing ? 12 : Math.max(0, pull - 24)}px)`,
        transition: refreshing ? "transform 0.2s" : "none",
      }}
    >
      <div className="rounded-full bg-background border shadow-sm px-3 py-1.5 text-xs flex items-center gap-1.5">
        <RefreshCw
          className={`h-3 w-3 ${refreshing ? "animate-spin" : ""}`}
          style={{
            transform: refreshing ? "none" : `rotate(${progress * 180}deg)`,
            transition: refreshing ? "none" : "transform 0.1s",
          }}
        />
        <span className={ready ? "text-primary font-medium" : "text-muted-foreground"}>
          {refreshing ? "새로고침..." : ready ? "놓으면 새로고침" : "당겨서 새로고침"}
        </span>
      </div>
    </div>
  );
}
