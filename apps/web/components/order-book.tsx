import { getKrSession } from "@/lib/market-hours";
import { krSpreadBps } from "@/lib/nxt-spread";
import { Term } from "@/components/term";

function hashCode(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h * 31 + s.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

type Props = {
  market: string;
  lastPrice: number | null;
  marketCap?: number | null;
};

const KRW = new Intl.NumberFormat("ko-KR", {
  style: "currency",
  currency: "KRW",
  maximumFractionDigits: 0,
});
const USD = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

/**
 * 호가창 시각화 — 시뮬레이션 (실제 호가 데이터 없음).
 * 현재가 기준 ±N bps의 5단계 호가를 합성.
 * KR NXT 시간에만 의미 있음.
 */
export function OrderBook({ market, lastPrice, marketCap }: Props) {
  if (!lastPrice) return null;
  if (!market.startsWith("KRX_")) return null;
  const session = getKrSession();
  if (session === "closed") {
    return (
      <div className="text-xs text-muted-foreground p-2">
        장 마감 — 호가창은 거래 시간에만 활성
      </div>
    );
  }

  const fmt = market.startsWith("KRX_") ? KRW : USD;
  const spreadBps = krSpreadBps(marketCap);
  const factor = spreadBps / 10000;

  // 5단계 호가 — bps 비례로 차등
  // 호가 1: ±spread/2, 2: ±spread, 3: ±1.5spread, 4: ±2spread, 5: ±3spread
  // qty는 결정론적 (deterministic) — symbol 기반 hash로 매번 같은 값
  const symHash = hashCode(market + String(Math.round(lastPrice))) % 500;
  const asks = [3, 2, 1.5, 1, 0.5].map((mult, i) => ({
    rank: 5 - i,
    price: lastPrice * (1 + factor * mult),
    qty: (6 - i) * 1000 + ((symHash + i * 137) % 500),
  }));
  const bids = [0.5, 1, 1.5, 2, 3].map((mult, i) => ({
    rank: i + 1,
    price: lastPrice * (1 - factor * mult),
    qty: (6 - i) * 1000 + ((symHash + (i + 5) * 137) % 500),
  }));

  const maxQty = Math.max(...asks.map((a) => a.qty), ...bids.map((b) => b.qty));

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="font-semibold flex items-center gap-1">
          호가창 <span className="text-[10px] text-muted-foreground">(시뮬)</span>
        </span>
        <span className="text-[10px] text-muted-foreground">
          <Term k="spread">스프레드</Term> {spreadBps} bps
        </span>
      </div>
      <div className="border rounded overflow-hidden text-xs">
        {/* 매도 호가 (위에서 아래로 가까운 가격) */}
        {asks.map((a) => (
          <div
            key={`ask-${a.rank}`}
            className="grid grid-cols-3 items-center text-center"
          >
            <span className="text-[10px] text-muted-foreground py-1">
              매도 #{a.rank}
            </span>
            <span className="font-mono text-red-500 dark:text-red-400 py-1 tabular-nums">
              {fmt.format(Math.round(a.price))}
            </span>
            <span className="relative py-1">
              <span
                className="absolute right-0 top-0 h-full bg-red-500/15"
                style={{ width: `${(a.qty / maxQty) * 100}%` }}
              />
              <span className="relative tabular-nums">{a.qty.toLocaleString()}</span>
            </span>
          </div>
        ))}
        {/* 현재가 (구분선) */}
        <div className="grid grid-cols-3 items-center text-center bg-primary/10 border-y border-primary/30">
          <span className="text-[10px] font-semibold py-1.5">현재가</span>
          <span className="font-mono font-bold text-primary py-1.5 tabular-nums">
            {fmt.format(Math.round(lastPrice))}
          </span>
          <span className="text-[10px] text-muted-foreground py-1.5">
            <Term k="midpoint">중간</Term>
          </span>
        </div>
        {/* 매수 호가 */}
        {bids.map((b) => (
          <div
            key={`bid-${b.rank}`}
            className="grid grid-cols-3 items-center text-center"
          >
            <span className="relative py-1">
              <span
                className="absolute left-0 top-0 h-full bg-green-500/15"
                style={{ width: `${(b.qty / maxQty) * 100}%` }}
              />
              <span className="relative tabular-nums">{b.qty.toLocaleString()}</span>
            </span>
            <span className="font-mono text-green-600 dark:text-green-400 py-1 tabular-nums">
              {fmt.format(Math.round(b.price))}
            </span>
            <span className="text-[10px] text-muted-foreground py-1">
              매수 #{b.rank}
            </span>
          </div>
        ))}
      </div>
      <p className="text-[10px] text-muted-foreground">
        시뮬레이션 — 실제 거래소 호가 아님. 시가총액 티어별 spread 차등.
      </p>
    </div>
  );
}
