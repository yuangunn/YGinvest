// Plan #44: 거래 내역 — YG 디자인. (페이지네이션 지원)

import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/supabase/user";
import { getSelectedPortfolioId } from "@/lib/portfolio-context";
import { PageHeader } from "@/components/yg/page-header";
import { TickerBadge } from "@/components/yg/ticker-badge";
import { fmt as ygFmt } from "@/lib/yg-fmt";

const PAGE_SIZE = 20;

function priceFmt(amount: number, currency: string) {
  return currency === "KRW" ? ygFmt.krw(amount) : ygFmt.usd(amount);
}

// searchParams의 페이지 번호 파싱 (1부터, 잘못된 값은 1로)
function parsePage(v: string | undefined): number {
  const n = Number(v);
  return Number.isFinite(n) && n >= 1 ? Math.floor(n) : 1;
}

export default async function TransactionsPage({
  searchParams,
}: {
  searchParams: Promise<{ tp?: string; fp?: string; dp?: string }>;
}) {
  const supabase = await createClient();
  const user = await getCurrentUser();
  if (!user) redirect("/auth/login");

  const params = await searchParams;
  const tPage = parsePage(params.tp); // 체결
  const fPage = parsePage(params.fp); // 환전
  const dPage = parsePage(params.dp); // 배당

  const rangeFor = (page: number): [number, number] => {
    const from = (page - 1) * PAGE_SIZE;
    return [from, from + PAGE_SIZE - 1];
  };

  const portfolioId = await getSelectedPortfolioId(supabase, user.id);
  const [trades, fx, dividends] = portfolioId
    ? await Promise.all([
        supabase
          .from("trades")
          .select("*", { count: "exact" })
          .eq("portfolio_id", portfolioId)
          .order("executed_at", { ascending: false })
          .range(...rangeFor(tPage)),
        supabase
          .from("fx_transactions")
          .select("*", { count: "exact" })
          .eq("portfolio_id", portfolioId)
          .order("executed_at", { ascending: false })
          .range(...rangeFor(fPage)),
        supabase
          .from("dividend_payouts")
          .select("*", { count: "exact" })
          .eq("portfolio_id", portfolioId)
          .order("executed_at", { ascending: false })
          .range(...rangeFor(dPage)),
      ])
    : [
        { data: null, count: 0 },
        { data: null, count: 0 },
        { data: null, count: 0 },
      ];

  return (
    <div style={{ paddingBottom: 16 }}>
      <PageHeader title="거래 내역" sub="체결 · 환전 · 배당" />

      <Section
        title="체결"
        total={trades.count ?? 0}
        page={tPage}
        pageParam="tp"
        otherParams={{ fp: fPage, dp: dPage }}
      >
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

      <Section
        title="환전"
        total={fx.count ?? 0}
        page={fPage}
        pageParam="fp"
        otherParams={{ tp: tPage, dp: dPage }}
      >
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

      <Section
        title="배당"
        total={dividends.count ?? 0}
        page={dPage}
        pageParam="dp"
        otherParams={{ tp: tPage, fp: fPage }}
      >
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
  total,
  page,
  pageParam,
  otherParams,
  children,
}: {
  title: string;
  total: number;
  page: number;
  pageParam: string;
  otherParams: Record<string, number>;
  children: React.ReactNode;
}) {
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const hasPrev = page > 1;
  const hasNext = page < totalPages;

  // 다른 섹션 페이지는 유지하면서 이 섹션 페이지만 바꾸는 링크 생성
  const linkTo = (p: number) => {
    const sp = new URLSearchParams();
    for (const [k, v] of Object.entries(otherParams)) {
      if (v > 1) sp.set(k, String(v));
    }
    if (p > 1) sp.set(pageParam, String(p));
    const qs = sp.toString();
    return qs ? `?${qs}` : "?";
  };

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
          총 {total}건
        </span>
      </div>
      <div className="yg-card" style={{ padding: 18 }}>
        {children}
      </div>

      {totalPages > 1 && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 14,
            marginTop: 10,
          }}
        >
          <PagerLink
            href={linkTo(page - 1)}
            disabled={!hasPrev}
            label="‹ 이전"
          />
          <span
            className="yg-num"
            style={{
              fontSize: 12,
              fontWeight: 700,
              color: "var(--yg-fg-tertiary)",
            }}
          >
            {page} / {totalPages}
          </span>
          <PagerLink
            href={linkTo(page + 1)}
            disabled={!hasNext}
            label="다음 ›"
          />
        </div>
      )}
    </div>
  );
}

function PagerLink({
  href,
  disabled,
  label,
}: {
  href: string;
  disabled: boolean;
  label: string;
}) {
  if (disabled) {
    return (
      <span
        style={{
          fontSize: 13,
          fontWeight: 700,
          color: "var(--yg-fg-faint)",
          padding: "6px 12px",
          opacity: 0.5,
        }}
      >
        {label}
      </span>
    );
  }
  return (
    <Link
      href={href}
      scroll={false}
      className="yg-tap"
      style={{
        fontSize: 13,
        fontWeight: 800,
        color: "var(--yg-fg-primary)",
        padding: "6px 12px",
        borderRadius: 8,
        background: "var(--yg-bg-tint-ink)",
        textDecoration: "none",
      }}
    >
      {label}
    </Link>
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
