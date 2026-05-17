// Plan #45: 금융 학습 — YG 디자인.

import Link from "next/link";
import { redirect } from "next/navigation";
import {
  BookOpen,
  TrendingUp,
  Landmark,
  Coins,
  Home,
  Globe,
  Scale,
  BarChart3,
  Brain,
  Calculator,
  Activity,
  History,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/yg/page-header";

const ARTICLES = [
  {
    slug: "interest-rate-and-stocks",
    title: "금리와 주식의 관계",
    summary: "왜 금리가 오르면 성장주가 빠지고, 내리면 부동산이 오를까?",
    icon: TrendingUp,
    minutes: 5,
  },
  {
    slug: "bond-vs-stock",
    title: "주식과 채권의 차이",
    summary: "안전자산 vs 위험자산. 어떻게 함께 보유해서 리스크를 줄일까?",
    icon: Landmark,
    minutes: 4,
  },
  {
    slug: "inflation-assets",
    title: "인플레이션 시대의 자산 배분",
    summary: "물가가 오를 때 어떤 자산이 유리한가?",
    icon: Coins,
    minutes: 6,
  },
  {
    slug: "real-estate-stock",
    title: "부동산과 주식의 상관관계",
    summary: "두 자산이 함께 움직일 때와 반대로 움직일 때",
    icon: Home,
    minutes: 5,
  },
  {
    slug: "fx-export-stocks",
    title: "환율이 수출주에 미치는 영향",
    summary: "원화 약세는 누구한테 좋고 누구한테 나쁜가?",
    icon: Globe,
    minutes: 4,
  },
  {
    slug: "growth-vs-value",
    title: "성장주 vs 가치주",
    summary: "두 투자 스타일의 차이와 시장 상황별 강세",
    icon: Scale,
    minutes: 5,
  },
  {
    slug: "diversification",
    title: "분산투자의 원리",
    summary: "계란을 한 바구니에 담지 말라 — 왜?",
    icon: BarChart3,
    minutes: 4,
  },
  {
    slug: "per-pbr-roe",
    title: "PER · PBR · ROE 완전 이해",
    summary: "가치평가 3대 지표가 의미하는 것",
    icon: BookOpen,
    minutes: 7,
  },
  {
    slug: "behavioral-biases",
    title: "행동경제학 — 손실회피와 처분효과",
    summary: "사람은 왜 손절을 못하나? 인지편향 5가지",
    icon: Brain,
    minutes: 6,
  },
  {
    slug: "compound-rule-of-72",
    title: "복리의 마법과 72의 법칙",
    summary: "왜 일찍 시작하는 게 가장 강력한 무기인가",
    icon: Calculator,
    minutes: 4,
  },
  {
    slug: "fomc-dotplot",
    title: "FOMC 점도표 읽는 법",
    summary: "Fed 위원들이 그리는 금리 미래 — 시장의 가장 큰 변수",
    icon: Activity,
    minutes: 5,
  },
  {
    slug: "bubble-history",
    title: "버블의 역사 — 4번의 큰 광기",
    summary: "튤립, 닷컴, 2008, AI 거품. 패턴은 항상 비슷하다",
    icon: History,
    minutes: 7,
  },
  {
    slug: "etf-basics",
    title: "ETF 입문 — 인덱스 펀드의 원리",
    summary: "전체 시장을 사는 가장 쉬운 방법. 액티브 vs 패시브",
    icon: BarChart3,
    minutes: 5,
  },
];

export default async function LearnPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  return (
    <div style={{ paddingBottom: 24 }}>
      <PageHeader
        title="금융 학습"
        sub={`${ARTICLES.length}개 글 · 짧은 글로 핵심`}
      />

      {/* 용어 사전 CTA */}
      <div style={{ padding: "8px 20px 0" }}>
        <Link
          href="/app/learn/glossary"
          className="yg-card yg-tap"
          style={{
            padding: 18,
            display: "flex",
            alignItems: "center",
            gap: 12,
            textDecoration: "none",
            color: "var(--yg-fg-primary)",
          }}
        >
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: 12,
              background: "var(--yg-bg-tint-red)",
              color: "var(--yg-up-deep)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 18,
            }}
          >
            📖
          </div>
          <div style={{ flex: 1 }}>
            <div
              style={{
                fontSize: 14,
                fontWeight: 800,
                letterSpacing: "-0.01em",
              }}
            >
              용어 사전
            </div>
            <div
              style={{
                fontSize: 11,
                color: "var(--yg-fg-tertiary)",
                fontWeight: 600,
                marginTop: 2,
              }}
            >
              PER · ROE · RSI · MACD 등 50+ 용어
            </div>
          </div>
          <span style={{ color: "var(--yg-fg-tertiary)", fontWeight: 700 }}>
            ›
          </span>
        </Link>
      </div>

      {/* Articles grid */}
      <div style={{ padding: "16px 20px 0" }}>
        <h3
          style={{
            margin: "0 4px 10px",
            fontSize: 14,
            fontWeight: 800,
            color: "var(--yg-fg-tertiary)",
            letterSpacing: "0.04em",
          }}
        >
          경제 상식
        </h3>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 10,
          }}
        >
          {ARTICLES.map((a) => (
            <Link
              key={a.slug}
              href={`/app/learn/${a.slug}`}
              className="yg-card yg-tap"
              style={{
                padding: 14,
                display: "flex",
                flexDirection: "column",
                gap: 8,
                textDecoration: "none",
                color: "var(--yg-fg-primary)",
              }}
            >
              <div
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 10,
                  background: "var(--yg-bg-tint-ink)",
                  color: "var(--yg-fg-secondary)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <a.icon className="h-4 w-4" />
              </div>
              <div
                style={{
                  fontSize: 13,
                  fontWeight: 800,
                  letterSpacing: "-0.01em",
                  lineHeight: 1.3,
                }}
              >
                {a.title}
              </div>
              <div
                style={{
                  fontSize: 10,
                  color: "var(--yg-fg-tertiary)",
                  fontWeight: 600,
                  lineHeight: 1.4,
                  overflow: "hidden",
                  display: "-webkit-box",
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: "vertical",
                }}
              >
                {a.summary}
              </div>
              <div
                style={{
                  fontSize: 10,
                  color: "var(--yg-fg-tertiary)",
                  fontWeight: 700,
                  marginTop: "auto",
                }}
              >
                {a.minutes}분
              </div>
            </Link>
          ))}
        </div>
      </div>

      <p
        style={{
          fontSize: 11,
          color: "var(--yg-fg-tertiary)",
          textAlign: "center",
          fontWeight: 600,
          paddingTop: 16,
          margin: 0,
        }}
      >
        ⚠️ 학습 콘텐츠는 시뮬레이션 + 일반 교육 목적
      </p>
    </div>
  );
}
