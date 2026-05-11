"use client";

import { useEffect, useState } from "react";
import { getKrSession, type KrSession } from "@/lib/market-hours";

const LABELS: Record<KrSession, { text: string; tone: string }> = {
  pre: {
    text: "프리마켓",
    tone: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  },
  regular: {
    text: "정규장",
    tone: "bg-green-500/15 text-green-700 dark:text-green-300",
  },
  after: {
    text: "애프터마켓",
    tone: "bg-blue-500/15 text-blue-700 dark:text-blue-300",
  },
  closed: {
    text: "장 마감",
    tone: "bg-muted text-muted-foreground",
  },
};

export function KrSessionBadge() {
  // useState lazy init — "use client" 컴포넌트는 client에서만 mount되므로
  // window 무관하지만 Date() 그대로 안전.
  const [session, setSession] = useState<KrSession>(() => getKrSession());

  useEffect(() => {
    // 1분마다 세션 재평가 (휴장→정규 등 boundary cross 대응)
    const interval = setInterval(() => setSession(getKrSession()), 60_000);
    return () => clearInterval(interval);
  }, []);

  const { text, tone } = LABELS[session];
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${tone}`}
      title="NXT 거래시간 08:00–20:00 KST (휴장 10분 × 2 제외)"
    >
      {text}
    </span>
  );
}
