"use client";

import { useState, useTransition } from "react";
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
        setWatched(!watched);
      } else {
        const err = await res.json().catch(() => ({}));
        alert(err.error ?? "오류");
      }
    });
  }

  return (
    <Button variant="outline" size="sm" onClick={toggle} disabled={isPending}>
      {watched ? "★ 관심종목 해제" : "☆ 관심종목 추가"}
    </Button>
  );
}
