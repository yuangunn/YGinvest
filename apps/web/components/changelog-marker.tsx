"use client";

import { useEffect } from "react";
import { markSeenSha } from "@/lib/changelog-state";

/**
 * Plan #27.2: changelog 페이지 진입 시 latest sha 기록.
 * dashboard의 "NEW" 배지가 사라지게 함.
 */
export function ChangelogMarker({ latestSha }: { latestSha: string | null }) {
  useEffect(() => {
    if (!latestSha) return;
    const t = setTimeout(() => markSeenSha(latestSha), 0);
    return () => clearTimeout(t);
  }, [latestSha]);
  return null;
}
