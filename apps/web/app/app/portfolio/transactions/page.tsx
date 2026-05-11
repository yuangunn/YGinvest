import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getSelectedPortfolioId } from "@/lib/portfolio-context";

const KRW0 = new Intl.NumberFormat("ko-KR", { style: "currency", currency: "KRW", maximumFractionDigits: 0 });
const USD2 = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });

function fmt(amount: number, currency: string) {
  return currency === "KRW" ? KRW0.format(amount) : USD2.format(amount);
}

export default async function TransactionsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const portfolioId = await getSelectedPortfolioId(supabase, user.id);
  const [trades, fx, dividends] = portfolioId
    ? await Promise.all([
        supabase
          .from("trades")
          .select("*")
          .eq("portfolio_id", portfolioId)
          .order("executed_at", { ascending: false })
          .limit(50),
        supabase
          .from("fx_transactions")
          .select("*")
          .eq("portfolio_id", portfolioId)
          .order("executed_at", { ascending: false })
          .limit(50),
        supabase
          .from("dividend_payouts")
          .select("*")
          .eq("portfolio_id", portfolioId)
          .order("executed_at", { ascending: false })
          .limit(50),
      ])
    : [{ data: null }, { data: null }, { data: null }];

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-4">
      <h1 className="text-2xl font-bold">체결 · 환전 · 배당 내역</h1>
      <Card>
        <CardHeader><CardTitle className="text-base">체결</CardTitle></CardHeader>
        <CardContent>
          {!trades.data?.length ? (
            <div className="text-sm text-muted-foreground">없음</div>
          ) : (
            <ul className="text-sm space-y-1">
              {trades.data.map((t) => (
                <li key={t.id}>
                  {t.symbol} · {t.side} {t.quantity}주 @ {t.price} {t.currency} · 수수료 {t.fee} ·{" "}
                  {new Date(t.executed_at).toLocaleString("ko-KR")}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle className="text-base">환전</CardTitle></CardHeader>
        <CardContent>
          {!fx.data?.length ? (
            <div className="text-sm text-muted-foreground">없음</div>
          ) : (
            <ul className="text-sm space-y-1">
              {fx.data.map((f) => (
                <li key={f.id}>
                  {f.from_amount} {f.from_currency} → {f.to_amount} {f.to_currency} ·
                  rate {f.rate} · {new Date(f.executed_at).toLocaleString("ko-KR")}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle className="text-base">배당</CardTitle></CardHeader>
        <CardContent>
          {!dividends.data?.length ? (
            <div className="text-sm text-muted-foreground">없음</div>
          ) : (
            <ul className="text-sm space-y-2">
              {dividends.data.map((d) => (
                <li key={d.id} className="border-b pb-2">
                  <div className="font-medium">{d.symbol} · {d.qty}주</div>
                  <div className="text-xs text-muted-foreground">
                    gross {fmt(Number(d.gross), d.currency)} −
                    {" "}tax {fmt(Number(d.tax), d.currency)} ={" "}
                    <strong className="text-foreground">{fmt(Number(d.net), d.currency)}</strong>
                    {" · "}ex {d.ex_date}
                    {" · "}{new Date(d.executed_at).toLocaleString("ko-KR")}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
