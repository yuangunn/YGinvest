// Plan #44: 거래 내역 — YG 디자인.

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSelectedPortfolioId } from "@/lib/portfolio-context";
import { PageHeader } from "@/components/yg/page-header";
import { TickerBadge } from "@/components/yg/ticker-badge";
import { fmt as ygFmt } from "@/lib/yg-fmt";

function priceFmt(amount: number, currency: string) {
  return currency === "KRW" ? ygFmt.krw(amount) : ygFmt.usd(amount);
}

export default async function TransactionsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
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
    <div style={{ paddingBottom: 16 }}>
      <PageHeader title="거래 내역" sub="체결 · 환전 · 배당" />

      <Section title="체결" count={trades.data?.length ?? 0}>
        {!trades.data?.length ? (
          <EmptyRow text="체결 없음" />
        ) : (
          trades.data.map((t, i) => {
            const isBuy = t.side === "buy";
            const isLast = i === trades.data!.length - 1;
            return (
              <div
                key={t.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  padding: "12px 0",
                  borderBottom: isLast
                    ? 0
                    : "1px solid var(--yg-line-faint)",
                }}
              >
                <TickerBadge symbol={String(t.symbol).slice(0, 3)} size={36} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      fontSize: 14,
                      fontWeight: 800,
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                    }}
                  >
                    {t.symbol}
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
                    {t.quantity}주 @ {priceFmt(Number(t.price), t.currency)} ·
                    수수료 {priceFmt(Number(t.fee ?? 0), t.currency)}
                  </div>
                  <div
                    style={{
                      fontSize: 10,
                      color: "var(--yg-fg-tertiary)",
                      marginTop: 2,
                    }}
                  >
                    {new Date(t.executed_at).toLocaleString("ko-KR")}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </Section>

      <Section title="환전" count={fx.data?.length ?? 0}>
        {!fx.data?.length ? (
          <EmptyRow text="환전 없음" />
        ) : (
          fx.data.map((f, i) => {
            const isLast = i === fx.data!.length - 1;
            return (
              <div
                key={f.id}
                style={{
                  padding: "12px 0",
                  borderBottom: isLast
                    ? 0
                    : "1px solid var(--yg-line-faint)",
                }}
              >
                <div
                  className="yg-num"
                  style={{ fontSize: 14, fontWeight: 800 }}
                >
                  {priceFmt(Number(f.from_amount), f.from_currency)} →{" "}
                  {priceFmt(Number(f.to_amount), f.to_currency)}
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
                  환율 {Number(f.rate).toFixed(2)} ·{" "}
                  {new Date(f.executed_at).toLocaleString("ko-KR")}
                </div>
              </div>
            );
          })
        )}
      </Section>

      <Section title="배당" count={dividends.data?.length ?? 0}>
        {!dividends.data?.length ? (
          <EmptyRow text="배당 없음" />
        ) : (
          dividends.data.map((d, i) => {
            const isLast = i === dividends.data!.length - 1;
            return (
              <div
                key={d.id}
                style={{
                  display: "flex",
                  gap: 12,
                  padding: "12px 0",
                  borderBottom: isLast
                    ? 0
                    : "1px solid var(--yg-line-faint)",
                }}
              >
                <TickerBadge symbol={String(d.symbol).slice(0, 3)} size={36} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 800 }}>
                    {d.symbol} · {d.qty}주
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
                    {priceFmt(Number(d.gross), d.currency)} − 세{" "}
                    {priceFmt(Number(d.tax), d.currency)} ={" "}
                    <strong style={{ color: "var(--yg-up-deep)" }}>
                      {priceFmt(Number(d.net), d.currency)}
                    </strong>
                  </div>
                  <div
                    style={{
                      fontSize: 10,
                      color: "var(--yg-fg-tertiary)",
                      marginTop: 2,
                    }}
                  >
                    배당기준일 {d.ex_date} ·{" "}
                    {new Date(d.executed_at).toLocaleString("ko-KR")}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </Section>
    </div>
  );
}

function Section({
  title,
  count,
  children,
}: {
  title: string;
  count: number;
  children: React.ReactNode;
}) {
  return (
    <div style={{ padding: "16px 20px 0" }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 10,
          padding: "0 4px",
        }}
      >
        <h3
          style={{
            margin: 0,
            fontSize: 16,
            fontWeight: 800,
            letterSpacing: "-0.02em",
          }}
        >
          {title}
        </h3>
        <span
          className="yg-num"
          style={{
            fontSize: 12,
            fontWeight: 700,
            color: "var(--yg-fg-tertiary)",
          }}
        >
          {count}건
        </span>
      </div>
      <div className="yg-card" style={{ padding: 18 }}>
        {children}
      </div>
    </div>
  );
}

function EmptyRow({ text }: { text: string }) {
  return (
    <div
      style={{
        fontSize: 13,
        color: "var(--yg-fg-tertiary)",
        fontWeight: 600,
      }}
    >
      {text}
    </div>
  );
}
