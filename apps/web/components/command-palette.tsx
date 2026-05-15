"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Search,
  ArrowRight,
  History,
  Activity,
  Award,
  BookOpen,
  Brain,
  Calendar,
  Coins,
  GitCompare,
  LineChart,
  Megaphone,
  PieChart,
  Sparkles,
  Tags,
  Grid3x3,
  Users,
  Bell,
  Smartphone,
  Wallet,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { getRecent } from "@/lib/recent-stocks";

type SearchResult = {
  symbol: string;
  name: string;
  name_ko: string | null;
  market: string;
};

type NavLink = {
  label: string;
  href: string;
  group: string;
  Icon: React.ComponentType<{ className?: string }>;
};

const NAV_LINKS: NavLink[] = [
  { label: "검색", href: "/app/trade/search", group: "거래", Icon: Search },
  { label: "큐레이션", href: "/app/curation", group: "거래", Icon: Sparkles },
  { label: "테마주", href: "/app/themes", group: "거래", Icon: Tags },
  { label: "섹터", href: "/app/sectors", group: "거래", Icon: Grid3x3 },
  { label: "실적", href: "/app/earnings", group: "거래", Icon: Calendar },
  { label: "유명 전략", href: "/app/strategies", group: "거래", Icon: Award },
  { label: "포트폴리오", href: "/app/portfolio/overview", group: "자산", Icon: Wallet },
  { label: "매매분석", href: "/app/portfolio/analysis", group: "자산", Icon: LineChart },
  { label: "행동분석", href: "/app/portfolio/behavior", group: "자산", Icon: Brain },
  { label: "vs 인덱스 비교", href: "/app/portfolio/what-if", group: "자산", Icon: GitCompare },
  { label: "가상 매수 계산", href: "/app/whatif", group: "자산", Icon: GitCompare },
  { label: "시나리오", href: "/app/portfolio/scenarios", group: "자산", Icon: Activity },
  { label: "자산배분", href: "/app/portfolio/allocation", group: "자산", Icon: PieChart },
  { label: "배당시뮬", href: "/app/portfolio/dividend-sim", group: "자산", Icon: Coins },
  { label: "백테스트", href: "/app/backtest", group: "분석", Icon: LineChart },
  { label: "상관관계", href: "/app/correlation", group: "분석", Icon: Grid3x3 },
  { label: "거시경제", href: "/app/macro", group: "경제 학습", Icon: Activity },
  { label: "경제 캘린더", href: "/app/macro/calendar", group: "경제 학습", Icon: Calendar },
  { label: "경제 사건", href: "/app/macro/history", group: "경제 학습", Icon: BookOpen },
  { label: "학습", href: "/app/learn", group: "학습", Icon: BookOpen },
  { label: "용어사전", href: "/app/learn/glossary", group: "학습", Icon: BookOpen },
  { label: "친구방", href: "/app/rooms", group: "기타", Icon: Users },
  { label: "환전", href: "/app/fx", group: "기타", Icon: Coins },
  { label: "알림 설정", href: "/app/settings", group: "기타", Icon: Bell },
  { label: "AI 키 등록", href: "/app/settings/ai", group: "기타", Icon: Sparkles },
  { label: "앱 설치", href: "/app/help/install", group: "기타", Icon: Smartphone },
  { label: "업데이트 소식", href: "/app/changelog", group: "기타", Icon: Megaphone },
];

/**
 * Plan #27 B1: Cmd+K / Ctrl+K 명령 팔레트.
 * - 어디서든 단축키로 검색 + 페이지 점프
 * - 종목명/심볼 검색 + 네비게이션 메뉴 fuzzy 매칭
 * - 최근 본 종목 표시
 */
export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [stockResults, setStockResults] = useState<SearchResult[]>([]);
  const [recent, setRecent] = useState<{ symbol: string; name: string }[]>([]);
  const [activeIdx, setActiveIdx] = useState(0);
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);

  // 전역 단축키 등록
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      } else if (e.key === "Escape") {
        setOpen(false);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // 열릴 때 최근 종목 로드 + 포커스 + 검색 초기화
  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => {
      setRecent(getRecent());
      setQ("");
      setActiveIdx(0);
      inputRef.current?.focus();
    }, 10);
    return () => clearTimeout(t);
  }, [open]);

  // 디바운스 종목 검색
  useEffect(() => {
    const t = setTimeout(async () => {
      const trimmed = q.trim();
      if (trimmed.length === 0) {
        setStockResults([]);
        return;
      }
      try {
        const res = await fetch(
          `/api/stocks/search?q=${encodeURIComponent(trimmed)}`,
        );
        if (!res.ok) {
          setStockResults([]);
          return;
        }
        const json = (await res.json()) as { results?: SearchResult[] };
        setStockResults((json.results ?? []).slice(0, 8));
      } catch {
        setStockResults([]);
      }
    }, 200);
    return () => clearTimeout(t);
  }, [q]);

  // 필터링된 nav links
  const filteredNav = q.trim()
    ? NAV_LINKS.filter((n) =>
        n.label.toLowerCase().includes(q.trim().toLowerCase()),
      )
    : NAV_LINKS.slice(0, 8);

  type Item =
    | { type: "stock"; symbol: string; name: string; sub?: string }
    | { type: "recent"; symbol: string; name: string }
    | { type: "nav"; link: NavLink };

  const items: Item[] = [
    ...(q.trim() === ""
      ? recent.map<Item>((r) => ({
          type: "recent",
          symbol: r.symbol,
          name: r.name,
        }))
      : []),
    ...stockResults.map<Item>((s) => ({
      type: "stock",
      symbol: s.symbol,
      name: s.name_ko ?? s.name,
      sub: `${s.symbol} · ${s.market}`,
    })),
    ...filteredNav.map<Item>((n) => ({ type: "nav", link: n })),
  ];

  const go = useCallback(
    (item: Item) => {
      setOpen(false);
      if (item.type === "stock" || item.type === "recent") {
        router.push(`/app/trade/${encodeURIComponent(item.symbol)}`);
      } else {
        router.push(item.link.href);
      }
    },
    [router],
  );

  function onInputKey(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIdx((i) => Math.min(i + 1, items.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIdx((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const it = items[activeIdx];
      if (it) go(it);
    }
  }

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="명령 팔레트"
      className="fixed inset-0 z-[100] flex items-start justify-center pt-[10vh] px-4 bg-black/40 backdrop-blur-sm"
      onClick={() => setOpen(false)}
    >
      <div
        className="w-full max-w-xl rounded-xl border bg-background shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="border-b px-3 py-2 flex items-center gap-2">
          <Search className="h-4 w-4 text-muted-foreground flex-shrink-0" />
          <Input
            ref={inputRef}
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setActiveIdx(0);
            }}
            onKeyDown={onInputKey}
            placeholder="종목명, 페이지명 검색 (예: 삼성전자, 큐레이션)"
            className="border-0 px-0 focus-visible:ring-0 h-8"
            autoComplete="off"
          />
          <kbd className="hidden sm:inline-flex text-[10px] text-muted-foreground border rounded px-1.5 py-0.5">
            ESC
          </kbd>
        </div>
        <ul className="max-h-[60vh] overflow-y-auto py-1">
          {items.length === 0 && (
            <li className="px-4 py-6 text-xs text-muted-foreground text-center">
              결과 없음
            </li>
          )}
          {items.map((it, i) => (
            <li key={i}>
              <button
                type="button"
                onClick={() => go(it)}
                onMouseEnter={() => setActiveIdx(i)}
                className={`w-full text-left px-3 py-2 flex items-center gap-3 text-sm ${
                  i === activeIdx ? "bg-accent" : "hover:bg-accent/60"
                }`}
              >
                {it.type === "stock" && (
                  <>
                    <Search className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="truncate font-medium">{it.name}</div>
                      <div className="text-[10px] text-muted-foreground truncate">
                        {it.sub}
                      </div>
                    </div>
                  </>
                )}
                {it.type === "recent" && (
                  <>
                    <History className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="truncate font-medium">{it.name}</div>
                      <div className="text-[10px] text-muted-foreground truncate">
                        {it.symbol} · 최근 본 종목
                      </div>
                    </div>
                  </>
                )}
                {it.type === "nav" && (
                  <>
                    <it.link.Icon className="h-4 w-4 text-primary flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="truncate font-medium">{it.link.label}</div>
                      <div className="text-[10px] text-muted-foreground">
                        {it.link.group}
                      </div>
                    </div>
                  </>
                )}
                <ArrowRight className="h-3 w-3 text-muted-foreground/40 flex-shrink-0" />
              </button>
            </li>
          ))}
        </ul>
        <div className="border-t px-3 py-1.5 text-[10px] text-muted-foreground flex justify-between">
          <span>
            <kbd className="border rounded px-1">↑↓</kbd> 이동{" "}
            <kbd className="border rounded px-1 ml-1">Enter</kbd> 열기
          </span>
          <span>
            <kbd className="border rounded px-1">Cmd/Ctrl + K</kbd> 토글
          </span>
        </div>
      </div>
    </div>
  );
}
