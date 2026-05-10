import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default async function TransactionsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const [trades, fx] = await Promise.all([
    supabase.from("trades").select("*").order("executed_at", { ascending: false }).limit(50),
    supabase.from("fx_transactions").select("*").order("executed_at", { ascending: false }).limit(50),
  ]);

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-4">
      <h1 className="text-2xl font-bold">체결 · 환전 내역</h1>
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
    </div>
  );
}
