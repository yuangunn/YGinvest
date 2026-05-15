/**
 * Mutation fetch wrapper (Plan #11.5 — Background Sync).
 *
 * 네트워크 실패 시 navigator.onLine을 체크해 "오프라인 → SW가 큐잉" 케이스와
 * "온라인인데 서버 에러" 케이스를 분리.
 *
 * Plan #27 D4: opts.retries로 transient(5xx / 네트워크 일시) 실패 시 지수 백오프 재시도.
 */

export type OfflineFetchResult<T = unknown> =
  | { status: "ok"; data: T }
  | { status: "queued" }
  | { status: "error"; error: string };

export type OfflineFetchOpts = {
  /** transient 실패 시 재시도 횟수 (기본 0). 권장: 거래 액션엔 2. */
  retries?: number;
  /** 초기 백오프(ms). 기본 500. 매 시도마다 2배. */
  backoffMs?: number;
};

function isTransientHttpStatus(s: number): boolean {
  // 5xx + 408 (Request Timeout) + 429 (Too Many Requests)
  return s >= 500 || s === 408 || s === 429;
}

async function tryOnce<T>(
  url: string,
  init: RequestInit,
): Promise<
  | { kind: "ok"; data: T }
  | { kind: "transient"; err: string }
  | { kind: "fatal"; err: string }
  | { kind: "offline" }
> {
  try {
    const res = await fetch(url, init);
    if (res.ok) {
      const data = (await res.json().catch(() => ({}))) as T;
      return { kind: "ok", data };
    }
    const errBody = (await res.json().catch(() => ({}))) as { error?: string };
    const msg = errBody.error ?? `HTTP ${res.status}`;
    if (isTransientHttpStatus(res.status)) {
      return { kind: "transient", err: msg };
    }
    return { kind: "fatal", err: msg };
  } catch (err) {
    if (typeof navigator !== "undefined" && navigator.onLine === false) {
      return { kind: "offline" };
    }
    const msg = err instanceof Error ? err.message : "network_error";
    return { kind: "transient", err: msg };
  }
}

export async function offlineFetch<T = unknown>(
  url: string,
  init: RequestInit,
  opts: OfflineFetchOpts = {},
): Promise<OfflineFetchResult<T>> {
  const maxAttempts = (opts.retries ?? 0) + 1;
  let backoff = opts.backoffMs ?? 500;
  let lastErr = "request_failed";

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const r = await tryOnce<T>(url, init);
    if (r.kind === "ok") return { status: "ok", data: r.data };
    if (r.kind === "offline") return { status: "queued" };
    if (r.kind === "fatal") return { status: "error", error: r.err };
    // transient: 마지막 시도면 error, 아니면 대기 후 재시도
    lastErr = r.err;
    if (attempt < maxAttempts) {
      await new Promise((resolve) => setTimeout(resolve, backoff));
      backoff *= 2;
    }
  }
  return { status: "error", error: `${lastErr} (재시도 후에도 실패)` };
}
