// Plan #27 B3: 최근 본 종목 (localStorage).
// 종목 페이지 접속 시 호출 → 검색 페이지 / Cmd+K 등에서 표시.

const KEY = "yg-recent-stocks";
const MAX = 8;

export type RecentStock = {
  symbol: string;
  name: string;
  visitedAt: number; // epoch ms
};

export function pushRecent(item: { symbol: string; name: string }) {
  if (typeof window === "undefined") return;
  try {
    const raw = window.localStorage.getItem(KEY);
    const list: RecentStock[] = raw ? JSON.parse(raw) : [];
    // 기존 같은 symbol 제거 후 prepend
    const filtered = list.filter((r) => r.symbol !== item.symbol);
    filtered.unshift({
      symbol: item.symbol,
      name: item.name,
      visitedAt: Date.now(),
    });
    const trimmed = filtered.slice(0, MAX);
    window.localStorage.setItem(KEY, JSON.stringify(trimmed));
  } catch {
    // ignore
  }
}

export function getRecent(): RecentStock[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return [];
    const list = JSON.parse(raw);
    if (!Array.isArray(list)) return [];
    return list;
  } catch {
    return [];
  }
}

export function clearRecent() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    // ignore
  }
}
