import { getKrSession } from "@/lib/market-hours";

type Props = {
  market: string;
  lastPrice: number | null;
};

const SPREAD_BPS = 10; // ±10 basis points (= 0.1%, factor 1.001 / 0.999). Plan #12.

const KRW = new Intl.NumberFormat("ko-KR", {
  style: "currency",
  currency: "KRW",
  maximumFractionDigits: 0,
});

export function NxtSpreadBadge({ market, lastPrice }: Props) {
  if (!market.startsWith("KRX_")) return null;
  const session = getKrSession();
  if (session !== "pre" && session !== "after") return null;
  if (lastPrice == null) return null;

  const bid = lastPrice * (1 - SPREAD_BPS / 10_000);
  const ask = lastPrice * (1 + SPREAD_BPS / 10_000);
  const label = session === "pre" ? "프리마켓" : "애프터마켓";

  return (
    <div className="inline-flex flex-wrap items-center gap-2 rounded-md border border-primary/40 bg-primary/5 px-3 py-1.5 text-xs">
      <span className="font-semibold text-primary">{label} (NXT)</span>
      <span className="text-muted-foreground">
        Bid {KRW.format(Math.round(bid))} · Ask {KRW.format(Math.round(ask))}
      </span>
      <span className="text-muted-foreground">spread {SPREAD_BPS} bps</span>
    </div>
  );
}
