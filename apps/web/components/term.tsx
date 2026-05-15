"use client";

import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { BookOpen, X } from "lucide-react";
import { GLOSSARY, type GlossaryEntry } from "@/lib/glossary";

type Props = {
  k: string; // term key in GLOSSARY
  children?: React.ReactNode; // 표시할 텍스트 (없으면 entry.term)
  className?: string;
};

type Bounds = { top: number; left: number; width: number };

const POPOVER_W = 320;
const POPOVER_PAD = 16; // viewport edge padding

export function Term({ k, children, className = "" }: Props) {
  const entry = GLOSSARY[k.toLowerCase()];
  const [open, setOpen] = useState(false);
  const [bounds, setBounds] = useState<Bounds | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  // 트리거 좌표 계산 — viewport 안에 fit
  useEffect(() => {
    if (!open) return;
    function update() {
      if (!triggerRef.current) return;
      const r = triggerRef.current.getBoundingClientRect();
      const viewportW = window.innerWidth;
      // popover의 좌측 = trigger 좌측. 단 우측이 viewport를 넘으면 우측에 붙임.
      let left = r.left;
      const maxLeft = viewportW - POPOVER_W - POPOVER_PAD;
      if (left > maxLeft) left = Math.max(POPOVER_PAD, maxLeft);
      if (left < POPOVER_PAD) left = POPOVER_PAD;
      const width = Math.min(POPOVER_W, viewportW - POPOVER_PAD * 2);
      setBounds({
        top: r.bottom + 4,
        left,
        width,
      });
    }
    update();
    window.addEventListener("scroll", update, true);
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update, true);
      window.removeEventListener("resize", update);
    };
  }, [open]);

  // 바깥 클릭 / ESC 닫기
  useEffect(() => {
    if (!open) return;
    function onClickOutside(e: MouseEvent) {
      const target = e.target as Node;
      if (triggerRef.current && triggerRef.current.contains(target)) return;
      const popover = document.getElementById("term-popover");
      if (popover && popover.contains(target)) return;
      setOpen(false);
    }
    function onEsc(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    document.addEventListener("keydown", onEsc);
    return () => {
      document.removeEventListener("mousedown", onClickOutside);
      document.removeEventListener("keydown", onEsc);
    };
  }, [open]);

  if (!entry) {
    return <span className={className}>{children ?? k}</span>;
  }

  const popover =
    open && bounds && typeof document !== "undefined"
      ? createPortal(
          <TermPopover
            entry={entry}
            bounds={bounds}
            onClose={() => setOpen(false)}
          />,
          document.body,
        )
      : null;

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        className={`underline decoration-dotted decoration-primary/60 underline-offset-2 hover:decoration-primary cursor-help ${className}`}
        aria-label={`${entry.term} 정의 보기`}
      >
        {children ?? entry.term}
      </button>
      {popover}
    </>
  );
}

function TermPopover({
  entry,
  bounds,
  onClose,
}: {
  entry: GlossaryEntry;
  bounds: Bounds;
  onClose: () => void;
}) {
  return (
    <div
      id="term-popover"
      role="dialog"
      style={{
        position: "fixed",
        top: bounds.top,
        left: bounds.left,
        width: bounds.width,
        maxHeight: "70vh",
        overflowY: "auto",
        zIndex: 80,
        wordBreak: "keep-all",
      }}
      className="rounded-lg border bg-popover shadow-lg p-3 text-sm text-foreground"
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <span className="font-bold flex items-center gap-1.5 text-primary">
          <BookOpen className="h-3.5 w-3.5" aria-hidden />
          {entry.term}
        </span>
        <button
          type="button"
          onClick={onClose}
          className="text-muted-foreground hover:text-foreground -mr-1 -mt-0.5"
          aria-label="닫기"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
      <p className="text-xs text-muted-foreground italic mb-2">
        {entry.short}
      </p>
      <p
        className="text-xs leading-relaxed whitespace-pre-line"
        style={{ wordBreak: "keep-all" }}
      >
        {entry.detail}
      </p>
      {entry.formula && (
        <p className="mt-2 text-[11px] font-mono bg-muted/50 rounded px-2 py-1">
          {entry.formula}
        </p>
      )}
      {entry.example && (
        <p className="mt-2 text-[11px] text-muted-foreground">
          📌 {entry.example}
        </p>
      )}
      {entry.related && entry.related.length > 0 && (
        <div className="mt-2 pt-2 border-t flex flex-wrap gap-1">
          {entry.related.map((r) => {
            const rel = GLOSSARY[r];
            if (!rel) return null;
            return (
              <Link
                key={r}
                href={`/app/learn/glossary#${r}`}
                onClick={onClose}
                className="text-[10px] rounded-full bg-primary/10 text-primary px-2 py-0.5 hover:bg-primary/20"
              >
                {rel.term.split(" ")[0]}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
