import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const KRW = new Intl.NumberFormat("ko-KR", { style: "currency", currency: "KRW" });
const USD = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const { data: portfolio } = await supabase
    .from("portfolios")
    .select("krw_balance, usd_balance, starting_krw, starting_usd")
    .eq("user_id", user.id)
    .is("room_id", null)
    .maybeSingle();

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-6">
      <h1 className="text-2xl font-bold">대시보드</h1>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">KRW 잔고</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {portfolio ? KRW.format(Number(portfolio.krw_balance)) : "—"}
            </div>
            <div className="text-xs text-muted-foreground">
              시작: {portfolio ? KRW.format(Number(portfolio.starting_krw)) : "—"}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">USD 잔고</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {portfolio ? USD.format(Number(portfolio.usd_balance)) : "—"}
            </div>
            <div className="text-xs text-muted-foreground">
              시작: {portfolio ? USD.format(Number(portfolio.starting_usd)) : "—"}
            </div>
          </CardContent>
        </Card>
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">곧 추가될 기능</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-1">
          <div>· 종목 검색 및 매수/매도 (Plan #2-3)</div>
          <div>· 종목 상세 차트 + 지표 (Plan #4)</div>
          <div>· 친구방 + 리더보드 (Plan #5)</div>
        </CardContent>
      </Card>
    </div>
  );
}
