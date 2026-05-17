// Plan #44: 보유 종목 — YG 디자인.

import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getSelectedPortfolioId } from "@/lib/portfolio-context";
import { PageHeader } from "@/components/yg/page-header";
import { TickerBadge } from "@/components/yg/ticker-badge";
import { DeltaText } from "@/components/yg/delta-text";
import { fmt } from "@/lib/yg-fmt";

export default async function HoldingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const portfolioId = await getSelectedPortfolioId(supabase, user.id);
  const { data: holdings } = portfolioId
    ? await supabase
        .from("holdings")
        .select(
          "portfolio_id, symbol, quantity, avg_cost, updated_at, stocks(name, name_ko, currency, market, last_price)",
        )
        .eq("portfolio_id", portfolioId)
    : { data: null };

  const list = holdings ?? [];

  return (
    <div style={{ paddingBottom: 16 }}>
      <PageHeader title="보유 종목" sub={`${list.length}개`} />

      {list.length === 0 ? (
        <div style={{ padding: "60px 20px", textAlign: "center" }}>
          <div style={{ fontSize: 36, marginBottom: 12 }}>📈</div>
          <div
            style={{
              fontSize: 14,
              color: "var(--yg-fg-tertiary)",
              fontWeight: 600,
            }}
          >
            아직 보유 종목이 없어요
          </div>
          <Link
            href="/app/trade/search"
            style={{
              display: "inline-block",
              marginTop: 16,
              padding: "10px 18px",
              borderRadius: 12,
              fontSize: 14,
              fontWeight: 700,
              background: "var(--yg-brand)",
              color: "var(--yg-fg-on-brand)",
              textDecoration: "none",
            }}
          >
            종목 검색하기
          </Link>
        </div>
      ) : (
        <div style={{ padding: "12px 20px 0" }}>
          <div className="yg-card" style={{ padding: 18 }}>
            {list.map((h, i) => {
              const stock = Array.isArray(h.stocks) ? h.stocks[0] : h.stocks;
              const isKRW = stock?.currency === "KRW";
              const avgCost = Number(h.avg_cost);
              const qty = Number(h.quantity);
              const lastPrice = stock?.last_price
                ? Number(stock.last_price)
                : null;
              const cost = avgCost * qty;
              const value = lastPrice ? lastPrice * qty : null;
              const pl = value !== null ? value - cost : null;
              const plPct = cost > 0 && pl != null ? (pl / cost) * 100 : null;
              const isLast = i === list.length - 1;

              return (
                <Link
                  key={h.symbol}
                  href={`/app/trade/${encodeURIComponent(h.symbol)}`}
                  className="yg-tap"
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: 8,
                    padding: "14px 0",
                    borderBottom: isLast
                      ? 0
                      : "1px solid var(--yg-line-faint)",
                    textDecoration: "none",
                    color: "var(--yg-fg-primary)",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 12,
                    }}
                  >
                    <TickerBadge symbol={h.symbol.slice(0, 3)} size={40} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        style={{
                          fontSize: 15,
                          fontWeight: 800,
                          letterSpacing: "-0.015em",
                        }}
                      >
                        {stock?.name_ko ?? stock?.name ?? h.symbol}
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
                        {h.symbol} · {stock?.market ?? "—"} · {qty}주
                      </div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      {value !== null && (
                        <div
                          className="yg-num"
                          style={{ fontSize: 15, fontWeight: 800 }}
                        >
                          {isKRW ? fmt.krw(value) : fmt.usd(value)}
                        </div>
                      )}
                      {plPct != null && (
                        <DeltaText pct={plPct} size={11} />
                      )}
                    </div>
                  </div>

                  {/* 평단 / 평가금 / 손익 */}
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr 1fr 1fr",
                      fontSize: 11,
                      fontWeight: 700,
                      color: "var(--yg-fg-tertiary)",
                      background: "var(--yg-bg-sub)",
                      borderRadius: 10,
                      padding: "10px 12px",
                      gap: 4,
                    }}
                  >
                    <div>
                      평단{" "}
                      <span
                        className="yg-num"
                        style={{
                          color: "var(--yg-fg-primary)",
                          fontWeight: 800,
                        }}
                      >
                        {isKRW ? fmt.krw(avgCost) : fmt.usd(avgCost)}
                      </span>
                    </div>
                    <div>
                      투자금{" "}
                      <span
                        className="yg-num"
                        style={{
                          color: "var(--yg-fg-primary)",
                          fontWeight: 800,
                        }}
                      >
                        {isKRW ? fmt.krw(cost) : fmt.usd(cost)}
                      </span>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      손익{" "}
                      <span
                        className="yg-num"
                        style={{
                          color:
                            pl != null && pl >= 0
                              ? "var(--yg-up-deep)"
                              : "var(--yg-down-deep)",
                          fontWeight: 800,
                        }}
                      >
                        {pl != null
                          ? (pl >= 0 ? "+" : "") +
                            (isKRW ? fmt.krw(pl) : fmt.usd(pl))
                          : "—"}
                      </span>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
