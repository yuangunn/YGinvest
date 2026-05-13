/**
 * Plan #16 — 추천 클릭 추적.
 * 클라이언트 fetch는 fire-and-forget (사용자 navigation 차단 안 함).
 */

export function trackRecommendationClick(payload: {
  category: string;
  market_scope?: string;
  symbol: string;
  rank?: number;
  portfolio_id?: string;
}): void {
  if (typeof navigator === "undefined") return;
  const body = JSON.stringify(payload);
  // navigator.sendBeacon은 페이지 unload 중에도 도착 보장. POST 외 navigation 차단 안 함.
  try {
    const blob = new Blob([body], { type: "application/json" });
    if (navigator.sendBeacon("/api/analytics/recommendation-click", blob)) {
      return;
    }
  } catch {
    // fallthrough to fetch
  }
  // fallback — keepalive: true로 navigation 차단 안 함
  fetch("/api/analytics/recommendation-click", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
    keepalive: true,
  }).catch(() => {
    // 분석 실패는 무시
  });
}
