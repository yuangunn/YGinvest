import { redirect } from "next/navigation";
import { Activity, TriangleAlert } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getSelectedPortfolioId } from "@/lib/portfolio-context";
import { ScenariosClient } from "@/components/scenarios-client";

type Holding = {
  symbol: string;
  quantity: number;
  avg_cost: number;
  stocks: {
    name: string;
    name_ko: string | null;
    sector: string | null;
    last_price: number | null;
    currency: string;
  } | null;
};

export default async function ScenariosPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const portfolioId = await getSelectedPortfolioId(supabase, user.id);
  if (!portfolioId) redirect("/app/portfolio/overview");

  // Holdings + 종목 정보
  const { data: holdingsRaw } = await supabase
    .from("holdings")
    .select(
      "symbol, quantity, avg_cost, stocks(name, name_ko, sector, last_price, currency)",
    )
    .eq("portfolio_id", portfolioId)
    .gt("quantity", 0);

  const holdings = (holdingsRaw as unknown as Holding[] | null) ?? [];

  // 클라이언트로 전달할 단순화된 포지션 데이터
  const positions = holdings
    .filter((h) => h.stocks)
    .map((h) => {
      const stock = h.stocks!;
      const price = Number(stock.last_price ?? h.avg_cost);
      const value = Number(h.quantity) * price;
      return {
        symbol: h.symbol,
        name: stock.name_ko ?? stock.name,
        sector: stock.sector,
        currency: stock.currency,
        value,
      };
    });

  return (
    <div className="max-w-3xl mx-auto p-4 space-y-4">
      <div>
        <h1 className="text-xl font-bold flex items-center gap-2">
          <Activity className="h-5 w-5 text-primary" />
          포트폴리오 시나리오 분석
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          거시 변수(금리·환율·유가·VIX)가 바뀌면 내 포트폴리오가 어떻게 영향받을까?
        </p>
      </div>

      {positions.length === 0 ? (
        <Card>
          <CardContent className="py-6 text-center">
            <p className="text-sm text-muted-foreground">
              보유 종목이 없어 시나리오 분석을 할 수 없습니다.
            </p>
          </CardContent>
        </Card>
      ) : (
        <ScenariosClient positions={positions} />
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <TriangleAlert className="h-4 w-4 text-amber-500" />
            모델의 한계
          </CardTitle>
        </CardHeader>
        <CardContent className="text-xs text-muted-foreground space-y-1.5">
          <p>
            섹터별 평균 민감도를 사용한 <strong>학습용 단순 모델</strong>입니다. 실제 베타는 종목마다 다르고, 거시 변수 간 상관관계도 고려되지 않습니다.
          </p>
          <p>
            교차 효과(예: 금리↑ + 유가↑ 동시 발생 시)는 단순 선형 합산되어 실제와 다를 수 있습니다.
          </p>
          <p>
            진짜 베타를 알고 싶다면 회귀분석(종목 수익률 vs 시장 / 거시 변수)이 필요합니다.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
