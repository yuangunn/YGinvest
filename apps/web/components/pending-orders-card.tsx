import Link from "next/link";
import { Clock, ArrowRight } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CancelOrderButton } from "@/components/cancel-order-button";

type Order = {
  id: string;
  symbol: string;
  side: string;
  order_type: string;
  quantity: number;
  limit_price: number | null;
  status: string;
  created_at: string;
  expires_at: string | null;
};

type StockMeta = {
  symbol: string;
  name: string;
  name_ko: string | null;
  currency: string;
};

const KRW = new Intl.NumberFormat("ko-KR", {
  style: "currency",
  currency: "KRW",
  maximumFractionDigits: 0,
});
const USD = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

/**
 * Plan #27.5: 대시보드 — 미체결 주문 표시 + 취소 가능.
 * pending 주문이 1개 이상일 때만 카드 렌더 (없으면 null).
 */
export async function PendingOrdersCard({
  portfolioId,
}: {
  portfolioId: string;
}) {
  const supabase = await createClient();
  const { data: orders } = await supabase
    .from("orders")
    .select(
      "id, symbol, side, order_type, quantity, limit_price, status, created_at, expires_at",
    )
    .eq("portfolio_id", portfolioId)
    .eq("status", "pending")
    .order("created_at", { ascending: false })
    .limit(8);

  const rows = (orders as Order[] | null) ?? [];
  if (rows.length === 0) return null;

  // 종목명 lookup
  const symbols = [...new Set(rows.map((r) => r.symbol))];
  const { data: stocks } = await supabase
    .from("stocks")
    .select("symbol, name, name_ko, currency")
    .in("symbol", symbols);
  const stockMap = new Map<string, StockMeta>(
    ((stocks as StockMeta[] | null) ?? []).map((s) => [s.symbol, s]),
  );

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <CardTitle className="text-base flex items-center gap-2">
            <Clock className="h-4 w-4 text-amber-500" />
            체결 대기 주문 ({rows.length})
          </CardTitle>
          <Link
            href="/app/portfolio/orders"
            className="text-xs text-primary hover:underline inline-flex items-center gap-0.5"
          >
            전체 보기 <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-1.5">
          {rows.map((o) => {
            const meta = stockMap.get(o.symbol);
            const name = meta?.name_ko ?? meta?.name ?? o.symbol;
            const fmt = meta?.currency === "USD" ? USD : KRW;
            const isSell = o.side === "sell";
            return (
              <div
                key={o.id}
                className="flex items-center justify-between gap-2 rounded-md border bg-muted/20 px-3 py-2 text-sm"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span
                      className={`inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-bold ${
                        isSell
                          ? "bg-red-500/10 text-red-600 dark:text-red-500"
                          : "bg-green-500/10 text-green-600 dark:text-green-500"
                      }`}
                    >
                      {isSell ? "매도" : "매수"}
                    </span>
                    <span className="font-medium truncate">{name}</span>
                    <span className="text-[10px] text-muted-foreground">
                      {o.order_type === "limit"
                        ? "지정가"
                        : o.order_type === "midpoint"
                          ? "미드포인트"
                          : "시장가"}
                    </span>
                  </div>
                  <div className="text-[11px] text-muted-foreground mt-0.5">
                    {Number(o.quantity).toLocaleString()}주
                    {o.limit_price !== null && (
                      <> · @ {fmt.format(Number(o.limit_price))}</>
                    )}
                    {o.expires_at && (
                      <>
                        {" "}
                        · 만료{" "}
                        {new Date(o.expires_at).toLocaleDateString("ko-KR", {
                          month: "numeric",
                          day: "numeric",
                        })}
                      </>
                    )}
                  </div>
                </div>
                <CancelOrderButton orderId={o.id} />
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
