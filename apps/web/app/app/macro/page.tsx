import Link from "next/link";
import { redirect } from "next/navigation";
import { Activity, ArrowRight, BookOpen, Calendar } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type MacroMeta = {
  symbol: string;
  name_ko: string;
  unit: string;
  group_name: string;
  description_ko: string | null;
  sort_order: number;
};

type MacroPoint = { symbol: string; ts: string; value: number };

const GROUP_LABEL: Record<string, string> = {
  rate: "📊 금리",
  fx: "💱 환율 / 통화",
  commodity: "🛢️ 원자재",
  risk: "⚡ 위험 지표",
  index: "📈 주가 지수",
};

export default async function MacroPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  // 최근 90일 macro 데이터 + 메타 불러오기
  const [{ data: metaData }, { data: indData }] = await Promise.all([
    supabase
      .from("macro_meta")
      .select("symbol, name_ko, unit, group_name, description_ko, sort_order")
      .order("sort_order"),
    supabase
      .from("macro_indicators")
      .select("symbol, ts, value")
      .gte(
        "ts",
        new Date(new Date().getTime() - 90 * 86400000).toISOString().slice(0, 10),
      )
      .order("ts", { ascending: true }),
  ]);

  const meta = (metaData as MacroMeta[] | null) ?? [];
  const points = (indData as MacroPoint[] | null) ?? [];

  // 심볼별 최신/이전값 + 30일 시리즈 추출
  type Series = {
    latest: number | null;
    latestTs: string | null;
    prev: number | null;
    series30: { ts: string; value: number }[];
  };
  const bySymbol = new Map<string, Series>();
  for (const m of meta) bySymbol.set(m.symbol, { latest: null, latestTs: null, prev: null, series30: [] });
  for (const p of points) {
    const s = bySymbol.get(p.symbol);
    if (!s) continue;
    s.series30.push({ ts: p.ts, value: Number(p.value) });
  }
  for (const [, s] of bySymbol) {
    s.series30.sort((a, b) => (a.ts < b.ts ? -1 : 1));
    const last30 = s.series30.slice(-30);
    s.series30 = last30;
    if (last30.length > 0) {
      s.latest = last30[last30.length - 1].value;
      s.latestTs = last30[last30.length - 1].ts;
      s.prev = last30.length > 1 ? last30[last30.length - 2].value : null;
    }
  }

  // 그룹별 분류
  const groups = new Map<string, MacroMeta[]>();
  for (const m of meta) {
    const arr = groups.get(m.group_name) ?? [];
    arr.push(m);
    groups.set(m.group_name, arr);
  }

  return (
    <div className="max-w-5xl mx-auto p-4 space-y-4">
      <div>
        <h1 className="text-xl font-bold flex items-center gap-2">
          <Activity className="h-5 w-5 text-primary" />
          거시경제 대시보드
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          금리·환율·원자재·지수 한눈에. 주식시장에 영향을 미치는 거시 변수.
        </p>
      </div>

      <div className="flex gap-2 flex-wrap">
        <Link
          href="/app/macro/guide"
          className="inline-flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-md border border-primary/40 bg-primary/5 hover:bg-primary/10 text-primary font-medium"
        >
          📖 지표 읽는 법
          <ArrowRight className="h-3 w-3 opacity-50" />
        </Link>
        <Link
          href="/app/macro/calendar"
          className="inline-flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-md border hover:bg-accent"
        >
          <Calendar className="h-3.5 w-3.5" />
          경제 캘린더
          <ArrowRight className="h-3 w-3 opacity-50" />
        </Link>
        <Link
          href="/app/macro/history"
          className="inline-flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-md border hover:bg-accent"
        >
          <BookOpen className="h-3.5 w-3.5" />
          경제 사건 타임라인
          <ArrowRight className="h-3 w-3 opacity-50" />
        </Link>
        <Link
          href="/app/portfolio/scenarios"
          className="inline-flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-md border hover:bg-accent"
        >
          📊 포트폴리오 시나리오 분석
          <ArrowRight className="h-3 w-3 opacity-50" />
        </Link>
      </div>

      {[...groups.entries()].map(([groupKey, items]) => (
        <Card key={groupKey}>
          <CardHeader>
            <CardTitle className="text-base">
              {GROUP_LABEL[groupKey] ?? groupKey}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {items.map((m) => {
                const s = bySymbol.get(m.symbol);
                return (
                  <MacroCard key={m.symbol} meta={m} series={s ?? null} />
                );
              })}
            </div>
          </CardContent>
        </Card>
      ))}

      {meta.length > 0 &&
        bySymbol.size > 0 &&
        ![...bySymbol.values()].some((s) => s.latest !== null) && (
          <Card>
            <CardContent className="py-4 text-sm text-muted-foreground text-center">
              아직 거시경제 데이터가 수집되지 않았습니다. 워커가 매일 03:30 KST에 fetch합니다.
            </CardContent>
          </Card>
        )}

      <p className="text-xs text-muted-foreground text-center mt-4">
        📚 데이터는 매일 03:30 KST에 yfinance에서 자동 수집됩니다. 한국 기준금리는 한은 결정에 따라 별도 업데이트됩니다.
      </p>
    </div>
  );
}

function MacroCard({
  meta,
  series,
}: {
  meta: MacroMeta;
  series: {
    latest: number | null;
    latestTs: string | null;
    prev: number | null;
    series30: { ts: string; value: number }[];
  } | null;
}) {
  const latest = series?.latest ?? null;
  const prev = series?.prev ?? null;
  const change = latest !== null && prev !== null ? latest - prev : null;
  const changePct =
    latest !== null && prev !== null && prev !== 0
      ? ((latest - prev) / prev) * 100
      : null;

  const fmt = (v: number | null): string => {
    if (v === null) return "—";
    if (Math.abs(v) >= 1000) return v.toLocaleString("en-US", { maximumFractionDigits: 0 });
    if (Math.abs(v) >= 100) return v.toFixed(1);
    if (Math.abs(v) >= 10) return v.toFixed(2);
    return v.toFixed(3);
  };

  return (
    <div className="border rounded-lg p-3 space-y-2">
      <div>
        <div className="text-xs text-muted-foreground">{meta.name_ko}</div>
        <div className="flex items-baseline gap-2 mt-0.5">
          <span className="text-xl font-bold font-mono tabular-nums">
            {fmt(latest)}
          </span>
          {meta.unit && (
            <span className="text-[10px] text-muted-foreground">{meta.unit}</span>
          )}
        </div>
      </div>
      {change !== null && changePct !== null && (
        <div
          className={`text-xs font-mono tabular-nums ${
            change > 0
              ? "text-red-500"
              : change < 0
                ? "text-blue-500"
                : "text-muted-foreground"
          }`}
        >
          {change > 0 ? "▲" : change < 0 ? "▼" : "—"}{" "}
          {Math.abs(change).toFixed(meta.unit === "%" ? 3 : 2)} (
          {changePct.toFixed(2)}%)
          <span className="text-muted-foreground ml-1 text-[10px]">전일</span>
        </div>
      )}
      {series && series.series30.length >= 2 && (
        <Sparkline series={series.series30} />
      )}
      {meta.description_ko && (
        <div className="text-[10px] text-muted-foreground leading-relaxed">
          {meta.description_ko}
        </div>
      )}
    </div>
  );
}

function Sparkline({ series }: { series: { ts: string; value: number }[] }) {
  if (series.length < 2) return null;
  const values = series.map((s) => s.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const W = 100;
  const H = 24;
  const path = series
    .map((s, i) => {
      const x = (i / (series.length - 1)) * W;
      const y = H - ((s.value - min) / range) * H;
      return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  const last = series[series.length - 1].value;
  const first = series[0].value;
  const up = last >= first;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-6">
      <path
        d={path}
        fill="none"
        stroke={up ? "#ef4444" : "#3b82f6"}
        strokeWidth="1.5"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}
