// 일봉을 주봉/월봉으로 그룹화하는 헬퍼.
// 서버 사이드(bars API)에서 호출.
//
// 그룹 키:
//   1wk: ISO week (월요일 기준)
//   1mo: 년-월
//
// 각 그룹의 OHLCV:
//   open  = 그룹 첫 날의 open
//   close = 그룹 마지막 날의 close
//   high  = 그룹 모든 high의 max
//   low   = 그룹 모든 low의 min
//   volume = 그룹 모든 volume의 합
//   ts    = 그룹 첫 날의 ts (chart x축 정렬용)

export type RawBar = {
  ts: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

export type AggInterval = "1wk" | "1mo";

function weekKey(d: Date): string {
  // ISO week: 1월 1일이 속한 주 = 첫 주 (월요일 기준)
  const t = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const dayNum = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - dayNum); // 목요일로 이동
  const yearStart = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(
    ((t.getTime() - yearStart.getTime()) / 86400000 + 1) / 7,
  );
  return `${t.getUTCFullYear()}-W${String(weekNo).padStart(2, "0")}`;
}

function groupKey(bar: RawBar, interval: AggInterval): string {
  const d = new Date(bar.ts);
  if (interval === "1mo") {
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
  }
  return weekKey(d);
}

/**
 * 일봉 배열을 시간순(ascending) 가정하고 주/월 단위로 집계.
 * 결과도 시간순.
 */
export function aggregateBars(
  daily: RawBar[],
  interval: AggInterval,
): RawBar[] {
  if (daily.length === 0) return [];

  type Acc = {
    key: string;
    bars: RawBar[];
  };
  const groups: Acc[] = [];
  let cur: Acc | null = null;

  for (const b of daily) {
    const k = groupKey(b, interval);
    if (!cur || cur.key !== k) {
      cur = { key: k, bars: [b] };
      groups.push(cur);
    } else {
      cur.bars.push(b);
    }
  }

  return groups.map((g) => {
    const first = g.bars[0];
    const last = g.bars[g.bars.length - 1];
    let high = -Infinity;
    let low = Infinity;
    let volume = 0;
    for (const b of g.bars) {
      if (b.high > high) high = b.high;
      if (b.low < low) low = b.low;
      volume += b.volume;
    }
    return {
      ts: first.ts,
      open: first.open,
      high,
      low,
      close: last.close,
      volume,
    };
  });
}
