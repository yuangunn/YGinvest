"use client";

// Plan #41: YG ActionMenu — collapsible 5 카테고리.

import { useState, type ComponentType } from "react";
import Link from "next/link";
import {
  Activity, ArrowLeftRight, Award, Bell, BookOpen, Brain,
  Calendar, Coins, GitCompare, Grid3x3, LineChart, PieChart, Search,
  Smartphone, Sparkles, Tags, Users,
} from "lucide-react";
import { YGIcon } from "@/components/yg/icon";

type ActionItem = {
  href: string;
  label: string;
  Icon: ComponentType<{ className?: string }>;
};

type Category = {
  id: string;
  label: string;
  YGIcon: ComponentType<{ s?: number; c?: string }>;
  items: ActionItem[];
};

const CATEGORIES: Category[] = [
  {
    id: "trade",
    label: "거래",
    YGIcon: YGIcon.Briefcase,
    items: [
      { href: "/app/trade/search", label: "검색", Icon: Search },
      { href: "/app/curation", label: "큐레이션", Icon: Sparkles },
      { href: "/app/themes", label: "테마주", Icon: Tags },
      { href: "/app/sectors", label: "섹터", Icon: Grid3x3 },
      { href: "/app/earnings", label: "실적", Icon: Calendar },
      { href: "/app/strategies", label: "유명 전략", Icon: Award },
    ],
  },
  {
    id: "analyze",
    label: "분석 도구",
    YGIcon: YGIcon.Chart,
    items: [
      { href: "/app/backtest", label: "백테스트", Icon: LineChart },
      { href: "/app/correlation", label: "상관관계", Icon: Grid3x3 },
      { href: "/app/portfolio/analysis", label: "매매분석", Icon: LineChart },
      { href: "/app/portfolio/scenarios", label: "시나리오", Icon: Activity },
      { href: "/app/portfolio/behavior", label: "행동분석", Icon: Brain },
      { href: "/app/portfolio/what-if", label: "vs 인덱스", Icon: GitCompare },
      { href: "/app/whatif", label: "가상 매수", Icon: GitCompare },
      { href: "/app/portfolio/allocation", label: "자산배분", Icon: PieChart },
      { href: "/app/portfolio/dividend-sim", label: "배당시뮬", Icon: Coins },
    ],
  },
  {
    id: "learn",
    label: "경제 학습",
    YGIcon: YGIcon.Book,
    items: [
      { href: "/app/learn", label: "학습 글", Icon: BookOpen },
      { href: "/app/learn/glossary", label: "용어사전", Icon: BookOpen },
      { href: "/app/macro", label: "거시경제", Icon: Activity },
      { href: "/app/macro/guide", label: "지표 읽기", Icon: Activity },
      { href: "/app/macro/calendar", label: "경제 캘린더", Icon: Calendar },
      { href: "/app/macro/history", label: "경제 사건", Icon: BookOpen },
    ],
  },
  {
    id: "other",
    label: "기타",
    YGIcon: YGIcon.Wrench,
    items: [
      { href: "/app/fx", label: "환전", Icon: ArrowLeftRight },
      { href: "/app/rooms", label: "친구방", Icon: Users },
      { href: "/app/settings", label: "알림 설정", Icon: Bell },
      { href: "/app/help/install", label: "앱 설치", Icon: Smartphone },
    ],
  },
  {
    id: "game",
    label: "게임 (베타)",
    YGIcon: YGIcon.Game,
    items: [
      { href: "/app/roguelike", label: "인생 시뮬", Icon: Sparkles },
    ],
  },
];

export function YGActionMenu({ defaultOpenId = "trade" }: { defaultOpenId?: string }) {
  const [open, setOpen] = useState<string | null>(defaultOpenId);
  return (
    <div className="yg-card" style={{ overflow: "hidden" }}>
      {CATEGORIES.map((cat, i) => {
        const isOpen = open === cat.id;
        const isGame = cat.id === "game";
        const CategoryIcon = cat.YGIcon;
        return (
          <div key={cat.id}>
            <button
              onClick={() => setOpen(isOpen ? null : cat.id)}
              className="yg-tap"
              style={{
                all: "unset",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 12,
                padding: "16px 18px",
                width: "100%",
                borderTop: i === 0 ? 0 : "1px solid var(--yg-line-faint)",
                boxSizing: "border-box",
              }}
            >
              <div
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: 10,
                  background: isGame ? "var(--yg-brand)" : "var(--yg-bg-tint-ink)",
                  color: isGame ? "#fff" : "var(--yg-fg-primary)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <CategoryIcon s={20} c="currentColor" />
              </div>
              <span
                style={{
                  fontSize: 15,
                  fontWeight: 700,
                  letterSpacing: "-0.01em",
                  color: "var(--yg-fg-primary)",
                }}
              >
                {cat.label}
              </span>
              <span
                className="yg-num"
                style={{
                  marginLeft: "auto",
                  fontSize: 12,
                  fontWeight: 700,
                  color: "var(--yg-fg-tertiary)",
                }}
              >
                {cat.items.length}
              </span>
              <span
                style={{
                  color: "var(--yg-fg-tertiary)",
                  transition: "transform 200ms ease",
                  transform: isOpen ? "rotate(180deg)" : "rotate(0deg)",
                  display: "inline-flex",
                }}
              >
                <YGIcon.ChevronDown s={16} />
              </span>
            </button>
            {isOpen && (
              <div
                style={{
                  padding: "8px 18px 18px 64px",
                  display: "grid",
                  gridTemplateColumns: "repeat(2, 1fr)",
                  gap: "10px 16px",
                  borderTop: "1px solid var(--yg-line-faint)",
                  background: "var(--yg-bg-sub)",
                }}
              >
                {cat.items.map((it) => (
                  <Link
                    key={it.href}
                    href={it.href}
                    style={{
                      fontSize: 13,
                      fontWeight: 600,
                      color: "var(--yg-fg-secondary)",
                      paddingTop: 6,
                      textDecoration: "none",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 4,
                    }}
                  >
                    {it.label} ›
                  </Link>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
