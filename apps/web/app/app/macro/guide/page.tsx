import { redirect } from "next/navigation";
import Link from "next/link";
import {
  Activity,
  TrendingUp,
  TrendingDown,
  Minus,
  AlertTriangle,
  ChevronLeft,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/supabase/user";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  MACRO_SCENARIOS,
  type Trend,
  type AssetImpact,
} from "@/lib/macro-scenarios";

const TREND_LABEL: Record<Trend, { symbol: string; label: string; cls: string }> = {
  up: { symbol: "↑", label: "상승", cls: "text-red-500" },
  down: { symbol: "↓", label: "하락", cls: "text-blue-500" },
  flat: { symbol: "→", label: "보합", cls: "text-muted-foreground" },
  either: { symbol: "⇅", label: "양방향", cls: "text-amber-500" },
};

const IMPACT_LABEL: Record<
  AssetImpact["impact"],
  { label: string; cls: string; Icon: typeof TrendingUp }
> = {
  positive: {
    label: "긍정",
    cls: "text-green-600 dark:text-green-500 bg-green-500/10 border-green-500/30",
    Icon: TrendingUp,
  },
  negative: {
    label: "부정",
    cls: "text-red-600 dark:text-red-500 bg-red-500/10 border-red-500/30",
    Icon: TrendingDown,
  },
  mixed: {
    label: "혼재",
    cls: "text-amber-600 dark:text-amber-500 bg-amber-500/10 border-amber-500/30",
    Icon: Minus,
  },
  neutral: {
    label: "중립",
    cls: "text-muted-foreground bg-muted border",
    Icon: Minus,
  },
};

export default async function MacroGuidePage() {
  const supabase = await createClient();
  const user = await getCurrentUser();
  if (!user) redirect("/auth/login");

  return (
    <div className="max-w-3xl mx-auto p-4 space-y-4">
      <div className="text-xs text-muted-foreground">
        <Link
          href="/app/macro"
          className="hover:underline inline-flex items-center gap-0.5"
        >
          <ChevronLeft className="h-3 w-3" />
          거시경제
        </Link>
      </div>

      <div>
        <h1 className="text-xl font-bold flex items-center gap-2">
          <Activity className="h-5 w-5 text-primary" />
          거시지표 읽는 법
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          금리·환율·유가·VIX가 함께 움직이는 패턴을 알면 시장의 방향이 보입니다.
          핵심 시나리오 {MACRO_SCENARIOS.length}개로 정리.
        </p>
      </div>

      <Card>
        <CardContent className="py-3 text-xs text-muted-foreground space-y-1.5">
          <p className="font-semibold text-foreground">💡 사용법</p>
          <p>
            <strong>1.</strong>{" "}
            <Link href="/app/macro" className="text-primary hover:underline">
              거시경제 대시보드
            </Link>
            에서 현재 지표 추세 확인
          </p>
          <p>
            <strong>2.</strong> 아래 시나리오 중 어떤 것과 가장 비슷한지 매칭
          </p>
          <p>
            <strong>3.</strong> 자산별 영향 + 투자 가이드 참고해 포지션 점검
          </p>
        </CardContent>
      </Card>

      {/* 시나리오 목차 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">시나리오 목차</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
            {MACRO_SCENARIOS.map((s) => (
              <a
                key={s.id}
                href={`#${s.id}`}
                className="flex items-start gap-2 rounded-md border px-2.5 py-1.5 text-sm hover:bg-accent hover:border-primary/40 transition-colors"
              >
                <span className="text-lg flex-shrink-0">{s.emoji}</span>
                <div className="min-w-0">
                  <div className="font-medium truncate">{s.title}</div>
                  <div className="text-[10px] text-muted-foreground truncate">
                    {s.tagline}
                  </div>
                </div>
              </a>
            ))}
          </div>
        </CardContent>
      </Card>

      {MACRO_SCENARIOS.map((s) => (
        <Card key={s.id} id={s.id} className="scroll-mt-4">
          <CardHeader>
            <div className="flex items-start gap-3">
              <span className="text-3xl flex-shrink-0">{s.emoji}</span>
              <div className="min-w-0 flex-1">
                <CardTitle className="text-base">{s.title}</CardTitle>
                <p className="text-xs text-muted-foreground mt-1">
                  {s.tagline}
                </p>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* 지표 조합 */}
            <div>
              <h3 className="text-xs font-semibold text-muted-foreground mb-2">
                📊 지표 조합
              </h3>
              <div className="space-y-1">
                {s.indicators.map((i) => {
                  const trend = TREND_LABEL[i.trend];
                  return (
                    <div
                      key={i.name}
                      className="flex items-start gap-2 text-xs border-b last:border-0 py-1.5"
                    >
                      <span
                        className={`font-bold ${trend.cls} flex-shrink-0 w-6`}
                      >
                        {trend.symbol}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium">{i.name}</div>
                        <div className="text-[10px] text-muted-foreground">
                          {i.why}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* 의미 */}
            <div>
              <h3 className="text-xs font-semibold text-muted-foreground mb-2">
                💬 의미
              </h3>
              <p className="text-xs leading-relaxed whitespace-pre-line">
                {s.meaning}
              </p>
            </div>

            {/* 자산별 영향 */}
            <div>
              <h3 className="text-xs font-semibold text-muted-foreground mb-2">
                💰 자산별 영향
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                {s.assetImpact.map((a) => {
                  const meta = IMPACT_LABEL[a.impact];
                  return (
                    <div
                      key={a.asset}
                      className={`rounded-md border px-2 py-1.5 text-xs ${meta.cls}`}
                    >
                      <div className="flex items-center gap-1 font-medium">
                        <meta.Icon className="h-3 w-3" />
                        {a.asset}
                      </div>
                      <div className="text-[10px] opacity-80 mt-0.5">
                        {a.reason}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* 역사적 사례 */}
            <div>
              <h3 className="text-xs font-semibold text-muted-foreground mb-2">
                📚 역사적 사례
              </h3>
              <ul className="space-y-1 list-disc ml-4 text-xs leading-relaxed">
                {s.historicalExamples.map((ex, i) => (
                  <li
                    key={i}
                    dangerouslySetInnerHTML={{
                      __html: ex.replace(
                        /\*\*(.+?)\*\*/g,
                        '<strong class="text-foreground">$1</strong>',
                      ),
                    }}
                  />
                ))}
              </ul>
            </div>

            {/* 투자 가이드 */}
            <div>
              <h3 className="text-xs font-semibold text-muted-foreground mb-2">
                🎯 투자 가이드
              </h3>
              <ul className="space-y-1 list-disc ml-4 text-xs leading-relaxed">
                {s.investmentGuide.map((g, i) => (
                  <li
                    key={i}
                    dangerouslySetInnerHTML={{
                      __html: g.replace(
                        /\*\*(.+?)\*\*/g,
                        '<strong class="text-foreground">$1</strong>',
                      ),
                    }}
                  />
                ))}
              </ul>
            </div>

            {/* 경고 */}
            {s.warning && (
              <div className="flex items-start gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2">
                <AlertTriangle className="h-4 w-4 text-amber-500 flex-shrink-0 mt-0.5" />
                <p className="text-xs leading-relaxed">{s.warning}</p>
              </div>
            )}
          </CardContent>
        </Card>
      ))}

      <Card>
        <CardContent className="py-3 text-xs text-muted-foreground space-y-1.5">
          <p className="font-semibold text-foreground">⚠️ 한계</p>
          <p>
            현실은 깔끔한 시나리오 하나로 분류되지 않습니다. 동시에 여러 요인이
            작용하며, 같은 지표 패턴이 다른 결과를 낳기도 합니다.
          </p>
          <p>
            이 가이드는 학습용 프레임워크이지 매매 추천 X. 과거 패턴이 미래를
            보장하지 않습니다.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
