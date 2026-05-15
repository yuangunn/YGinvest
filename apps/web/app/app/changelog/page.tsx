import { redirect } from "next/navigation";
import {
  Megaphone,
  Sparkles,
  Wrench,
  Zap,
  Recycle,
  Undo2,
  AlertTriangle,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent } from "@/components/ui/card";
import changelogData from "@/lib/changelog-data.json";
import { ChangelogMarker } from "@/components/changelog-marker";

type ChangelogEntry = {
  sha: string;
  date: string;
  type: string;
  scope: string | null;
  breaking: boolean;
  title: string;
  description: string | null;
};

const TYPE_META: Record<
  string,
  { label: string; emoji: string; Icon: typeof Sparkles; color: string }
> = {
  feat: {
    label: "신규 기능",
    emoji: "✨",
    Icon: Sparkles,
    color: "text-green-600 dark:text-green-500 bg-green-500/10 border-green-500/30",
  },
  fix: {
    label: "버그 수정",
    emoji: "🐞",
    Icon: Wrench,
    color: "text-blue-600 dark:text-blue-500 bg-blue-500/10 border-blue-500/30",
  },
  perf: {
    label: "성능 개선",
    emoji: "⚡",
    Icon: Zap,
    color: "text-amber-600 dark:text-amber-500 bg-amber-500/10 border-amber-500/30",
  },
  refactor: {
    label: "리팩터",
    emoji: "♻️",
    Icon: Recycle,
    color: "text-purple-600 dark:text-purple-500 bg-purple-500/10 border-purple-500/30",
  },
  revert: {
    label: "되돌림",
    emoji: "↩️",
    Icon: Undo2,
    color: "text-muted-foreground bg-muted border",
  },
};

function relativeDate(iso: string): string {
  const ms = new Date().getTime() - new Date(iso).getTime();
  const minutes = Math.floor(ms / 60_000);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  if (minutes < 1) return "방금";
  if (minutes < 60) return `${minutes}분 전`;
  if (hours < 24) return `${hours}시간 전`;
  if (days < 7) return `${days}일 전`;
  const weeks = Math.floor(days / 7);
  if (weeks < 4) return `${weeks}주 전`;
  return new Date(iso).toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function groupByMonth(entries: ChangelogEntry[]) {
  const groups = new Map<string, ChangelogEntry[]>();
  for (const e of entries) {
    const d = new Date(e.date);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const arr = groups.get(key) ?? [];
    arr.push(e);
    groups.set(key, arr);
  }
  return [...groups.entries()];
}

function formatMonth(key: string): string {
  const [y, m] = key.split("-");
  return `${y}년 ${Number(m)}월`;
}

export default async function ChangelogPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const entries = changelogData as ChangelogEntry[];
  const latestSha = entries[0]?.sha ?? null;
  const grouped = groupByMonth(entries);

  return (
    <div className="max-w-3xl mx-auto p-4 space-y-4">
      <ChangelogMarker latestSha={latestSha} />
      <div>
        <h1 className="text-xl font-bold flex items-center gap-2">
          <Megaphone className="h-5 w-5 text-primary" />
          업데이트 소식
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          최근 적용된 변경사항. 신규 기능 / 버그 수정 / 성능 개선 위주.
        </p>
      </div>

      {entries.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            아직 표시할 업데이트가 없습니다.
          </CardContent>
        </Card>
      ) : (
        grouped.map(([monthKey, monthEntries]) => (
          <section key={monthKey} className="space-y-2">
            <h2 className="text-sm font-semibold text-muted-foreground sticky top-0 bg-background py-1">
              {formatMonth(monthKey)}
            </h2>
            <div className="space-y-2">
              {monthEntries.map((e) => (
                <Entry key={e.sha} entry={e} />
              ))}
            </div>
          </section>
        ))
      )}

      <p className="text-[10px] text-muted-foreground text-center pt-4 border-t">
        Git commit log 기반 자동 생성. 사소한 chore / docs 변경은 표시되지
        않습니다.
      </p>
    </div>
  );
}

function Entry({ entry }: { entry: ChangelogEntry }) {
  const meta = TYPE_META[entry.type] ?? TYPE_META.feat;
  return (
    <Card>
      <CardContent className="py-3 space-y-1.5">
        <div className="flex items-start justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2 flex-wrap min-w-0 flex-1">
            <span
              className={`inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10px] font-semibold ${meta.color}`}
            >
              <meta.Icon className="h-3 w-3" />
              {meta.label}
            </span>
            {entry.scope && (
              <span className="text-[10px] text-muted-foreground font-mono">
                {entry.scope}
              </span>
            )}
            {entry.breaking && (
              <span className="inline-flex items-center gap-1 rounded-md border border-red-500/40 bg-red-500/10 text-red-500 px-1.5 py-0.5 text-[10px] font-semibold">
                <AlertTriangle className="h-3 w-3" />
                Breaking
              </span>
            )}
          </div>
          <span className="text-[10px] text-muted-foreground flex-shrink-0">
            {relativeDate(entry.date)}
          </span>
        </div>
        <h3 className="text-sm font-medium leading-snug">{entry.title}</h3>
        {entry.description && (
          <details className="text-xs">
            <summary className="cursor-pointer text-muted-foreground hover:text-foreground select-none">
              상세 보기
            </summary>
            <pre className="whitespace-pre-wrap mt-2 text-[11px] leading-relaxed text-muted-foreground bg-muted/50 rounded p-2 overflow-x-auto">
              {entry.description}
            </pre>
          </details>
        )}
      </CardContent>
    </Card>
  );
}
