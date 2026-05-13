import { getKrSession } from "@/lib/market-hours";
import { krSpreadBps, krSpreadTier, TIER_LABEL } from "@/lib/nxt-spread";

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

export function NxtSpreadBadge({ market, lastPrice, marketCap }: Props) {
  if (!market.startsWith("KRX_")) return null;
  const session = getKrSession();
  if (session !== "pre" && session !== "after") return null;
  if (lastPrice == null) return null;

  const spreadBps = krSpreadBps(marketCap);
  const tier = krSpreadTier(marketCap);
  const factor = spreadBps / 10_000;
  const bid = lastPrice * (1 - factor);
  const ask = lastPrice * (1 + factor);
  const label = session === "pre" ? "프리마켓" : "애프터마켓";

  return (
    <div className="inline-flex flex-wrap items-center gap-2 rounded-md border border-primary/40 bg-primary/5 px-3 py-1.5 text-xs">
      <span className="font-semibold text-primary">{label} (NXT)</span>
      <span className="text-muted-foreground">
        Bid {KRW.format(Math.round(bid))} · Ask {KRW.format(Math.round(ask))}
      </span>
      <span className="text-muted-foreground">
        spread {spreadBps} bps · {TIER_LABEL[tier]}
      </span>
    </div>
  );
}
