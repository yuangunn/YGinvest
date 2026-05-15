"use client";

import { useEffect, useState } from "react";
import { Loader2, Plus, Trash2, NotebookPen } from "lucide-react";
import { Button } from "@/components/ui/button";

type Note = {
  id: string;
  symbol: string | null;
  trade_id: string | null;
  body: string;
  created_at: string;
  updated_at: string;
};

/**
 * Plan #27 C1: 매매일지 / 회고 메모 위젯.
 * - 종목 페이지: symbol prop으로 해당 종목 노트만 로드
 * - 매매분석 페이지: symbol 없이 전체 노트 로드
 *
 * 메모는 종목별 또는 trade_id별로 작성 가능 (스키마는 둘 다 지원).
 * UI에서는 단순화 — symbol 주어지면 종목 단위로만.
 */
export function TradeNotes({
  symbol,
  initialOpen,
}: {
  symbol?: string;
  initialOpen?: boolean;
}) {
  const [open, setOpen] = useState(initialOpen ?? false);
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(false);
  const [body, setBody] = useState("");
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const url = symbol
        ? `/api/trade-notes?symbol=${encodeURIComponent(symbol)}`
        : `/api/trade-notes`;
      const res = await fetch(url);
      if (!res.ok) return;
      const j = (await res.json()) as { notes?: Note[] };
      setNotes(j.notes ?? []);
      setLoaded(true);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!open || loaded) return;
    const t = setTimeout(() => load(), 0);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  async function add() {
    const trimmed = body.trim();
    if (!trimmed || saving) return;
    setSaving(true);
    try {
      const res = await fetch("/api/trade-notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: trimmed, symbol: symbol ?? null }),
      });
      if (res.ok) {
        const j = (await res.json()) as { note: Note };
        setNotes((prev) => [j.note, ...prev]);
        setBody("");
      }
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: string) {
    setNotes((prev) => prev.filter((n) => n.id !== id));
    await fetch(`/api/trade-notes?id=${id}`, { method: "DELETE" });
  }

  function fmtDate(iso: string) {
    return new Date(iso).toLocaleString("ko-KR", {
      month: "numeric",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="w-full inline-flex items-center justify-center gap-1.5 rounded-md border border-dashed px-3 py-2 text-xs text-muted-foreground hover:bg-accent hover:text-foreground"
      >
        <NotebookPen className="h-3.5 w-3.5" />
        매매 일지 열기 {symbol ? `(${symbol})` : "전체"}
      </button>
    );
  }

  return (
    <div className="border rounded-lg p-3 space-y-3">
      <div className="flex items-center justify-between">
        <div className="text-sm font-semibold inline-flex items-center gap-1.5">
          <NotebookPen className="h-4 w-4 text-primary" />
          매매 일지 {symbol && <span className="text-xs text-muted-foreground">({symbol})</span>}
        </div>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-[10px] text-muted-foreground hover:text-foreground"
        >
          접기
        </button>
      </div>

      <div className="space-y-1.5">
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder={
            symbol
              ? `${symbol} 매수/매도 이유, 회고를 기록해보세요 (최대 2000자)`
              : "오늘의 매매 회고, 시장 관찰을 기록해보세요"
          }
          maxLength={2000}
          rows={3}
          className="w-full text-xs rounded-md border bg-background px-2 py-1.5 outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
        />
        <div className="flex items-center justify-between gap-2">
          <span className="text-[10px] text-muted-foreground">
            {body.length}/2000
          </span>
          <Button
            size="sm"
            onClick={add}
            disabled={saving || body.trim().length === 0}
          >
            {saving ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <Plus className="h-3 w-3 mr-0.5" />
            )}
            저장
          </Button>
        </div>
      </div>

      <div className="space-y-1.5">
        {loading && (
          <div className="text-xs text-muted-foreground text-center py-2">
            로딩 중...
          </div>
        )}
        {!loading && notes.length === 0 && (
          <p className="text-[11px] text-muted-foreground text-center py-2">
            아직 메모가 없습니다
          </p>
        )}
        {notes.map((n) => (
          <div
            key={n.id}
            className="group border rounded-md p-2 text-xs hover:bg-muted/30"
          >
            <div className="flex items-start justify-between gap-2 mb-1">
              <span className="text-[10px] text-muted-foreground">
                {fmtDate(n.created_at)}
                {!symbol && n.symbol && (
                  <span className="ml-1.5 inline-flex items-center rounded bg-primary/10 px-1 py-0.5 text-primary text-[9px]">
                    {n.symbol}
                  </span>
                )}
              </span>
              <button
                type="button"
                onClick={() => remove(n.id)}
                className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive"
                aria-label="삭제"
              >
                <Trash2 className="h-3 w-3" />
              </button>
            </div>
            <p className="whitespace-pre-wrap leading-relaxed">{n.body}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
