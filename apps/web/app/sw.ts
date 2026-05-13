/// <reference lib="webworker" />
import {
  BackgroundSyncPlugin,
  type BackgroundSyncQueue,
  CacheFirst,
  ExpirationPlugin,
  NetworkOnly,
  type PrecacheEntry,
  type RuntimeCaching,
  Serwist,
  type SerwistGlobalConfig,
  StaleWhileRevalidate,
} from "serwist";

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope;

// =========================================================================
// Background Sync queues (Plan #11.5) — categorical for debuggability
// 60min retention; older queue entries are auto-dropped.
// =========================================================================
const ordersSyncPlugin = new BackgroundSyncPlugin("orders-sync", {
  maxRetentionTime: 60,
});
const fxSyncPlugin = new BackgroundSyncPlugin("fx-sync", {
  maxRetentionTime: 60,
});
const watchlistSyncPlugin = new BackgroundSyncPlugin("watchlist-sync", {
  maxRetentionTime: 60,
});

// =========================================================================
// Explicit runtime caching — README와 1:1 매칭
// =========================================================================
const runtimeCaching: RuntimeCaching[] = [
  // 1. Next.js 정적 자산 (immutable hashed)
  {
    matcher: ({ url }) => url.pathname.startsWith("/_next/static/"),
    handler: new CacheFirst({
      cacheName: "next-static",
      plugins: [
        new ExpirationPlugin({
          maxEntries: 200,
          maxAgeSeconds: 30 * 24 * 60 * 60,
        }),
      ],
    }),
  },
  // 2. 이미지 (아이콘, OG, 로고 등)
  {
    matcher: ({ request }) => request.destination === "image",
    handler: new CacheFirst({
      cacheName: "images",
      plugins: [
        new ExpirationPlugin({
          maxEntries: 100,
          maxAgeSeconds: 30 * 24 * 60 * 60,
        }),
      ],
    }),
  },
  // 3. 폰트 (Pretendard CDN)
  {
    matcher: ({ request }) => request.destination === "font",
    handler: new CacheFirst({
      cacheName: "fonts",
      plugins: [
        new ExpirationPlugin({
          maxEntries: 30,
          maxAgeSeconds: 365 * 24 * 60 * 60,
        }),
      ],
    }),
  },
  // 4. 읽기 API — 추천, 종목 가격 (StaleWhileRevalidate)
  {
    matcher: ({ url, request }) =>
      request.method === "GET" &&
      (url.pathname.startsWith("/api/recommendations") ||
        url.pathname.startsWith("/api/stocks")),
    handler: new StaleWhileRevalidate({
      cacheName: "read-api",
      plugins: [
        new ExpirationPlugin({ maxEntries: 60, maxAgeSeconds: 5 * 60 }),
      ],
    }),
  },
  // 5a. Orders mutation — Background Sync queueing (Plan #11.5)
  {
    matcher: ({ url, request }) =>
      request.method !== "GET" && url.pathname.startsWith("/api/orders"),
    handler: new NetworkOnly({ plugins: [ordersSyncPlugin] }),
  },
  // 5b. FX mutation — Background Sync queueing
  {
    matcher: ({ url, request }) =>
      request.method !== "GET" && url.pathname.startsWith("/api/fx"),
    handler: new NetworkOnly({ plugins: [fxSyncPlugin] }),
  },
  // 5c. Watchlist mutation — Background Sync queueing
  {
    matcher: ({ url, request }) =>
      request.method !== "GET" && url.pathname.startsWith("/api/watchlist"),
    handler: new NetworkOnly({ plugins: [watchlistSyncPlugin] }),
  },
  // 5d. 나머지 변경 API (push, rooms, portfolio/select, notification-settings)
  //     — NetworkOnly without queueing (이 endpoints는 offline 큐잉 가치 낮음)
  {
    matcher: ({ request }) => request.method !== "GET",
    handler: new NetworkOnly(),
  },
  // 6. HTML 네비게이션 — NetworkOnly (Plan #11.7 hotfix)
  //    이전엔 NetworkFirst로 캐싱했지만 시세/잔고 같은 시간 민감 데이터가 stale로
  //    표시되는 회귀 (e.g. 8:34 KST 가격이 18:00에도 그대로). 오프라인 시
  //    Serwist `fallbacks`가 /offline으로 자동 fallback해주므로 NetworkOnly가
  //    더 안전. 정적 셸 (auth/login, /offline)은 precache되어 있어 영향 없음.
  {
    matcher: ({ request }) => request.mode === "navigate",
    handler: new NetworkOnly(),
  },
];

// =========================================================================
// Serwist — precache (build manifest) + runtime caching + offline fallback
// =========================================================================
const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching,
  fallbacks: {
    entries: [
      {
        url: "/offline",
        matcher({ request }) {
          return request.destination === "document";
        },
      },
    ],
  },
});

serwist.addEventListeners();

// =========================================================================
// Plan #11.7 — Legacy `pages` 캐시 정리.
// 이전 SW가 NetworkFirst로 trade/dashboard/portfolio HTML을 24h 캐싱해서
// 시세가 오래된 값으로 보이는 회귀. 활성화 시 한 번만 wipe.
// =========================================================================
self.addEventListener("activate", (event: ExtendableEvent) => {
  event.waitUntil(
    caches.delete("pages").catch(() => {
      // 이미 없거나 권한 문제 — 무시
    }),
  );
});

// =========================================================================
// Plan #11.8 — 큐 강제 flush 메시지 핸들러.
// 클라이언트가 `postMessage({type: "FLUSH_QUEUES"})` 보내면 모든 BackgroundSync
// 큐의 pending requests를 즉시 재전송 시도. 완료 후 `FLUSH_DONE` 응답.
// =========================================================================
async function drainQueue(
  queue: BackgroundSyncQueue,
): Promise<{ name: string; sent: number; failed: number }> {
  let sent = 0;
  let failed = 0;
  let entry = await queue.shiftRequest();
  while (entry) {
    try {
      await fetch(entry.request.clone());
      sent++;
    } catch {
      // 네트워크 다시 실패 — 큐 앞쪽에 되돌리고 중단
      await queue.unshiftRequest(entry);
      failed++;
      break;
    }
    entry = await queue.shiftRequest();
  }
  return { name: queue.name, sent, failed };
}

self.addEventListener("message", (event: ExtendableMessageEvent) => {
  if (!event.data || event.data.type !== "FLUSH_QUEUES") return;
  event.waitUntil(
    (async () => {
      // private `_queue` 액세스 — 타입 단언으로 우회 (Serwist v9는 public 미노출)
      const plugins = [ordersSyncPlugin, fxSyncPlugin, watchlistSyncPlugin];
      const results = [];
      for (const plugin of plugins) {
        const q = (plugin as unknown as { _queue: BackgroundSyncQueue })._queue;
        if (q) {
          try {
            results.push(await drainQueue(q));
          } catch {
            // 단일 큐 실패해도 나머지 시도
          }
        }
      }
      // 응답 — 호출자가 ports[0]를 제공했으면 거기로 회신
      const port = event.ports[0];
      if (port) {
        port.postMessage({ type: "FLUSH_DONE", results });
      }
    })(),
  );
});

// =========================================================================
// Plan #7 — Web Push handlers (preserved as-is from public/sw.js)
// =========================================================================
self.addEventListener("push", (event: PushEvent) => {
  let data: { title?: string; body?: string; url?: string } = {};
  try {
    data = event.data ? (event.data.json() as typeof data) : {};
  } catch {
    data = {
      title: "YGinvest",
      body: event.data ? event.data.text() : "",
    };
  }
  const title = data.title || "YGinvest";
  const options: NotificationOptions = {
    body: data.body || "",
    icon: "/icon-192.png",
    badge: "/icon-192.png",
    data: { url: data.url || "/app/dashboard" },
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event: NotificationEvent) => {
  event.notification.close();
  const url =
    (event.notification.data as { url?: string } | null)?.url ||
    "/app/dashboard";
  event.waitUntil(
    self.clients.matchAll({ type: "window" }).then((clients) => {
      const existing = clients.find((c) => c.url.includes(url));
      if (existing) return existing.focus();
      return self.clients.openWindow(url);
    }),
  );
});
