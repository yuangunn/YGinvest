import { redirect } from "next/navigation";
import { BookOpen } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { HISTORICAL_EVENTS } from "@/lib/historical-events";

const REGION_LABEL: Record<string, string> = {
  KR: "🇰🇷 한국",
  US: "🇺🇸 미국",
  GLOBAL: "🌐 글로벌",
};

export default async function MacroHistoryPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  // 시간순 정렬 (최신부터)
  const events = [...HISTORICAL_EVENTS].sort((a, b) =>
    a.startDate < b.startDate ? 1 : -1,
  );

  return (
    <div className="max-w-3xl mx-auto p-4 space-y-4">
      <div>
        <h1 className="text-xl font-bold flex items-center gap-2">
          <BookOpen className="h-5 w-5 text-primary" />
          경제 사건 타임라인
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          역사적 위기와 시장 반응 — 사이클을 이해하는 가장 좋은 방법.
        </p>
      </div>

      <div className="space-y-4">
        {events.map((e) => {
          const year = e.startDate.slice(0, 4);
          return (
            <Card key={e.id}>
              <CardHeader>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <CardTitle className="text-base flex items-center gap-2">
                      {e.title}
                    </CardTitle>
                    <div className="text-xs text-muted-foreground mt-1 flex flex-wrap gap-2">
                      <span>{REGION_LABEL[e.region] ?? e.region}</span>
                      <span>·</span>
                      <span>{e.startDate.slice(0, 7)}</span>
                      {e.peakDate && (
                        <>
                          <span>→</span>
                          <span>{e.peakDate.slice(0, 7)} (최악)</span>
                        </>
                      )}
                      {e.recoveryMonths && (
                        <>
                          <span>·</span>
                          <span>회복 {e.recoveryMonths}개월</span>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="text-2xl font-bold text-muted-foreground/40 font-mono">
                    {year}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm">{e.summary}</p>

                <div className="grid grid-cols-2 gap-3 py-2 border-y">
                  {e.kospiDrop !== undefined && (
                    <div>
                      <div className="text-[10px] text-muted-foreground">
                        KOSPI 낙폭
                      </div>
                      <div className="font-mono text-base text-red-500 font-bold tabular-nums">
                        {e.kospiDrop.toFixed(1)}%
                      </div>
                    </div>
                  )}
                  {e.spDrop !== undefined && (
                    <div>
                      <div className="text-[10px] text-muted-foreground">
                        S&P 500 낙폭
                      </div>
                      <div className="font-mono text-base text-red-500 font-bold tabular-nums">
                        {e.spDrop.toFixed(1)}%
                      </div>
                    </div>
                  )}
                </div>

                <div>
                  <div className="text-xs font-semibold text-muted-foreground mb-1">
                    💡 원인
                  </div>
                  <ul className="text-xs space-y-1 list-disc ml-4">
                    {e.causes.map((c, i) => (
                      <li key={i}>{c}</li>
                    ))}
                  </ul>
                </div>

                <div>
                  <div className="text-xs font-semibold text-muted-foreground mb-1">
                    📌 결과 / 시사점
                  </div>
                  <ul className="text-xs space-y-1 list-disc ml-4">
                    {e.effects.map((ef, i) => (
                      <li key={i}>{ef}</li>
                    ))}
                  </ul>
                </div>

                {(e.bestSector || e.worstSector) && (
                  <div className="grid grid-cols-2 gap-2 pt-2 border-t text-xs">
                    {e.bestSector && (
                      <div>
                        <div className="text-[10px] text-green-500/80 font-semibold">
                          잘 버틴 섹터
                        </div>
                        <div>{e.bestSector}</div>
                      </div>
                    )}
                    {e.worstSector && (
                      <div>
                        <div className="text-[10px] text-red-500/80 font-semibold">
                          가장 타격
                        </div>
                        <div>{e.worstSector}</div>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card>
        <CardContent className="text-xs text-muted-foreground py-3 space-y-2">
          <p className="font-semibold text-foreground">📚 사이클의 교훈</p>
          <ul className="space-y-1 list-disc ml-4">
            <li>모든 약세장은 결국 회복했다 — 평균 회복 기간 6~90개월</li>
            <li>최악의 시점에 매도 = 최대 손실 (1997, 2008, 2020 공통)</li>
            <li>매 위기마다 가장 잘 버틴 섹터가 다르다 — 분산투자의 가치</li>
            <li>긴축 전환점이 위기의 트리거인 경우가 많음 (2000, 2022)</li>
            <li>회복 후 새로운 주도 섹터가 등장 (1998 IT, 2010 모바일, 2021 AI)</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
