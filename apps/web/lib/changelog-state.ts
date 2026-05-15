// Plan #27.2: 사용자가 마지막으로 본 changelog 최신 sha.
// localStorage 기반. /app/changelog 진입 시 갱신.

const KEY = "yg-changelog-seen-sha";

export function getSeenSha(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

export function markSeenSha(sha: string) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, sha);
  } catch {
    // ignore
  }
}
