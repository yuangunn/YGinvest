// Plan #45: YG AreaChart — handoff ui.jsx AreaChart 패턴 React 포트.
//
// 깔끔한 SVG path + 4-line 그리드 + 끝점 도트.
// gain/loss 색상은 KR convention (red↑ blue↓).

type Props = {
  data: number[];
  w?: number;
  h?: number;
  gain?: boolean;
  dense?: boolean;
};

export function YGAreaChart({
  data,
  w = 350,
  h = 180,
  gain = true,
  dense = false,
}: Props) {
  if (!data || data.length < 2) {
    return (
      <div
        style={{
          height: h,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "var(--yg-fg-tertiary)",
          fontSize: 13,
          fontWeight: 600,
        }}
      >
        차트 데이터 부족
      </div>
    );
  }

  const min = Math.min(...data);
  const max = Math.max(...data);
  const span = max - min || 1;
  const step = w / (data.length - 1);
  const pts: [number, number][] = data.map((v, i) => [
    i * step,
    h - ((v - min) / span) * (h - 16) - 8,
  ]);
  const d = pts
    .map(
      (p, i) =>
        (i ? "L" : "M") + p[0].toFixed(2) + " " + p[1].toFixed(2),
    )
    .join(" ");
  const area = d + ` L ${w} ${h} L 0 ${h} Z`;
  const color = gain ? "var(--yg-up)" : "var(--yg-down)";
  const lastPt = pts[pts.length - 1];

  return (
    <svg
      width="100%"
      height={h}
      viewBox={`0 0 ${w} ${h}`}
      preserveAspectRatio="none"
      style={{ display: "block" }}
    >
      {/* Grid lines */}
      {!dense &&
        [0.25, 0.5, 0.75].map((t) => (
          <line
            key={t}
            x1={0}
            x2={w}
            y1={h * t}
            y2={h * t}
            stroke="var(--yg-line-faint)"
            strokeWidth={1}
          />
        ))}
      {/* Area fill */}
      <path d={area} fill={color} fillOpacity={0.08} />
      {/* Line */}
      <path
        d={d}
        stroke={color}
        strokeWidth={2}
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* End dot */}
      <circle cx={lastPt[0]} cy={lastPt[1]} r={4} fill={color} />
      <circle cx={lastPt[0]} cy={lastPt[1]} r={8} fill={color} fillOpacity={0.18} />
    </svg>
  );
}
