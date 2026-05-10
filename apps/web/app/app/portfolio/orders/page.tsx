import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CancelOrderButton } from "@/components/cancel-order-button";

export default async function OrdersPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const { data: orders } = await supabase
    .from("orders")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(100);

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-4">
      <h1 className="text-2xl font-bold">주문 내역</h1>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">최근 100건</CardTitle>
        </CardHeader>
        <CardContent>
          {!orders || orders.length === 0 ? (
            <div className="text-sm text-muted-foreground">주문 없음</div>
          ) : (
            <ul className="space-y-2">
              {orders.map((o) => (
                <li key={o.id} className="text-sm flex items-center justify-between border-b pb-2">
                  <div>
                    <div className="font-medium">
                      {o.symbol} · {o.side} {o.order_type} · {o.quantity}주
                      {o.limit_price ? ` @ ${o.limit_price}` : ""}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      상태: {o.status} · {new Date(o.created_at).toLocaleString("ko-KR")}
                      {o.filled_avg_price ? ` · 체결가 ${o.filled_avg_price}` : ""}
                    </div>
                  </div>
                  {o.status === "pending" && <CancelOrderButton orderId={o.id} />}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
