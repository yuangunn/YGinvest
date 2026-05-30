import { redirect } from "next/navigation";
import { Calendar } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/supabase/user";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type EconomicEvent = {
  id: string;
  event_date: string;
  country: string;
  kind: string;
  title: string;
  description_ko: string | null;
  importance: number;
};

const KIND_ICON: Record<string, string> = {
  fomc: "🏦",
  kr_mpc: "🇰🇷",
  cpi: "📊",
  employment: "👷",
  earnings_szn: "💼",
  other: "📅",
};

const COUNTRY_LABEL: Record<string, string> = {
  KR: "한국",
  US: "미국",
  GLOBAL: "글로벌",
};

export default async function EconomicCalendarPage() {
  const supabase = await createClient();
  const user = await getCurrentUser();
  if (!user) redirect("/auth/login");

  const today = new Date().toISOString().slice(0, 10);
  const sixMonthsLater = new Date(new Date().getTime() + 180 * 86400000)
    .toISOString()
    .slice(0, 10);
  const oneMonthAgo = new Date(new Date().getTime() - 30 * 86400000)
    .toISOString()
    .slice(0, 10);

  const { data: events } = await supabase
    .from("economic_events")
    .select("id, event_date, country, kind, title, description_ko, importance")
    .gte("event_date", oneMonthAgo)
    .lte("event_date", sixMonthsLater)
    .order("event_date");

  const rows = (events as EconomicEvent[] | null) ?? [];
  const upcoming = rows.filter((e) => e.event_date >= today);
  const past = rows.filter((e) => e.event_date < today).reverse();

  // 일별 그룹핑
  const grouped = (list: EconomicEvent[]) => {
    const m = new Map<string, EconomicEvent[]>();
    for (const e of list) {
      const arr = m.get(e.event_date) ?? [];
      arr.push(e);
      m.set(e.event_date, arr);
    }
    return [...m.entries()];
  };

  const formatDate = (iso: string) => {
    const d = new Date(iso + "T00:00:00");
    const days = ["일", "월", "화", "수", "목", "금", "토"];
    return `${d.getMonth() + 1}.${d.getDate()} (${days[d.getDay()]})`;
  };

  const daysAway = (iso: string) => {
    const ms = new Date(iso + "T00:00:00").getTime() - new Date().getTime();
    const days = Math.round(ms / 86400000);
    if (days === 0) return "오늘";
    if (days === 1) return "내일";
    if (days < 0) return `${-days}일 전`;
    return `D-${days}`;
  };

  return (
    <div className="max-w-3xl mx-auto p-4 space-y-4">
      <div>
        <h1 className="text-xl font-bold flex items-center gap-2">
          <Calendar className="h-5 w-5 text-primary" />
          경제 캘린더
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          한국·미국 주요 통화정책 / 물가지표 / 고용지표 발표 일정.
        </p>
      </div>

      {/* Upcoming */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">예정된 이벤트 ({upcoming.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {upcoming.length === 0 ? (
            <p className="text-sm text-muted-foreground">예정된 이벤트가 없습니다</p>
          ) : (
            <div className="space-y-3">
              {grouped(upcoming).map(([date, evts]) => (
                <div key={date} className="border-l-2 border-primary/30 pl-3">
                  <div className="flex items-baseline gap-2 mb-1">
                    <span className="text-sm font-semibold">
                      {formatDate(date)}
                    </span>
                    <span className="text-[10px] text-primary font-medium">
                      {daysAway(date)}
                    </span>
                  </div>
                  <div className="space-y-1.5">
                    {evts.map((e) => (
                      <EventRow key={e.id} event={e} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Past */}
      {past.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base text-muted-foreground">
              최근 30일 이벤트 ({past.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {grouped(past).map(([date, evts]) => (
                <div
                  key={date}
                  className="border-l-2 border-muted pl-3 opacity-70"
                >
                  <div className="text-xs font-medium text-muted-foreground mb-1">
                    {formatDate(date)} · {daysAway(date)}
                  </div>
                  <div className="space-y-1.5">
                    {evts.map((e) => (
                      <EventRow key={e.id} event={e} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="text-xs text-muted-foreground py-3 space-y-2">
          <p className="font-semibold text-foreground">📚 왜 중요한가?</p>
          <p>
            <strong>FOMC (미국 연준)</strong>: 미국 기준금리 결정. 발표 후 점도표(향후 금리 경로)도 확인 — 글로벌 자산시장 최대 변수.
          </p>
          <p>
            <strong>한은 금통위</strong>: 한국 기준금리 결정. 미국과 격차 벌어지면 환율·자본유출 압력.
          </p>
          <p>
            <strong>CPI (소비자물가)</strong>: 인플레이션 강도. 높으면 Fed 매파적 → 주식 약세.
          </p>
          <p>
            <strong>NFP (비농업 고용)</strong>: 미국 일자리 변화. 너무 강하면 인플레 우려, 너무 약하면 침체 우려 — &quot;골디락스&quot; 데이터 선호.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function EventRow({ event }: { event: EconomicEvent }) {
  const dots = "●".repeat(event.importance);
  return (
    <div className="flex items-start gap-2 text-sm">
      <span className="text-base flex-shrink-0">
        {KIND_ICON[event.kind] ?? "📅"}
      </span>
      <div className="flex-1 min-w-0">
        <div className="font-medium truncate">{event.title}</div>
        {event.description_ko && (
          <div className="text-[11px] text-muted-foreground truncate">
            {event.description_ko}
          </div>
        )}
      </div>
      <div className="flex flex-col items-end flex-shrink-0">
        <span className="text-[9px] text-muted-foreground">
          {COUNTRY_LABEL[event.country] ?? event.country}
        </span>
        <span
          className="text-[8px] text-orange-500"
          title={`중요도 ${event.importance}/3`}
        >
          {dots}
        </span>
      </div>
    </div>
  );
}
