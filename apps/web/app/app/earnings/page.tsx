import Link from "next/link";
import { redirect } from "next/navigation";
import { Calendar } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

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

  // 오늘 ~ 90일 후 + 과거 30일 (실적 surprise 확인)
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
      <div className="max-w-3xl mx-auto p-4 space-y-4">
        <h1 className="text-xl font-bold flex items-center gap-2">
          <Calendar className="h-5 w-5 text-primary" />
          실적 발표 캘린더
        </h1>
        <Card>
          <CardContent className="py-6 text-center">
            <p className="text-sm text-muted-foreground">
              실적 데이터가 아직 없습니다. 매일 새벽 yfinance에서 자동 fetch됩니다.
            </p>
          </CardContent>
        </Card>
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

  // group by date
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
    <div className="max-w-3xl mx-auto p-4 space-y-4">
      <div>
        <h1 className="text-xl font-bold flex items-center gap-2">
          <Calendar className="h-5 w-5 text-primary" />
          실적 발표 캘린더
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          향후 90일 + 과거 30일. 실적 발표 전후로 주가 변동 큰 경향.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">📅 다가오는 발표 ({upcoming.length}일)</CardTitle>
        </CardHeader>
        <CardContent>
          {upcoming.length === 0 ? (
            <p className="text-sm text-muted-foreground">예정된 발표 없음</p>
          ) : (
            <div className="space-y-3">
              {upcoming.slice(0, 14).map((d) => (
                <DayBlock
                  key={d}
                  date={d}
                  events={byDate.get(d) ?? []}
                  meta={meta}
                  isToday={d === todayStr}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {past.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">🔙 최근 발표 (surprise 확인)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {past.slice(0, 10).map((d) => (
                <DayBlock
                  key={d}
                  date={d}
                  events={byDate.get(d) ?? []}
                  meta={meta}
                  isToday={false}
                />
              ))}
            </div>
          </CardContent>
        </Card>
      )}
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
    <div>
      <div
        className={`text-xs font-semibold mb-1 ${
          isToday ? "text-primary" : "text-muted-foreground"
        }`}
      >
        {date} ({weekday}) {isToday && "· 오늘"}
      </div>
      <div className="space-y-1">
        {events.map((e) => {
          const m = meta.get(e.symbol);
          const name = m?.name_ko ?? m?.name ?? e.symbol;
          const surprise = e.surprise_pct;
          return (
            <Link
              key={`${e.symbol}-${e.report_date}`}
              href={`/app/trade/${encodeURIComponent(e.symbol)}`}
              className="flex items-center justify-between gap-2 rounded p-2 hover:bg-muted/30 text-sm"
            >
              <div className="min-w-0">
                <div className="font-medium truncate">{name}</div>
                <div className="text-[10px] text-muted-foreground">
                  {e.symbol} · {m?.market}
                </div>
              </div>
              <div className="text-right text-xs">
                {e.eps_actual !== null && e.eps_estimate !== null ? (
                  <>
                    <div className="tabular-nums">
                      예상 {e.eps_estimate.toFixed(2)} · 실제 {e.eps_actual.toFixed(2)}
                    </div>
                    {surprise !== null && (
                      <div
                        className={`tabular-nums font-medium ${
                          surprise >= 0 ? "text-green-500" : "text-red-500"
                        }`}
                      >
                        {surprise >= 0 ? "+" : ""}
                        {surprise.toFixed(1)}% surprise
                      </div>
                    )}
                  </>
                ) : e.eps_estimate !== null ? (
                  <div className="text-muted-foreground tabular-nums">
                    예상 EPS {e.eps_estimate.toFixed(2)}
                  </div>
                ) : (
                  <div className="text-muted-foreground">발표 예정</div>
                )}
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
