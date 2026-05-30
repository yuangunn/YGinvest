// Plan #44: 포트폴리오 Overview — YG 디자인.

import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { AllocationDonut } from "@/components/allocation-donut";
import { getSelectedPortfolioId } from "@/lib/portfolio-context";
import { PageHeader } from "@/components/yg/page-header";
import { DeltaText } from "@/components/yg/delta-text";
import { fmt } from "@/lib/yg-fmt";
import { fetchUsdKrwRate } from "@/lib/fx";

export default async function PortfolioOverview() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const portfolioId = await getSelectedPortfolioId(supabase, user.id);
  const { data: portfolio } = portfolioId
    ? await supabase
        .from("portfolios")
        .select(
          "id, krw_balance, usd_balance, starting_krw, starting_usd, fx_rate_at_start, room_id, status",
        )
        .eq("id", portfolioId)
        .single()
    : { data: null };

  const fxRate = await fetchUsdKrwRate(supabase);

  const { data: holdings } = await supabase
    .from("holdings")
    .select(
      "symbol, quantity, avg_cost, stocks(name, name_ko, currency, last_price)",
    )
    .eq("portfolio_id", portfolio?.id ?? "");

  const krwCash = Number(portfolio?.krw_balance ?? 0);
  const usdCash = Number(portfolio?.usd_balance ?? 0);
  const usdCashKrw = usdCash * fxRate;

  const slices: { name: string; value: number }[] = [];
  let totalHoldingsKrw = 0;
  for (const h of holdings ?? []) {
    const stock = Array.isArray(h.stocks) ? h.stocks[0] : h.stocks;
    if (!stock?.last_price) continue;
    const valueLocal = Number(stock.last_price) * Number(h.quantity);
    const valueKrw =
      stock.currency === "KRW" ? valueLocal : valueLocal * fxRate;
    totalHoldingsKrw += valueKrw;
    slices.push({
      name: stock.name_ko ?? stock.name ?? h.symbol,
      value: Math.round(valueKrw),
    });
  }
  if (krwCash > 0)
    slices.push({ name: "KRW 현금", value: Math.round(krwCash) });
  if (usdCashKrw > 0)
    slices.push({ name: "USD 현금", value: Math.round(usdCashKrw) });

  const totalKrw = krwCash + usdCashKrw + totalHoldingsKrw;
  const startingKrwEq =
    Number(portfolio?.starting_krw ?? 0) +
    Number(portfolio?.starting_usd ?? 0) *
      Number(portfolio?.fx_rate_at_start ?? fxRate);
  const returnAbs = totalKrw - startingKrwEq;
  const returnPct =
    startingKrwEq > 0 ? (returnAbs / startingKrwEq) * 100 : 0;

  return (
    <div style={{ paddingBottom: 16 }}>
      <PageHeader title="자산 현황" sub="전체 포트폴리오" />

      {/* 총자산 hero */}
      <div style={{ padding: "16px 20px 0" }}>
        <div className="yg-card yg-card-lg" style={{ padding: 22 }}>
          <div
            style={{
              fontSize: 13,
              fontWeight: 700,
              color: "var(--yg-fg-tertiary)",
              marginBottom: 6,
            }}
          >
            총 평가금액
          </div>
          <div
            className="yg-num"
            style={{
              fontSize: 32,
              fontWeight: 800,
              letterSpacing: "-0.03em",
              lineHeight: 1,
              display: "flex",
              alignItems: "baseline",
              gap: 4,
              color: "var(--yg-fg-primary)",
            }}
          >
            {fmt.krw(totalKrw)}
            <span
              style={{
                fontSize: 18,
                fontWeight: 700,
                color: "var(--yg-fg-secondary)",
              }}
            >
              원
            </span>
          </div>
          <div style={{ marginTop: 10 }}>
            <DeltaText pct={returnPct} abs={returnAbs} size={14} />
          </div>
          <div
            style={{
              marginTop: 14,
              fontSize: 11,
              color: "var(--yg-fg-tertiary)",
              fontWeight: 600,
            }}
          >
            시작 자본 {fmt.krw(startingKrwEq)}원 · 1 USD = ₩{fxRate}
          </div>
        </div>
      </div>

      {/* 현금/주식 분리 */}
      <div style={{ padding: "12px 20px 0", display: "flex", gap: 10 }}>
        <CashRow label="원화" value={krwCash} suffix="원" />
        <CashRow label="달러" value={usdCash} prefix="$" />
      </div>

      {/* 자산 배분 */}
      <div style={{ padding: "20px 20px 0" }}>
        <div className="yg-card" style={{ padding: 18 }}>
          <div
            style={{
              fontSize: 16,
              fontWeight: 800,
              letterSpacing: "-0.02em",
              marginBottom: 14,
              color: "var(--yg-fg-primary)",
            }}
          >
            자산 구성
          </div>
          <AllocationDonut slices={slices} />
        </div>
      </div>

      {/* 빠른 이동 */}
      <div
        style={{
          padding: "16px 20px 0",
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 10,
        }}
      >
        <Link
          href="/app/portfolio/holdings"
          className="yg-card yg-tap"
          style={{
            padding: 14,
            textDecoration: "none",
            color: "var(--yg-fg-primary)",
          }}
        >
          <div
            style={{
              fontSize: 12,
              color: "var(--yg-fg-tertiary)",
              fontWeight: 700,
            }}
          >
            보유 종목
          </div>
          <div style={{ fontSize: 15, fontWeight: 800, marginTop: 2 }}>
            {(holdings ?? []).length}개 ›
          </div>
        </Link>
        <Link
          href="/app/portfolio/transactions"
          className="yg-card yg-tap"
          style={{
            padding: 14,
            textDecoration: "none",
            color: "var(--yg-fg-primary)",
          }}
        >
          <div
            style={{
              fontSize: 12,
              color: "var(--yg-fg-tertiary)",
              fontWeight: 700,
            }}
          >
            거래 내역
          </div>
          <div style={{ fontSize: 15, fontWeight: 800, marginTop: 2 }}>
            전체 보기 ›
          </div>
        </Link>
      </div>
    </div>
  );
}

function CashRow({
  label,
  value,
  prefix,
  suffix,
}: {
  label: string;
  value: number;
  prefix?: string;
  suffix?: string;
}) {
  return (
    <div className="yg-card" style={{ flex: 1, padding: 14 }}>
      <div
        style={{
          fontSize: 11,
          color: "var(--yg-fg-tertiary)",
          fontWeight: 700,
        }}
      >
        {label} 현금
      </div>
      <div
        className="yg-num"
        style={{
          fontSize: 16,
          fontWeight: 800,
          letterSpacing: "-0.02em",
          marginTop: 4,
          color: "var(--yg-fg-primary)",
        }}
      >
        {prefix ?? ""}
        {prefix
          ? value.toLocaleString("en-US", { maximumFractionDigits: 2 })
          : fmt.krw(value)}
        {suffix ?? ""}
      </div>
    </div>
  );
}
