"use client";

import { useEffect, useState } from "react";
import {
  getKrMarketStatus,
  getUsMarketStatus,
} from "@/lib/market-hours-client";

/**
 * Plan #27 D2: 가격 데이터 신선도 표시.
 * - 장중인데 5분 이상 stale이면 노란 경고
 * - 장 마감 후엔 신선도 표시 안 함 (의미 없음)
 */
export function FreshnessIndicator({
  lastFetchedAt,
  market,
}: {
  lastFetchedAt: string | null;
  market: string;
}) {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    const t = setTimeout(() => setNow(new Date().getTime()), 0);
    const id = setInterval(() => setNow(new Date().getTime()), 60_000);
    return () => {
      clearTimeout(t);
      clearInterval(id);
    };
  }, []);
  if (now === null) return null;

  if (!lastFetchedAt) return null;
  const stamp = new Date(lastFetchedAt).getTime();
  const ageMin = Math.floor((now - stamp) / 60_000);

  // 시장 상태 — 장중일 때만 stale 경고 표시
  const isUs = market === "NASDAQ" || market === "NYSE";
  const status = isUs ? getUsMarketStatus() : getKrMarketStatus();
  const isOpen = status.state === "open";

  // 장중 + 5분 이상 stale = 경고
  if (isOpen && ageMin >= 5) {
    return (
      <span
        className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-md bg-amber-500/15 text-amber-600 dark:text-amber-400"
        title="장중이지만 데이터가 5분 이상 갱신되지 않았습니다"
      >
        <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
        {ageMin}분 전
      </span>
    );
  }
  // 장중 + fresh
  if (isOpen) {
    return (
      <span
        className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-md bg-green-500/15 text-green-600 dark:text-green-500"
        title="장중 실시간 갱신"
      >
        <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
        실시간
      </span>
    );
  }
  // 장 외: 마지막 거래 종가
  return (
    <span
      className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-md bg-muted text-muted-foreground"
      title={status.message}
    >
      장 마감 · {ageMin < 60 ? `${ageMin}분 전` : `${Math.floor(ageMin / 60)}시간 전`}
    </span>
  );
}
