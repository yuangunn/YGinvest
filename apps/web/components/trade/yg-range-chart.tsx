"use client";

// Plan #45: YG 범위 차트 — handoff trade-detail.jsx ChartCard 패턴.
//
// 1일 / 1주 / 1개월 / 3개월 / 1년 / 5년 탭 → 각각 다른 interval/period 조합.
// 클라이언트에서 fetch (interval 변경시).

import { useEffect, useMemo, useState, useTransition } from "react";
import { YGAreaChart } from "@/components/yg/area-chart";

type Bar = {
  ts: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

type Props = {
  symbol: string;
  initialBars: Bar[]; // 일봉 365개 (SSR)
};

const RANGES = [
  { k: "1d", l: "1일", interval: "15m", limit: 32 }, // 15분봉 ~1일 (시장 32틱)
  { k: "1w", l: "1주", interval: "1h", limit: 40 }, // 시간봉 5거래일
  { k: "1mo", l: "1개월", interval: "1d", limit: 22 }, // 일봉 ~1개월
  { k: "3mo", l: "3개월", interval: "1d", limit: 66 },
  { k: "1y", l: "1년", interval: "1d", limit: 252 },
  { k: "5y", l: "5년", interval: "1wk", limit: 260 },
] as const;

type RangeKey = (typeof RANGES)[number]["k"];

export function YGRangeChart({ symbol, initialBars }: Props) {
  const [range, setRange] = useState<RangeKey>("3mo");
  const [bars, setBars] = useState<Bar[]>(initialBars);
  const [loading, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const def = RANGES.find((r) => r.k === range)!;

  // 초기엔 3개월 (1d × 66) 로 표시 — initialBars는 365 일봉이라 slice
  const initial3mo = useMemo(
    () => initialBars.slice(-66),
    [initialBars],
  );
  // 가장 처음엔 3개월 데이터로 시작
  const [hasFetched, setHasFetched] = useState(false);

  // range 변경시 fetch (단, 3개월 + initialBars 있을 땐 첫 fetch 스킵)
  useEffect(() => {
    if (range === "3mo" && !hasFetched) {
      setBars(initial3mo);
      return;
    }
    if (range === "1mo" && !hasFetched && initialBars.length >= 22) {
      setBars(initialBars.slice(-22));
      setHasFetched(true);
      return;
    }
    if (range === "1y" && !hasFetched && initialBars.length >= 252) {
      setBars(initialBars.slice(-252));
      setHasFetched(true);
      return;
    }

    setError(null);
    startTransition(() => {
      void fetch(
        `/api/stocks/${encodeURIComponent(symbol)}/bars?interval=${
          def.interval
        }&limit=${def.limit}`,
      )
        .then(async (r) => {
          if (!r.ok) throw new Error(`HTTP ${r.status}`);
          const j = (await r.json()) as { bars: Bar[] };
          setBars(j.bars ?? []);
          setHasFetched(true);
        })
        .catch((e: Error) => {
          setError(e.message);
        });
    });
  }, [range, symbol, def.interval, def.limit, initial3mo, initialBars, hasFetched]);

  const closes = bars.map((b) => Number(b.close)).filter((v) => v > 0);
  const gain = closes.length >= 2 ? closes[closes.length - 1] >= closes[0] : true;

  return (
    <div>
      <div style={{ position: "relative" }}>
        {loading && (
          <div
            style={{
              position: "absolute",
              top: 8,
              right: 8,
              fontSize: 10,
              fontWeight: 700,
              color: "var(--yg-fg-tertiary)",
              background: "var(--yg-bg-card)",
              padding: "3px 8px",
              borderRadius: 99,
              zIndex: 2,
            }}
          >
            로딩…
          </div>
        )}
        {error ? (
          <div
            style={{
              height: 180,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 12,
              color: "var(--yg-fg-tertiary)",
              fontWeight: 600,
            }}
          >
            데이터 로드 실패
          </div>
        ) : (
          <YGAreaChart data={closes} h={180} gain={gain} />
        )}
      </div>

      {/* Range tabs */}
      <div
        style={{
          display: "flex",
          gap: 4,
          marginTop: 14,
          justifyContent: "space-between",
        }}
      >
        {RANGES.map((r) => {
          const active = range === r.k;
          return (
            <button
              key={r.k}
              type="button"
              onClick={() => setRange(r.k)}
              style={{
                all: "unset",
                cursor: "pointer",
                flex: 1,
                textAlign: "center",
                padding: "8px 0",
                borderRadius: 8,
                fontSize: 12,
                fontWeight: 700,
                background: active ? "var(--yg-bg-tint-ink)" : "transparent",
                color: active
                  ? "var(--yg-fg-primary)"
                  : "var(--yg-fg-tertiary)",
                transition: "background 120ms ease",
              }}
            >
              {r.l}
            </button>
          );
        })}
      </div>
    </div>
  );
}
