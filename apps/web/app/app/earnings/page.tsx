// Plan #45: 실적 캘린더 — YG 디자인 (handoff Earnings 패턴).

import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/yg/page-header";
import { TickerBadge } from "@/components/yg/ticker-badge";

type EarningsRow = {
  symbol: string;
  report_date: string;
  eps_estimate: number | null;
  eps_actual: number | null;
  surprise_pct: number | null;
};

type StockMeta = {
  symbol: string;
  name: string;
  name_ko: string | null;
  market: string;
};

export default async function EarningsCalendarPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const today = new Date();
  const from = new Date(today.getTime() - 30 * 86400000)
    .toISOString()
    .slice(0, 10);
  const to = new Date(today.getTime() + 90 * 86400000)
    .toISOString()
    .slice(0, 10);

  const { data: events } = await supabase
    .from("earnings_events")
    .select("symbol, report_date, eps_estimate, eps_actual, surprise_pct")
    .gte("report_date", from)
    .lte("report_date", to)
    .order("report_date", { ascending: true })
    .limit(200);

  const rows = (events as EarningsRow[] | null) ?? [];

  if (rows.length === 0) {
    return (
      <div style={{ paddingBottom: 24 }}>
        <PageHeader title="실적 발표" sub="향후 90일 + 과거 30일" />
        <div style={{ padding: "8px 20px 0" }}>
          <div
            className="yg-card"
            style={{
              padding: 36,
              textAlign: "center",
              fontSize: 14,
              color: "var(--yg-fg-tertiary)",
              fontWeight: 700,
            }}
          >
            실적 데이터가 아직 없습니다.
            <div
              style={{
                fontSize: 11,
                marginTop: 6,
                color: "var(--yg-fg-tertiary)",
                fontWeight: 600,
              }}
            >
              매일 새벽 yfinance에서 자동 fetch
            </div>
          </div>
        </div>
      </div>
    );
  }

  const symbols = [...new Set(rows.map((r) => r.symbol))];
  const { data: stocks } = await supabase
    .from("stocks")
    .select("symbol, name, name_ko, market")
    .in("symbol", symbols);
  const meta = new Map<string, StockMeta>(
    ((stocks as StockMeta[] | null) ?? []).map((s) => [s.symbol, s]),
  );

  const byDate = new Map<string, EarningsRow[]>();
  for (const r of rows) {
    const arr = byDate.get(r.report_date) ?? [];
    arr.push(r);
    byDate.set(r.report_date, arr);
  }
  const todayStr = today.toISOString().slice(0, 10);
  const dates = [...byDate.keys()].sort();
  const upcoming = dates.filter((d) => d >= todayStr);
  const past = dates.filter((d) => d < todayStr).reverse();

  return (
    <div style={{ paddingBottom: 24 }}>
      <PageHeader
        title="실적 발표"
        sub={`다가오는 ${upcoming.length}일 · 최근 ${past.length}일`}
      />

      <Section title={`📅 다가오는 발표 (${upcoming.length}일)`}>
        {upcoming.length === 0 ? (
          <EmptyRow text="예정된 발표 없음" />
        ) : (
          upcoming.slice(0, 14).map((d) => (
            <DayBlock
              key={d}
              date={d}
              events={byDate.get(d) ?? []}
              meta={meta}
              isToday={d === todayStr}
            />
          ))
        )}
      </Section>

      {past.length > 0 && (
        <Section title="🔙 최근 발표 (surprise 확인)">
          {past.slice(0, 10).map((d) => (
            <DayBlock
              key={d}
              date={d}
              events={byDate.get(d) ?? []}
              meta={meta}
              isToday={false}
            />
          ))}
        </Section>
      )}
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div style={{ padding: "16px 20px 0" }}>
      <h3
        style={{
          margin: "0 4px 10px",
          fontSize: 16,
          fontWeight: 800,
          letterSpacing: "-0.02em",
        }}
      >
        {title}
      </h3>
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

function DayBlock({
  date,
  events,
  meta,
  isToday,
}: {
  date: string;
  events: EarningsRow[];
  meta: Map<string, StockMeta>;
  isToday: boolean;
}) {
  const d = new Date(date);
  const weekday = ["일", "월", "화", "수", "목", "금", "토"][d.getDay()];
  return (
    <div style={{ marginBottom: 14 }}>
      <div
        style={{
          fontSize: 11,
          fontWeight: 800,
          marginBottom: 6,
          letterSpacing: "0.02em",
          color: isToday ? "var(--yg-up-deep)" : "var(--yg-fg-tertiary)",
        }}
      >
        {date} ({weekday}) {isToday && "· 오늘"}
      </div>
      <div>
        {events.map((e, i) => {
          const m = meta.get(e.symbol);
          const name = m?.name_ko ?? m?.name ?? e.symbol;
          const surprise = e.surprise_pct;
          const isLast = i === events.length - 1;
          return (
            <Link
              key={`${e.symbol}-${e.report_date}`}
              href={`/app/trade/${encodeURIComponent(e.symbol)}`}
              className="yg-tap"
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "10px 0",
                borderBottom: isLast
                  ? 0
                  : "1px solid var(--yg-line-faint)",
                textDecoration: "none",
                color: "var(--yg-fg-primary)",
              }}
            >
              <TickerBadge symbol={String(e.symbol).slice(0, 3)} size={32} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    fontSize: 13,
                    fontWeight: 800,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {name}
                </div>
                <div
                  className="yg-num"
                  style={{
                    fontSize: 10,
                    color: "var(--yg-fg-tertiary)",
                    fontWeight: 600,
                  }}
                >
                  {e.symbol} · {m?.market}
                </div>
              </div>
              <div style={{ textAlign: "right" }}>
                {e.eps_actual !== null && e.eps_estimate !== null ? (
                  <>
                    <div
                      className="yg-num"
                      style={{
                        fontSize: 11,
                        color: "var(--yg-fg-secondary)",
                        fontWeight: 700,
                      }}
                    >
                      예상 {e.eps_estimate.toFixed(2)} → 실제{" "}
                      {e.eps_actual.toFixed(2)}
                    </div>
                    {surprise !== null && (
                      <div
                        className="yg-num"
                        style={{
                          fontSize: 12,
                          fontWeight: 800,
                          color:
                            surprise >= 0
                              ? "var(--yg-up-deep)"
                              : "var(--yg-down-deep)",
                        }}
                      >
                        {surprise >= 0 ? "+" : ""}
                        {surprise.toFixed(1)}%
                      </div>
                    )}
                  </>
                ) : e.eps_estimate !== null ? (
                  <div
                    className="yg-num"
                    style={{
                      fontSize: 11,
                      color: "var(--yg-fg-tertiary)",
                      fontWeight: 700,
                    }}
                  >
                    예상 EPS {e.eps_estimate.toFixed(2)}
                  </div>
                ) : (
                  <div
                    style={{
                      fontSize: 11,
                      color: "var(--yg-fg-tertiary)",
                      fontWeight: 700,
                    }}
                  >
                    발표 예정
                  </div>
                )}
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
