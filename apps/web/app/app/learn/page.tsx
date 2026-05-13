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
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

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
];

export default async function LearnPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  return (
    <div className="max-w-3xl mx-auto p-4 space-y-4">
      <div>
        <h1 className="text-xl font-bold flex items-center gap-2">
          <BookOpen className="h-5 w-5 text-primary" />
          금융 학습
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          모의투자로 익히는 경제 원리. 짧은 글로 핵심만.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">📖 용어 사전</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-2">
            PER, ROE, 시가총액, 호가 spread, 캔들, RSI, MACD 등 50+ 용어를 검색하거나 둘러보기.
          </p>
          <Link
            href="/app/learn/glossary"
            className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
          >
            용어 사전 보기 →
          </Link>
        </CardContent>
      </Card>

      <div>
        <h2 className="text-base font-semibold mb-2">경제 상식</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {ARTICLES.map((a) => (
            <Link key={a.slug} href={`/app/learn/${a.slug}`}>
              <Card className="h-full hover:border-primary/40 transition-colors cursor-pointer">
                <CardHeader>
                  <CardTitle className="text-sm flex items-center gap-2">
                    <a.icon className="h-4 w-4 text-primary flex-shrink-0" />
                    <span className="truncate">{a.title}</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-xs text-muted-foreground line-clamp-2">
                    {a.summary}
                  </p>
                  <p className="text-[10px] text-muted-foreground mt-2">
                    {a.minutes}분
                  </p>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </div>

      <p className="text-xs text-muted-foreground text-center pt-2">
        ⚠️ 학습 콘텐츠는 시뮬레이션 + 일반 교육 목적입니다. 실제 투자 자문이 아닙니다.
      </p>
    </div>
  );
}
