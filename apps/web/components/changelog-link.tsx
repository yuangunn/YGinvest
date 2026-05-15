"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Megaphone } from "lucide-react";
import { getSeenSha } from "@/lib/changelog-state";

/**
 * Plan #27.2: 대시보드/Cmd-K에 표시되는 changelog 바로가기 + NEW 배지.
 * 사용자가 한번도 안 봤거나, latest sha가 마지막으로 본 sha와 다르면 NEW.
 */
export function ChangelogLink({ latestSha }: { latestSha: string | null }) {
  const [showNew, setShowNew] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => {
      if (!latestSha) return;
      const seen = getSeenSha();
      if (seen !== latestSha) setShowNew(true);
    }, 0);
    return () => clearTimeout(t);
  }, [latestSha]);

  return (
    <Link
      href="/app/changelog"
      className="relative inline-flex items-center gap-1.5 text-xs text-primary hover:underline"
    >
      <Megaphone className="h-3.5 w-3.5" />
      업데이트 소식
      {showNew && (
        <span
          className="ml-1 inline-flex items-center gap-0.5 rounded-full bg-red-500 text-white text-[9px] font-bold px-1.5 py-0.5"
          aria-label="새 업데이트 있음"
        >
          NEW
        </span>
      )}
    </Link>
  );
}
