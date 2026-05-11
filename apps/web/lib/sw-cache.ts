/**
 * Service Worker / CacheStorage helpers (Plan #11).
 *
 * 로그아웃 시 다른 사용자에게 전 사용자 캐시가 노출되지 않도록
 * personal data 캐시(pages, read-api)만 명시적으로 정리한다.
 * 정적 자산(next-static, images, fonts)은 origin-shared이므로 보존.
 */

const PERSONAL_CACHES = new Set(["pages", "read-api"]);

export async function clearAppCaches(): Promise<void> {
  if (typeof window === "undefined" || !("caches" in window)) return;
  try {
    const keys = await caches.keys();
    await Promise.all(
      keys.filter((k) => PERSONAL_CACHES.has(k)).map((k) => caches.delete(k)),
    );
  } catch {
    // 캐시 비우기 실패는 치명적이지 않음 — 무시
  }
}
