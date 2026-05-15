"use client";

import { useEffect, useState } from "react";
import {
  getKrMarketStatus,
  getUsMarketStatus,
  type MarketStatus,
} from "@/lib/market-hours-client";

/**
 * Plan #27 B2: 헤더에 표시되는 마켓 상태 라이브 인디케이터.
 * - KR / US 두 시장 동시 표시
 * - 1분마다 자동 갱신
 */
export function MarketStatusBar() {
  const [kr, setKr] = useState<MarketStatus | null>(null);
  const [us, setUs] = useState<MarketStatus | null>(null);

  useEffect(() => {
    function refresh() {
      const now = new Date();
      setKr(getKrMarketStatus(now));
      setUs(getUsMarketStatus(now));
    }
    const t = setTimeout(refresh, 0);
    const id = setInterval(refresh, 60_000);
    return () => {
      clearTimeout(t);
      clearInterval(id);
    };
  }, []);

  if (!kr || !us) return null;

  return (
    <div className="px-4 py-1.5 border-b text-[11px] bg-muted/30 flex items-center gap-4 overflow-x-auto">
      <Pill status={kr} label="KR" />
      <Pill status={us} label="US" />
    </div>
  );
}

function Pill({ status, label }: { status: MarketStatus; label: string }) {
  const dot =
    status.state === "open"
      ? "bg-green-500"
      : status.state === "pre"
        ? "bg-amber-500"
        : "bg-muted-foreground/50";
  const text =
    status.state === "open"
      ? "text-green-600 dark:text-green-500"
      : "text-muted-foreground";
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
      <span
        className={`inline-block w-1.5 h-1.5 rounded-full ${dot} ${
          status.state === "open" ? "animate-pulse" : ""
        }`}
        aria-hidden
      />
      <span className="font-semibold">{label}</span>
      <span className={text}>{status.message}</span>
    </span>
  );
}
