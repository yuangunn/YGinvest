// Plan #41: TickerBadge — 종목 심볼을 해시 → 팔레트 색 → 원형 뱃지.

type Props = {
  symbol: string;
  size?: number;
};

const PALETTE = [
  "#0F1115",
  "#1F3A8A",
  "#5B47FB",
  "#0E7C66",
  "#B45309",
  "#7E22CE",
  "#0369A1",
];

export function TickerBadge({ symbol, size = 40 }: Props) {
  const sym = symbol || "";
  const idx =
    sym.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0) % PALETTE.length;
  const bg = PALETTE[idx];
  const label = sym.replace(/^0+/, "").slice(0, 2).toUpperCase() || sym.slice(0, 2);
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        background: bg,
        color: "#fff",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontWeight: 700,
        fontSize: size * 0.32,
        letterSpacing: "-0.02em",
        flex: "0 0 auto",
      }}
    >
      {label}
    </div>
  );
}
