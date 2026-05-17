// Plan #45: YG AreaChart — handoff ui.jsx AreaChart 패턴 React 포트.
// Plan #46.2 강화: 가격 그리드 라벨 + 날짜 축 라벨 추가.
//
// 깔끔한 SVG path + 그리드 + 끝점 도트.
// gain/loss 색상은 KR convention (red↑ blue↓).

type Bar = {
  ts: string;
  close: number;
};

type Props = {
  /** 가격 시계열 — ts는 ISO 또는 'YYYY-MM-DD HH:mm:ss' 등 Date 파싱 가능 형식 */
  bars: Bar[];
  /** 차트 가로 (px), 부모 100% 이면 viewBox 비율로만 사용 */
  w?: number;
  /** 차트 세로 (px) */
  h?: number;
  /** 상승 여부 — 색상 결정 */
  gain?: boolean;
  /** dense 모드: 그리드 라인 표시 안 함 */
  dense?: boolean;
  /** 가격 라벨 표시 (기본 true) */
  showPriceAxis?: boolean;
  /** 날짜 라벨 표시 (기본 true) */
  showDateAxis?: boolean;
  /** range key — 날짜 포맷 결정 (1d/1w/1mo/3mo/1y/5y) */
  rangeKey?: "1d" | "1w" | "1mo" | "3mo" | "1y" | "5y";
  /** 통화 — 가격 라벨 포맷 결정 */
  currency?: "KRW" | "USD";
};

// 가격 라벨 좌측 reserved space
const PRICE_AXIS_W = 50;
// 날짜 라벨 하단 reserved space
const DATE_AXIS_H = 20;

function formatPrice(v: number, currency: "KRW" | "USD"): string {
  if (currency === "USD") {
    if (v >= 1000) return v.toFixed(0);
    return v.toFixed(2);
  }
  // KRW: 만 단위 축약
  if (v >= 1e8) return (v / 1e8).toFixed(1) + "억";
  if (v >= 1e4) return (v / 1e4).toFixed(0) + "만";
  return v.toFixed(0);
}

function formatDate(d: Date, rangeKey: string): string {
  switch (rangeKey) {
    case "1d":
      // 09:00, 13:30 등
      return d
        .toLocaleTimeString("ko-KR", {
          hour: "2-digit",
          minute: "2-digit",
          hour12: false,
        })
        .replace(/^24/, "00");
    case "1w":
    case "1mo":
      // M/D
      return `${d.getMonth() + 1}/${d.getDate()}`;
    case "3mo":
      // M/D
      return `${d.getMonth() + 1}/${d.getDate()}`;
    case "1y":
      // 'M월'
      return `${d.getMonth() + 1}월`;
    case "5y":
      // 'YYYY'
      return String(d.getFullYear()).slice(-2) + "년";
    default:
      return `${d.getMonth() + 1}/${d.getDate()}`;
  }
}

// 라벨 위치: 데이터를 N개 균등 분할해서 tick 추출
function pickTickIndices(n: number, ticks: number): number[] {
  if (n <= ticks) return Array.from({ length: n }, (_, i) => i);
  const step = (n - 1) / (ticks - 1);
  const out: number[] = [];
  for (let i = 0; i < ticks; i++) out.push(Math.round(i * step));
  return out;
}

export function YGAreaChart({
  bars,
  w = 350,
  h = 180,
  gain = true,
  dense = false,
  showPriceAxis = true,
  showDateAxis = true,
  rangeKey = "3mo",
  currency = "KRW",
}: Props) {
  if (!bars || bars.length < 2) {
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

  const data = bars.map((b) => b.close);
  const min = Math.min(...data);
  const max = Math.max(...data);
  const span = max - min || 1;

  // 차트 plot 영역 (axis label용 공간 빼고)
  const padL = showPriceAxis ? PRICE_AXIS_W : 0;
  const padB = showDateAxis ? DATE_AXIS_H : 0;
  const plotW = w - padL - 4;
  const plotH = h - padB - 8;

  const step = plotW / (data.length - 1);
  const pts: [number, number][] = data.map((v, i) => [
    padL + i * step,
    plotH - ((v - min) / span) * (plotH - 16) - 4,
  ]);
  const d =
    pts
      .map(
        (p, i) =>
          (i ? "L" : "M") + p[0].toFixed(2) + " " + p[1].toFixed(2),
      )
      .join(" ");
  const area = d + ` L ${padL + plotW} ${plotH} L ${padL} ${plotH} Z`;
  const color = gain ? "var(--yg-up)" : "var(--yg-down)";
  const lastPt = pts[pts.length - 1];

  // 가격 grid + label (4 ticks: 0%, 33%, 66%, 100%)
  const priceTickRatios = [0, 0.33, 0.66, 1];
  const priceTicks = priceTickRatios.map((r) => ({
    ratio: r,
    value: max - r * span,
    y: 4 + r * (plotH - 16),
  }));

  // 날짜 tick (5개 균등)
  const dateTickCount = Math.min(5, bars.length);
  const dateTickIdxs = pickTickIndices(bars.length, dateTickCount);
  const dateTicks = dateTickIdxs.map((i) => {
    const d = new Date(bars[i].ts);
    return {
      x: pts[i][0],
      label: isNaN(d.getTime()) ? "" : formatDate(d, rangeKey),
    };
  });

  return (
    <svg
      width="100%"
      height={h}
      viewBox={`0 0 ${w} ${h}`}
      preserveAspectRatio="none"
      style={{ display: "block", overflow: "visible" }}
    >
      {/* Grid + 가격 라벨 */}
      {!dense &&
        priceTicks.map((t, i) => (
          <g key={`p${i}`}>
            <line
              x1={padL}
              x2={padL + plotW}
              y1={t.y}
              y2={t.y}
              stroke="var(--yg-line-faint)"
              strokeWidth={1}
              strokeDasharray={i === 0 || i === priceTicks.length - 1 ? "" : "2 3"}
            />
            {showPriceAxis && (
              <text
                x={padL - 4}
                y={t.y + 3}
                textAnchor="end"
                fontSize="9"
                fontWeight="600"
                fill="var(--yg-fg-tertiary)"
                fontFamily="Pretendard Variable, Pretendard, sans-serif"
                style={{ fontVariantNumeric: "tabular-nums" }}
              >
                {formatPrice(t.value, currency)}
              </text>
            )}
          </g>
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

      {/* 날짜 라벨 */}
      {showDateAxis &&
        dateTicks.map((t, i) => (
          <text
            key={`d${i}`}
            x={t.x}
            y={h - 4}
            textAnchor={i === 0 ? "start" : i === dateTicks.length - 1 ? "end" : "middle"}
            fontSize="9"
            fontWeight="600"
            fill="var(--yg-fg-tertiary)"
            fontFamily="Pretendard Variable, Pretendard, sans-serif"
          >
            {t.label}
          </text>
        ))}
    </svg>
  );
}
