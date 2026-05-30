// Plan #44: 주문 내역 — YG 디자인.

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/supabase/user";
import { CancelOrderButton } from "@/components/cancel-order-button";
import { getSelectedPortfolioId } from "@/lib/portfolio-context";
import { PageHeader } from "@/components/yg/page-header";
import { TickerBadge } from "@/components/yg/ticker-badge";

type OrderStatus = "pending" | "filled" | "cancelled" | "expired";

const STATUS_LABEL: Record<string, string> = {
  pending: "대기중",
  filled: "체결완료",
  cancelled: "취소됨",
  expired: "만료",
};

export default async function OrdersPage() {
  const supabase = await createClient();
  const user = await getCurrentUser();
  if (!user) redirect("/auth/login");

  const portfolioId = await getSelectedPortfolioId(supabase, user.id);
  const { data: orders } = portfolioId
    ? await supabase
        .from("orders")
        .select("*")
        .eq("portfolio_id", portfolioId)
        .order("created_at", { ascending: false })
        .limit(100)
    : { data: null };

  const list = orders ?? [];

  return (
    <div style={{ paddingBottom: 16 }}>
      <PageHeader title="주문 내역" sub={`최근 ${list.length}건`} />

      {list.length === 0 ? (
        <div
          style={{
            padding: "60px 20px",
            textAlign: "center",
            color: "var(--yg-fg-tertiary)",
            fontSize: 14,
            fontWeight: 600,
          }}
        >
          주문 내역이 없어요
        </div>
      ) : (
        <div style={{ padding: "12px 20px 0" }}>
          <div className="yg-card" style={{ padding: 18 }}>
            {list.map((o, i) => {
              const isLast = i === list.length - 1;
              const isBuy = o.side === "buy";
              const statusKey = (o.status ?? "pending") as OrderStatus;
              const statusLabel = STATUS_LABEL[statusKey] ?? o.status;
              return (
                <div
                  key={o.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    padding: "14px 0",
                    borderBottom: isLast
                      ? 0
                      : "1px solid var(--yg-line-faint)",
                  }}
                >
                  <TickerBadge symbol={String(o.symbol).slice(0, 3)} size={36} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        fontSize: 14,
                        fontWeight: 800,
                        letterSpacing: "-0.01em",
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                      }}
                    >
                      <span>{o.symbol}</span>
                      <span
                        style={{
                          fontSize: 11,
                          fontWeight: 800,
                          padding: "2px 6px",
                          borderRadius: 5,
                          background: isBuy
                            ? "var(--yg-bg-tint-red)"
                            : "var(--yg-bg-tint-blue)",
                          color: isBuy
                            ? "var(--yg-up-deep)"
                            : "var(--yg-down-deep)",
                          letterSpacing: "0.04em",
                        }}
                      >
                        {isBuy ? "매수" : "매도"}
                      </span>
                    </div>
                    <div
                      className="yg-num"
                      style={{
                        fontSize: 11,
                        color: "var(--yg-fg-tertiary)",
                        fontWeight: 600,
                        marginTop: 2,
                      }}
                    >
                      {o.order_type} · {o.quantity}주
                      {o.limit_price
                        ? ` @ ${Number(o.limit_price).toLocaleString()}`
                        : ""}
                    </div>
                    <div
                      className="yg-num"
                      style={{
                        fontSize: 10,
                        color: "var(--yg-fg-tertiary)",
                        fontWeight: 500,
                        marginTop: 2,
                      }}
                    >
                      {new Date(o.created_at).toLocaleString("ko-KR")}
                      {o.filled_avg_price
                        ? ` · 체결가 ${Number(o.filled_avg_price).toLocaleString()}`
                        : ""}
                    </div>
                  </div>
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "flex-end",
                      gap: 6,
                    }}
                  >
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 800,
                        padding: "3px 8px",
                        borderRadius: 99,
                        background:
                          statusKey === "filled"
                            ? "var(--yg-bg-tint-red)"
                            : statusKey === "cancelled"
                              ? "var(--yg-bg-tint-ink)"
                              : "var(--yg-bg-sub)",
                        color:
                          statusKey === "filled"
                            ? "var(--yg-up-deep)"
                            : statusKey === "cancelled"
                              ? "var(--yg-fg-tertiary)"
                              : "var(--yg-fg-secondary)",
                      }}
                    >
                      {statusLabel}
                    </span>
                    {statusKey === "pending" && (
                      <CancelOrderButton orderId={o.id} />
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
