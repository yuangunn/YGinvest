"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { offlineFetch } from "@/lib/offline-fetch";

type Props = {
  themeId: string;
  themeName: string;
  initialFavorited: boolean;
};

export function ThemeFavoriteButton({
  themeId,
  themeName,
  initialFavorited,
}: Props) {
  const [favorited, setFavorited] = useState(initialFavorited);
  const [isPending, startTransition] = useTransition();

  function toggle() {
    startTransition(async () => {
      const method = favorited ? "DELETE" : "POST";
      const wasFav = favorited;
      const result = await offlineFetch("/api/themes/favorite", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ theme_id: themeId }),
      });
      if (result.status === "ok") {
        toast.success(
          wasFav ? `${themeName} 즐겨찾기 해제` : `${themeName} 즐겨찾기 추가`,
        );
        setFavorited(!wasFav);
      } else if (result.status === "queued") {
        toast.info("오프라인 — 연결 시 적용됩니다");
        setFavorited(!wasFav);
      } else {
        toast.error(`실패: ${result.error}`);
      }
    });
  }

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={toggle}
      disabled={isPending}
      title={favorited ? "즐겨찾기 해제" : "즐겨찾기 추가"}
    >
      <Star
        className={`h-3.5 w-3.5 ${favorited ? "fill-yellow-400 text-yellow-400" : ""}`}
      />
      <span className="ml-1">{favorited ? "즐겨찾기됨" : "즐겨찾기"}</span>
    </Button>
  );
}
