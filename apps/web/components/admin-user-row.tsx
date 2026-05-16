"use client";

import { useState } from "react";
import { Loader2, ShieldCheck, ShieldOff } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Plan #29: 사용자 1명의 admin 권한 토글 행.
 */
export function AdminUserRow({
  userId,
  displayName,
  isAdmin,
  isSelf,
  createdAt,
}: {
  userId: string;
  displayName: string;
  isAdmin: boolean;
  isSelf: boolean;
  createdAt: string;
}) {
  const [admin, setAdmin] = useState(isAdmin);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function toggle() {
    const next = !admin;
    if (isSelf && admin) {
      const ok = confirm(
        "본인의 관리자 권한을 회수하시겠습니까?\n" +
          "회수 후 다시 부여하려면 다른 관리자 또는 Supabase Dashboard가 필요합니다.",
      );
      if (!ok) return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/admin/users?id=${encodeURIComponent(userId)}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ is_admin: next }),
        },
      );
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setError(j.error ?? `HTTP ${res.status}`);
        return;
      }
      setAdmin(next);
    } catch (e) {
      setError(e instanceof Error ? e.message : "error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex items-center justify-between gap-2 rounded-md border bg-muted/20 px-3 py-2">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="font-medium text-sm truncate">{displayName}</span>
          {isSelf && (
            <span className="text-[9px] text-primary font-semibold">(나)</span>
          )}
          {admin && (
            <span className="inline-flex items-center gap-0.5 text-[9px] rounded border border-purple-500/40 bg-purple-500/10 text-purple-600 dark:text-purple-400 px-1 py-0.5 font-semibold">
              <ShieldCheck className="h-2.5 w-2.5" />
              ADMIN
            </span>
          )}
        </div>
        <div className="text-[10px] text-muted-foreground font-mono">
          {userId.slice(0, 8)}... ·{" "}
          {new Date(createdAt).toLocaleDateString("ko-KR")} 가입
        </div>
        {error && (
          <div className="text-[10px] text-destructive mt-0.5">{error}</div>
        )}
      </div>
      <Button
        size="sm"
        variant={admin ? "outline" : "default"}
        onClick={toggle}
        disabled={loading}
        className="flex-shrink-0"
      >
        {loading ? (
          <Loader2 className="h-3 w-3 animate-spin" />
        ) : admin ? (
          <>
            <ShieldOff className="h-3 w-3 mr-1" />
            권한 회수
          </>
        ) : (
          <>
            <ShieldCheck className="h-3 w-3 mr-1" />
            관리자 지정
          </>
        )}
      </Button>
    </div>
  );
}
