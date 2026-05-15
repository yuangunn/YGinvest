"use client";

import { useEffect } from "react";
import { pushRecent } from "@/lib/recent-stocks";

/**
 * Plan #27 B3: 종목 페이지 진입 시 localStorage에 최근 본 종목 기록.
 * 페이지에 한 줄만 추가하면 됨.
 */
export function RecentTracker({
  symbol,
  name,
}: {
  symbol: string;
  name: string;
}) {
  useEffect(() => {
    const t = setTimeout(() => pushRecent({ symbol, name }), 0);
    return () => clearTimeout(t);
  }, [symbol, name]);
  return null;
}
