"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";

export function InviteCodeDisplay({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // 클립보드 차단된 환경 — 사용자가 직접 선택해야
    }
  }

  return (
    <div className="flex items-center gap-2">
      <code className="font-mono text-2xl bg-muted px-3 py-1 rounded">{code}</code>
      <Button size="sm" variant="outline" onClick={copy}>
        {copied ? "복사됨!" : "복사"}
      </Button>
    </div>
  );
}
