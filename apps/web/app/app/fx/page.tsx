// Plan #45: 환전 — YG 디자인.

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/yg/page-header";
import { FxExchangeForm } from "@/components/fx-exchange-form";
import { getSelectedPortfolioId } from "@/lib/portfolio-context";

export default async function FxPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const portfolioId = await getSelectedPortfolioId(supabase, user.id);
  const { data: portfolio } = portfolioId
    ? await supabase
        .from("portfolios")
        .select("id, krw_balance, usd_balance, status")
        .eq("id", portfolioId)
        .single()
    : { data: null };

  const { data: fx } = await supabase
    .from("fx_rates")
    .select("rate, ts")
    .eq("base", "USD")
    .eq("quote", "KRW")
    .order("ts", { ascending: false })
    .limit(1)
    .maybeSingle();

  return (
    <div style={{ paddingBottom: 24 }}>
      <PageHeader title="환전" sub="원화 ↔ 달러" />

      {/* 환율 hero */}
      <div style={{ padding: "8px 20px 0" }}>
        <div className="yg-card yg-card-lg" style={{ padding: 22 }}>
          <div
            style={{
              fontSize: 13,
              fontWeight: 700,
              color: "var(--yg-fg-tertiary)",
              marginBottom: 6,
            }}
          >
            현재 환율
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "baseline",
              gap: 8,
            }}
          >
            <span
              className="yg-num"
              style={{
                fontSize: 30,
                fontWeight: 800,
                letterSpacing: "-0.025em",
                color: "var(--yg-fg-primary)",
              }}
            >
              {fx?.rate ? Number(fx.rate).toFixed(2) : "—"}
            </span>
            <span
              style={{
                fontSize: 14,
                fontWeight: 700,
                color: "var(--yg-fg-secondary)",
              }}
            >
              원/달러
            </span>
          </div>
          {fx?.ts && (
            <div
              style={{
                fontSize: 11,
                color: "var(--yg-fg-tertiary)",
                fontWeight: 600,
                marginTop: 8,
              }}
            >
              {new Date(fx.ts).toLocaleString("ko-KR")} 기준
            </div>
          )}
        </div>
      </div>

      {/* 환전 폼 */}
      <div style={{ padding: "12px 20px 0" }}>
        <div className="yg-card" style={{ padding: 18 }}>
          <h3
            style={{
              margin: "0 0 12px",
              fontSize: 16,
              fontWeight: 800,
              letterSpacing: "-0.02em",
            }}
          >
            KRW ↔ USD
          </h3>
          {portfolio ? (
            <FxExchangeForm
              portfolioId={portfolio.id}
              krwBalance={Number(portfolio.krw_balance)}
              usdBalance={Number(portfolio.usd_balance)}
              rate={fx?.rate ? Number(fx.rate) : null}
            />
          ) : (
            <div
              style={{
                fontSize: 13,
                color: "var(--yg-fg-tertiary)",
                fontWeight: 600,
                textAlign: "center",
                padding: 20,
              }}
            >
              포트폴리오 없음
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
