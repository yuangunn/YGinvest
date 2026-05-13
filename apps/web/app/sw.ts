/// <reference lib="webworker" />
import {
  BackgroundSyncPlugin,
  CacheFirst,
  ExpirationPlugin,
  NetworkFirst,
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
  // 6. HTML 네비게이션 — NetworkFirst + fallback
  {
    matcher: ({ request }) => request.mode === "navigate",
    handler: new NetworkFirst({
      cacheName: "pages",
      networkTimeoutSeconds: 3,
      plugins: [
        new ExpirationPlugin({ maxEntries: 50, maxAgeSeconds: 24 * 60 * 60 }),
      ],
    }),
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
