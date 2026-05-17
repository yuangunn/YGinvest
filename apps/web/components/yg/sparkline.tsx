// Plan #41: SVG sparkline — no chart lib.

type Props = {
  data: number[];
  w?: number;
  h?: number;
  color?: string;
  fill?: boolean;
};

export function Sparkline({ data, w = 80, h = 28, color = "currentColor", fill = false }: Props) {
  if (!data || data.length < 2) return null;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const span = max - min || 1;
  const step = w / (data.length - 1);
  const pts = data.map((v, i): [number, number] => [
    i * step,
    h - ((v - min) / span) * (h - 2) - 1,
  ]);
  const d = pts
    .map((p, i) => (i ? "L" : "M") + p[0].toFixed(2) + " " + p[1].toFixed(2))
    .join(" ");
  const area = d + ` L ${w} ${h} L 0 ${h} Z`;
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{ display: "block" }}>
      {fill && <path d={area} fill={color} fillOpacity="0.10" />}
      <path
        d={d}
        stroke={color}
        strokeWidth="1.8"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
