// Plan #32: ETF 카테고리 / 운용보수 / 기타 메타 라벨링.

export const ETF_CATEGORY_LABEL: Record<string, string> = {
  broad_market: "광범위 지수",
  sector: "섹터",
  dividend: "배당",
  bond: "채권",
  commodity: "원자재",
  thematic: "테마",
  leveraged_inverse: "레버리지/인버스",
  international: "해외/지역",
};

export const ETF_CATEGORY_COLOR: Record<string, string> = {
  broad_market: "text-blue-600 dark:text-blue-400 bg-blue-500/10 border-blue-500/30",
  sector: "text-purple-600 dark:text-purple-400 bg-purple-500/10 border-purple-500/30",
  dividend: "text-green-600 dark:text-green-400 bg-green-500/10 border-green-500/30",
  bond: "text-cyan-600 dark:text-cyan-400 bg-cyan-500/10 border-cyan-500/30",
  commodity: "text-amber-600 dark:text-amber-400 bg-amber-500/10 border-amber-500/30",
  thematic: "text-pink-600 dark:text-pink-400 bg-pink-500/10 border-pink-500/30",
  leveraged_inverse:
    "text-red-600 dark:text-red-400 bg-red-500/10 border-red-500/30",
  international:
    "text-indigo-600 dark:text-indigo-400 bg-indigo-500/10 border-indigo-500/30",
};

export function formatExpenseRatio(ratio: number | null | undefined): string {
  if (ratio == null) return "—";
  return `${(Number(ratio) * 100).toFixed(2)}%`;
}

export function formatAum(aum: number | null | undefined, currency: string): string {
  if (aum == null) return "—";
  const n = Number(aum);
  if (currency === "KRW") {
    if (n >= 1e12) return `${(n / 1e12).toFixed(1)}조원`;
    if (n >= 1e8) return `${(n / 1e8).toFixed(0)}억원`;
    return `${n.toLocaleString()}원`;
  }
  if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(0)}M`;
  return `$${n.toLocaleString()}`;
}

export function formatWeight(weight: number | null | undefined): string {
  if (weight == null) return "—";
  return `${(Number(weight) * 100).toFixed(2)}%`;
}

/** 운용보수 평가 — 낮으면 좋음. ETF 평균 ~0.5%, 패시브 ~0.1%. */
export function rateExpenseRatio(ratio: number | null | undefined): {
  label: string;
  color: string;
} {
  if (ratio == null) return { label: "정보 없음", color: "text-muted-foreground" };
  const pct = Number(ratio);
  if (pct < 0.001) return { label: "거의 0% (수퍼 패시브)", color: "text-green-600" };
  if (pct < 0.005) return { label: "매우 낮음", color: "text-green-600" };
  if (pct < 0.01) return { label: "낮음", color: "text-green-500" };
  if (pct < 0.005) return { label: "보통", color: "text-amber-500" };
  if (pct < 0.02) return { label: "약간 높음", color: "text-amber-600" };
  if (pct < 0.05) return { label: "높음", color: "text-red-500" };
  return { label: "매우 높음", color: "text-red-600" };
}
