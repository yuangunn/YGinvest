"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { offlineFetch } from "@/lib/offline-fetch";

type Props = {
  symbol: string;
  initialWatched: boolean;
};

export function WatchlistButton({ symbol, initialWatched }: Props) {
  const [watched, setWatched] = useState(initialWatched);
  const [isPending, startTransition] = useTransition();

  function toggle() {
    startTransition(async () => {
      const method = watched ? "DELETE" : "POST";
      const wasWatched = watched;
      const result = await offlineFetch(
        `/api/watchlist/${encodeURIComponent(symbol)}`,
        { method },
      );
      if (result.status === "ok") {
        toast.success(wasWatched ? "관심종목 해제됨" : "관심종목 추가됨");
        setWatched(!wasWatched);
      } else if (result.status === "queued") {
        toast.info(
          wasWatched
            ? "오프라인 — 연결 시 관심종목 해제됩니다"
            : "오프라인 — 연결 시 관심종목 추가됩니다",
        );
        // optimistic toggle — sync 시 실제 적용
        setWatched(!wasWatched);
      } else {
        toast.error(`실패: ${result.error}`);
      }
    });
  }

  return (
    <Button variant="outline" size="sm" onClick={toggle} disabled={isPending}>
      {watched ? "★ 관심종목 해제" : "☆ 관심종목 추가"}
    </Button>
  );
}
