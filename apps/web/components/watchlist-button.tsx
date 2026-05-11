"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

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
      const res = await fetch(`/api/watchlist/${encodeURIComponent(symbol)}`, { method });
      if (res.ok) {
        toast.success(watched ? "관심종목 해제됨" : "관심종목 추가됨");
        setWatched(!watched);
      } else {
        const err = await res.json().catch(() => ({}));
        toast.error(`실패: ${err.error ?? "오류"}`);
      }
    });
  }

  return (
    <Button variant="outline" size="sm" onClick={toggle} disabled={isPending}>
      {watched ? "★ 관심종목 해제" : "☆ 관심종목 추가"}
    </Button>
  );
}
