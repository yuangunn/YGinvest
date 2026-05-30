import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronLeft, BookOpen } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/supabase/user";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { GLOSSARY } from "@/lib/glossary";

// 카테고리별 그룹핑 (key prefix or content 기준)
const CATEGORIES: { name: string; keys: string[] }[] = [
  {
    name: "💰 가치평가",
    keys: ["per", "pbr", "eps", "roe", "market-cap", "fair-value", "target-price", "upside"],
  },
  {
    name: "📈 가격 / 시장",
    keys: ["52w-high", "52w-low", "spread", "midpoint", "liquidity", "trading-value"],
  },
  {
    name: "📊 차트 / 기술적 지표",
    keys: ["ma", "rsi", "macd", "bollinger", "stochastic", "vwap", "candlestick", "volume", "volume-surge", "fib-retracement", "trendline"],
  },
  {
    name: "🏛️ 거래소 / 주문",
    keys: ["nxt", "market-order", "limit-order"],
  },
  {
    name: "🗂️ 분류 / 큐레이션",
    keys: ["sector", "theme", "rating", "growth-vs-value"],
  },
  {
    name: "🌐 경제 기초",
    keys: ["interest-rate", "inflation", "bond", "real-estate", "stock-bond-correlation", "fx", "diversification", "dividend", "fee-tax"],
  },
];

export default async function GlossaryPage() {
  const supabase = await createClient();
  const user = await getCurrentUser();
  if (!user) redirect("/auth/login");

  return (
    <div className="max-w-3xl mx-auto p-4 space-y-4">
      <div className="text-xs text-muted-foreground">
        <Link href="/app/learn" className="hover:underline inline-flex items-center gap-0.5">
          <ChevronLeft className="h-3 w-3" />
          학습
        </Link>
      </div>

      <div>
        <h1 className="text-xl font-bold flex items-center gap-2">
          <BookOpen className="h-5 w-5 text-primary" />
          용어 사전
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          {Object.keys(GLOSSARY).length}개 용어. 차트/페이지에서 밑줄친 단어를 클릭하면 같은 정의가 팝업으로 표시됩니다.
        </p>
      </div>

      {CATEGORIES.map((cat) => (
        <Card key={cat.name}>
          <CardHeader>
            <CardTitle className="text-base">{cat.name}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {cat.keys.map((k) => {
                const entry = GLOSSARY[k];
                if (!entry) return null;
                return (
                  <div
                    key={k}
                    id={k}
                    className="border-l-2 border-primary/30 pl-3 scroll-mt-20"
                  >
                    <div className="font-semibold text-sm flex items-center gap-2">
                      {entry.term}
                    </div>
                    <div className="text-xs text-muted-foreground italic mt-0.5 mb-1">
                      {entry.short}
                    </div>
                    <div
                      className="text-xs leading-relaxed text-foreground whitespace-pre-line"
                      style={{ wordBreak: "keep-all" }}
                    >
                      {entry.detail}
                    </div>
                    {entry.formula && (
                      <div className="mt-1 text-[11px] font-mono bg-muted/40 rounded px-2 py-1 inline-block">
                        {entry.formula}
                      </div>
                    )}
                    {entry.example && (
                      <div className="mt-1 text-[11px] text-muted-foreground">
                        📌 {entry.example}
                      </div>
                    )}
                    {entry.related && entry.related.length > 0 && (
                      <div className="mt-1.5 flex flex-wrap gap-1">
                        {entry.related.map((r) => {
                          const rel = GLOSSARY[r];
                          if (!rel) return null;
                          return (
                            <a
                              key={r}
                              href={`#${r}`}
                              className="text-[10px] rounded-full bg-primary/10 text-primary px-2 py-0.5 hover:bg-primary/20"
                            >
                              {rel.term.split(" ")[0]}
                            </a>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
