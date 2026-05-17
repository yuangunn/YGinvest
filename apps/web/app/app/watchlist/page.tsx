// Plan #45: 관심 종목 — YG 디자인.

import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getSelectedPortfolioId } from "@/lib/portfolio-context";
import { PageHeader } from "@/components/yg/page-header";
import { TickerBadge } from "@/components/yg/ticker-badge";
import { fmt as ygFmt } from "@/lib/yg-fmt";

function priceFmt(amount: number, currency: string) {
  return currency === "KRW" ? ygFmt.krw(amount) : ygFmt.usd(amount);
}

export default async function WatchlistPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const portfolioId = await getSelectedPortfolioId(supabase, user.id);
  const { data: items } = portfolioId
    ? await supabase
        .from("watchlists")
        .select(
          "symbol, added_at, stocks(name, name_ko, currency, market, last_price)",
        )
        .eq("portfolio_id", portfolioId)
        .order("added_at", { ascending: false })
    : { data: null };

  return (
    <div style={{ paddingBottom: 24 }}>
      <PageHeader
        title="관심 종목"
        sub={items ? `${items.length}개 종목` : "관심 종목 없음"}
      />

      <div style={{ padding: "8px 20px 0" }}>
        <div className="yg-card" style={{ padding: items?.length ? 18 : 36 }}>
          {!items || items.length === 0 ? (
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 40, marginBottom: 12 }} aria-hidden>
                ⭐
              </div>
              <div
                style={{
                  fontSize: 14,
                  fontWeight: 700,
                  color: "var(--yg-fg-secondary)",
                  marginBottom: 6,
                }}
              >
                관심 종목이 없어요
              </div>
              <div
                style={{
                  fontSize: 12,
                  color: "var(--yg-fg-tertiary)",
                  marginBottom: 14,
                }}
              >
                종목 검색 후 ☆로 추가해보세요
              </div>
              <Link
                href="/app/trade/search"
                className="yg-chip"
                style={{
                  background: "var(--yg-brand)",
                  color: "var(--yg-fg-on-brand)",
                  textDecoration: "none",
                  padding: "8px 14px",
                  fontSize: 12,
                }}
              >
                종목 검색 →
              </Link>
            </div>
          ) : (
            items.map((it, i) => {
              const stock = Array.isArray(it.stocks) ? it.stocks[0] : it.stocks;
              const isLast = i === items.length - 1;
              return (
                <Link
                  key={it.symbol}
                  href={`/app/trade/${encodeURIComponent(it.symbol)}`}
                  className="yg-tap"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    padding: "12px 0",
                    borderBottom: isLast
                      ? 0
                      : "1px solid var(--yg-line-faint)",
                    textDecoration: "none",
                    color: "var(--yg-fg-primary)",
                  }}
                >
                  <TickerBadge
                    symbol={String(it.symbol).slice(0, 3)}
                    size={36}
                  />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        fontSize: 14,
                        fontWeight: 800,
                        letterSpacing: "-0.01em",
                      }}
                    >
                      {stock?.name_ko ?? stock?.name ?? it.symbol}
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
                      {it.symbol} · {stock?.market ?? ""}
                    </div>
                  </div>
                  <div
                    className="yg-num"
                    style={{
                      fontSize: 14,
                      fontWeight: 800,
                      color: "var(--yg-fg-primary)",
                    }}
                  >
                    {stock?.last_price && stock?.currency
                      ? priceFmt(Number(stock.last_price), stock.currency)
                      : "—"}
                  </div>
                </Link>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
