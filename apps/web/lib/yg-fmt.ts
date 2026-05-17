// Plan #41: 한국 핀테크 숫자 포맷터 (Claude Design handoff)
// 모든 자산 / 가격 / 비율 표시에 사용.

export const fmt = {
  krw: (n: number): string =>
    new Intl.NumberFormat("ko-KR").format(Math.round(n)),

  usd: (n: number): string =>
    "$" +
    new Intl.NumberFormat("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(n),

  pct: (n: number): string => (n >= 0 ? "+" : "") + n.toFixed(2) + "%",

  signedKRW: (n: number): string =>
    (n >= 0 ? "+" : "-") +
    new Intl.NumberFormat("ko-KR").format(Math.abs(Math.round(n))),

  /** 한국식 단위 축약: 만 / 억 / 조 */
  krwShort: (n: number): string => {
    const a = Math.abs(n);
    if (a >= 1e12) return (n / 1e12).toFixed(2) + "조";
    if (a >= 1e8) return (n / 1e8).toFixed(2) + "억";
    if (a >= 1e4) return (n / 1e4).toFixed(0) + "만";
    return new Intl.NumberFormat("ko-KR").format(Math.round(n));
  },
};
