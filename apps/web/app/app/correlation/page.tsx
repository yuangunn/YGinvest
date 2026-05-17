// Plan #45: 상관관계 — YG 디자인.

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { CorrelationClient } from "@/components/correlation-client";
import { PageHeader } from "@/components/yg/page-header";
import { getSelectedPortfolioId } from "@/lib/portfolio-context";

type StockRow = { symbol: string; name: string; name_ko: string | null };

export default async function CorrelationPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const portfolioId = await getSelectedPortfolioId(supabase, user.id);

  // 사용자의 보유 + 관심 종목을 기본 후보로 (회사명 포함)
  let initial: { symbol: string; name: string }[] = [];
  if (portfolioId) {
    const [{ data: holdings }, { data: watches }] = await Promise.all([
      supabase.from("holdings").select("symbol").eq("portfolio_id", portfolioId),
      supabase.from("watchlists").select("symbol").eq("portfolio_id", portfolioId),
    ]);
    const symbols = new Set<string>();
    for (const r of (holdings ?? []) as { symbol: string }[]) symbols.add(r.symbol);
    for (const r of (watches ?? []) as { symbol: string }[]) symbols.add(r.symbol);
    const symList = [...symbols].slice(0, 6);
    if (symList.length > 0) {
      const { data: stocks } = await supabase
        .from("stocks")
        .select("symbol, name, name_ko")
        .in("symbol", symList);
      const meta = new Map<string, StockRow>(
        ((stocks as StockRow[] | null) ?? []).map((s) => [s.symbol, s]),
      );
      initial = symList.map((sym) => {
        const m = meta.get(sym);
        return { symbol: sym, name: m?.name_ko ?? m?.name ?? sym };
      });
    }
  }

  return (
    <div style={{ paddingBottom: 24 }}>
      <PageHeader
        title="상관관계"
        sub="-1 (반대) ~ +1 (동조) · 분산투자 평가"
      />
      <div style={{ padding: "8px 20px 0" }}>
        <div className="yg-card" style={{ padding: 18 }}>
          <CorrelationClient initial={initial} />
        </div>
      </div>
    </div>
  );
}
