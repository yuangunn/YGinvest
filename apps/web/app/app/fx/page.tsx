import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FxExchangeForm } from "@/components/fx-exchange-form";

export default async function FxPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const { data: portfolio } = await supabase
    .from("portfolios")
    .select("id, krw_balance, usd_balance")
    .eq("user_id", user.id)
    .is("room_id", null)
    .single();

  const { data: fx } = await supabase
    .from("fx_rates")
    .select("rate")
    .eq("base", "USD")
    .eq("quote", "KRW")
    .order("ts", { ascending: false })
    .limit(1)
    .maybeSingle();

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-4">
      <h1 className="text-2xl font-bold">환전</h1>
      <Card>
        <CardHeader><CardTitle className="text-base">KRW ↔ USD</CardTitle></CardHeader>
        <CardContent>
          {portfolio ? (
            <FxExchangeForm
              portfolioId={portfolio.id}
              krwBalance={Number(portfolio.krw_balance)}
              usdBalance={Number(portfolio.usd_balance)}
              rate={fx?.rate ? Number(fx.rate) : null}
            />
          ) : (
            <div className="text-sm text-muted-foreground">포트폴리오 없음</div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
