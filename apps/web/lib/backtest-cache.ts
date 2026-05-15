// Plan #27 D3: 백테스트 결과 localStorage 캐시.
// 같은 종목 + 같은 전략 재계산 방지. TTL 24시간.

const KEY_PREFIX = "yg-bt-";
const TTL_MS = 24 * 60 * 60 * 1000;

export function getCachedBacktest<T>(key: string): T | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(KEY_PREFIX + key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { savedAt: number; data: T };
    if (Date.now() - parsed.savedAt > TTL_MS) {
      window.localStorage.removeItem(KEY_PREFIX + key);
      return null;
    }
    return parsed.data;
  } catch {
    return null;
  }
}

export function setCachedBacktest<T>(key: string, data: T) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      KEY_PREFIX + key,
      JSON.stringify({ savedAt: Date.now(), data }),
    );
  } catch {
    // ignore (quota / private mode)
  }
}
