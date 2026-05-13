/**
 * Mutation fetch wrapper (Plan #11.5 — Background Sync).
 *
 * 네트워크 실패 시 navigator.onLine을 체크해 "오프라인 → SW가 큐잉" 케이스와
 * "온라인인데 서버 에러" 케이스를 분리.
 */

export type OfflineFetchResult<T = unknown> =
  | { status: "ok"; data: T }
  | { status: "queued" }
  | { status: "error"; error: string };

export async function offlineFetch<T = unknown>(
  url: string,
  init: RequestInit,
): Promise<OfflineFetchResult<T>> {
  try {
    const res = await fetch(url, init);
    if (res.ok) {
      const data = (await res.json().catch(() => ({}))) as T;
      return { status: "ok", data };
    }
    const errBody = (await res.json().catch(() => ({}))) as { error?: string };
    return { status: "error", error: errBody.error ?? `HTTP ${res.status}` };
  } catch (err) {
    // fetch threw → 네트워크 단절 가능성
    if (typeof navigator !== "undefined" && navigator.onLine === false) {
      // BackgroundSyncPlugin이 큐잉했을 것 (SW 등록되어 있다면)
      return { status: "queued" };
    }
    // 온라인인데 fetch 실패 → 서버 다운, CORS, 기타
    const msg = err instanceof Error ? err.message : "network_error";
    return { status: "error", error: msg };
  }
}
