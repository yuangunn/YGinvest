import { redirect } from "next/navigation";
import { Grid3x3 } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { CorrelationClient } from "@/components/correlation-client";
import { getSelectedPortfolioId } from "@/lib/portfolio-context";

export default async function CorrelationPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const portfolioId = await getSelectedPortfolioId(supabase, user.id);

  // 사용자의 보유 + 관심 종목을 기본 후보로
  let initialSymbols: string[] = [];
  if (portfolioId) {
    const [{ data: holdings }, { data: watches }] = await Promise.all([
      supabase.from("holdings").select("symbol").eq("portfolio_id", portfolioId),
      supabase.from("watchlists").select("symbol").eq("portfolio_id", portfolioId),
    ]);
    const symbols = new Set<string>();
    for (const r of (holdings ?? []) as { symbol: string }[]) symbols.add(r.symbol);
    for (const r of (watches ?? []) as { symbol: string }[]) symbols.add(r.symbol);
    initialSymbols = [...symbols].slice(0, 6);
  }

  return (
    <div className="max-w-3xl mx-auto p-4 space-y-4">
      <div>
        <h1 className="text-xl font-bold flex items-center gap-2">
          <Grid3x3 className="h-5 w-5 text-primary" />
          종목 상관관계 (Correlation Matrix)
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          종목 간 일일 수익률의 상관계수. -1 (완전 반대) ~ +1 (완전 동조). 분산투자 평가에 활용.
        </p>
      </div>
      <CorrelationClient initialSymbols={initialSymbols} />
    </div>
  );
}
