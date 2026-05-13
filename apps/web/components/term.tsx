"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { BookOpen, X } from "lucide-react";
import { GLOSSARY, type GlossaryEntry } from "@/lib/glossary";

type Props = {
  k: string; // term key in GLOSSARY
  children?: React.ReactNode; // 표시할 텍스트 (없으면 entry.term)
  className?: string;
};

export function Term({ k, children, className = "" }: Props) {
  const entry = GLOSSARY[k.toLowerCase()];
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!open) return;
    function onClickOutside(e: MouseEvent) {
      if (
        wrapperRef.current &&
        !wrapperRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
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
    // 사전에 없는 키 — 그냥 children만 렌더
    return <span className={className}>{children ?? k}</span>;
  }

  return (
    <span ref={wrapperRef} className="relative inline-block">
      <button
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
      {open && <TermPopover entry={entry} onClose={() => setOpen(false)} />}
    </span>
  );
}

function TermPopover({
  entry,
  onClose,
}: {
  entry: GlossaryEntry;
  onClose: () => void;
}) {
  return (
    <span
      role="dialog"
      className="absolute z-50 left-0 top-full mt-1 w-[320px] max-w-[calc(100vw-2rem)] rounded-lg border bg-popover shadow-lg p-3 text-sm text-foreground"
      style={{ wordBreak: "keep-all" }}
    >
      <span className="flex items-start justify-between gap-2 mb-2">
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
      </span>
      <span className="block text-xs text-muted-foreground italic mb-2">
        {entry.short}
      </span>
      <span
        className="block text-xs leading-relaxed whitespace-pre-line"
        style={{ wordBreak: "keep-all" }}
      >
        {entry.detail}
      </span>
      {entry.formula && (
        <span className="block mt-2 text-[11px] font-mono bg-muted/50 rounded px-2 py-1">
          {entry.formula}
        </span>
      )}
      {entry.example && (
        <span className="block mt-2 text-[11px] text-muted-foreground">
          📌 {entry.example}
        </span>
      )}
      {entry.related && entry.related.length > 0 && (
        <span className="block mt-2 pt-2 border-t flex flex-wrap gap-1">
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
        </span>
      )}
      <Link
        href={`/app/learn/glossary#${Object.keys(GLOSSARY).find((k) => GLOSSARY[k] === entry)}`}
        onClick={onClose}
        className="block mt-2 text-[10px] text-primary hover:underline text-right"
      >
        용어사전 전체 보기 →
      </Link>
    </span>
  );
}
