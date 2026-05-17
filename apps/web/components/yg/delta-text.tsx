// Plan #41: DeltaText — KR convention (red up, blue down).

type Props = {
  pct: number;
  abs?: number;
  size?: number;
  weight?: number;
  prefix?: boolean;
};

export function DeltaText({ pct, abs, size = 14, weight = 700, prefix = true }: Props) {
  const up = pct >= 0;
  const color = up ? "var(--yg-up-deep)" : "var(--yg-down-deep)";
  return (
    <span
      className="yg-num"
      style={{
        color,
        fontSize: size,
        fontWeight: weight,
        letterSpacing: "-0.01em",
      }}
    >
      {prefix && (up ? "▲" : "▼")} {Math.abs(pct).toFixed(2)}%
      {abs != null && (
        <span style={{ marginLeft: 6, fontSize: size - 2, opacity: 0.85 }}>
          ({up ? "+" : ""}
          {new Intl.NumberFormat("ko-KR").format(Math.round(abs))})
        </span>
      )}
    </span>
  );
}
