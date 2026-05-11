# Offline Mode (Serwist-based caching) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (chosen by user — inline) to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** YGinvest를 진짜 오프라인-가능 PWA로 만든다 — Serwist 기반 서비스 워커로 앱 셸·정적 자산·읽기 API를 캐시하고, 오프라인 fallback 페이지를 제공한다. 기존 Plan #7 Web Push 핸들러는 그대로 유지된다.

**Architecture:** `@serwist/next` 플러그인을 `next.config.ts`에 추가. 기존 `public/sw.js`(push 전용)는 삭제하고, 새 소스 `apps/web/app/sw.ts`에서 Push 이벤트 핸들러 + Serwist precaching + **명시적 runtimeCaching 배열**을 한 파일에 정의한다. Serwist는 `app/sw.ts`를 빌드 시점에 `public/sw.js`로 컴파일한다(같은 경로 유지 → 기존 push 등록 코드 무영향). 캐시 전략은 README와 코드가 일치하도록 명시적으로 작성: 정적자산(CacheFirst), 폰트(CacheFirst), 읽기 API(`/api/recommendations`, `/api/stocks` — StaleWhileRevalidate), HTML 페이지(NetworkFirst → `/offline` fallback), 변경 API(POST/PATCH/DELETE — NetworkOnly).

**Tech Stack:** `@serwist/next` v9.5.11 (Next 16 호환, 안정판), Workbox 기반 런타임 캐싱, TypeScript 서비스 워커 소스, Playwright `context.setOffline(true)` E2E.

---

## Scope (explicit limits)

In scope:
- `@serwist/next` 9.5.11 설치 + `next.config.ts` 통합
- 서비스 워커 소스 마이그레이션 — `public/sw.js`(push) → `app/sw.ts`(push + 캐싱)
- 정적 precaching — Next build manifest 기반(자동)
- 런타임 캐싱 5가지 라우트 매처
- 오프라인 fallback 페이지 `/offline`
- 보안/캐시 헤더 — `/sw.js`에 `Cache-Control: no-cache`, `/offline`은 SSG
- 기존 Web Push 100% 호환 보장 (push/notificationclick handler 동일하게 동작)
- E2E 테스트 — `context.setOffline(true)` 시나리오 (대시보드 → 오프라인 → fallback)
- README "오프라인 모드" 섹션

Out of scope (defer to v1.5+):
- Background Sync API — 오프라인 중 매수/매도 큐잉
- Periodic Background Sync — 백그라운드 가격 갱신
- IndexedDB로 사용자별 캐시 분리 (현재는 origin 전체 공유)
- Workbox 통계 / 캐시 만료 분석
- 캐시 prewarm (사용자 첫 접속 시 모든 종목 페이지 prefetch)
- iOS PWA에서의 push (별도 limitation — Plan #7 알려진 이슈)
- 캐시된 페이지에서 인증된 fetch 동작 보장 (NetworkFirst라 정상 동작 시 항상 새 데이터)

---

## File Structure

### Web — code
- **Modify** `apps/web/next.config.ts` — `withSerwist` 래핑
- **Create** `apps/web/app/sw.ts` — Serwist + 기존 Push 핸들러 통합 SW 소스
- **Delete** `apps/web/public/sw.js` — Serwist가 빌드 시 동일 경로에 생성하므로 소스로서는 제거
- **Create** `apps/web/app/offline/page.tsx` — 오프라인 fallback (static page)
- **Modify** `apps/web/app/layout.tsx` — 헤더에서 service worker 헤더는 next.config에서 처리 (변경 작음)
- **Modify** `apps/web/lib/push.ts` — 변경 없음 (sw.js 경로 동일, 무영향) — 확인만
- **Modify** `apps/web/.gitignore` — `public/sw.js`, `public/sw.js.map`, `public/workbox-*.js` 추가 (생성물)

### Tests
- **Create** `apps/web/tests/e2e/offline-mode.spec.ts` — 오프라인 시나리오

### Docs
- **Modify** `README.md` — "오프라인 모드 (Plan #11)" 섹션 + 캐시 전략 표

### Types
- **Create** `apps/web/types/serwist.d.ts` — sw.ts에서 import할 타입 보강 (필요 시)

---

## Task 1: 환경 점검 + branch 확인

- [ ] **Step 1: branch 확인**

```bash
git branch --show-current
```

Expected: `plan-11-offline-mode`

- [ ] **Step 2: Serwist 호환성 확인**

Next.js 16 공식 docs (`node_modules/next/dist/docs/01-app/02-guides/progressive-web-apps.md` 663-668)는 offline용으로 Serwist를 추천하고 webpack 설정이 필요하다고 명시. `next build`는 webpack 기본 사용이므로 호환됨.

- [ ] **Step 3: 기존 sw.js 백업 — 참조용 메모**

기존 `apps/web/public/sw.js`의 핸들러는:
- `install` → `skipWaiting`
- `activate` → `clients.claim`
- `push` → showNotification with title/body/icon/badge/data.url
- `notificationclick` → focus existing client or openWindow

이 4개 핸들러를 `app/sw.ts`에 그대로 옮겨야 함. 누락 시 Plan #7 푸시 알림 전부 깨짐.

---

## Task 2: Serwist 패키지 설치 + types 추가

**Files:**
- Modify: `apps/web/package.json` (deps 추가)
- Create: `apps/web/types/serwist.d.ts`

- [ ] **Step 1: 패키지 설치**

```bash
cd "C:/Users/Helios_Neo_18/모의 주식/apps/web"
npm install @serwist/next@9.5.11 serwist@9.5.11
```

Expected: 두 패키지 설치, 0 warnings about Next.js 16 peer dep (>=14.0.0 OK).

- [ ] **Step 1.5: peer dep 검증**

```bash
npm ls @serwist/next serwist 2>&1 | tail -5
```

Expected: 두 줄 모두 `OK` (no UNMET PEER). 만약 Next 16 호환성 경고가 나오면 plan 진행 중단하고 `@serwist/next@10.0.0-preview.14`로 업그레이드 검토.

- [ ] **Step 2: 타입 보강 파일 생성**

Serwist의 `InjectManifest` 옵션이 SW 빌드 시점에 `__SW_MANIFEST` 같은 변수를 주입함. TypeScript에서 명시적 declaration 필요.

`apps/web/types/serwist.d.ts`:
```ts
// Serwist injects this at build time. Declared globally so app/sw.ts can read it.
declare const self: ServiceWorkerGlobalScope & {
  __SW_MANIFEST: (import("@serwist/sw").PrecacheEntry | string)[] | undefined;
};
```

- [ ] **Step 3: tsconfig include 확인**

`apps/web/tsconfig.json`에 `"include"`가 `**/*.ts`인지 확인. 아니면 `types/**/*.d.ts` 추가.

```bash
cat apps/web/tsconfig.json
```

Expected: include에 `**/*.ts`나 `**/*.d.ts` 패턴 존재.

- [ ] **Step 4: 커밋**

```bash
git add apps/web/package.json apps/web/package-lock.json apps/web/types/serwist.d.ts
git commit -m "feat(web): install @serwist/next 9.5.11 + sw types"
```

---

## Task 3: 서비스 워커 소스 작성 (app/sw.ts)

**Files:**
- Create: `apps/web/app/sw.ts`
- Delete: `apps/web/public/sw.js`

**핵심:** Plan #7 push 핸들러를 그대로 보존하면서 Serwist 캐싱을 추가.

- [ ] **Step 1: app/sw.ts 작성**

`apps/web/app/sw.ts`:
```ts
import type { PrecacheEntry, RuntimeCaching, SerwistGlobalConfig } from "@serwist/sw";
import {
  CacheFirst,
  NetworkFirst,
  NetworkOnly,
  Serwist,
  StaleWhileRevalidate,
  ExpirationPlugin,
} from "serwist";

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope;

// =========================================================================
// Explicit runtime caching — README와 1:1 매칭
// =========================================================================
const runtimeCaching: RuntimeCaching[] = [
  // 1. Next.js 정적 자산 (immutable hashed)
  {
    matcher: ({ url }) => url.pathname.startsWith("/_next/static/"),
    handler: new CacheFirst({
      cacheName: "next-static",
      plugins: [new ExpirationPlugin({ maxEntries: 200, maxAgeSeconds: 30 * 24 * 60 * 60 })],
    }),
  },
  // 2. 이미지 (아이콘, OG, 로고 등)
  {
    matcher: ({ request }) => request.destination === "image",
    handler: new CacheFirst({
      cacheName: "images",
      plugins: [new ExpirationPlugin({ maxEntries: 100, maxAgeSeconds: 30 * 24 * 60 * 60 })],
    }),
  },
  // 3. 폰트 (Pretendard CDN)
  {
    matcher: ({ request }) => request.destination === "font",
    handler: new CacheFirst({
      cacheName: "fonts",
      plugins: [new ExpirationPlugin({ maxEntries: 30, maxAgeSeconds: 365 * 24 * 60 * 60 })],
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
      plugins: [new ExpirationPlugin({ maxEntries: 60, maxAgeSeconds: 5 * 60 })],
    }),
  },
  // 5. 변경 API — 절대 캐시 안 함 (POST/PATCH/DELETE)
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
      plugins: [new ExpirationPlugin({ maxEntries: 50, maxAgeSeconds: 24 * 60 * 60 })],
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
// Plan #7 — Web Push handlers (preserved as-is)
// =========================================================================
self.addEventListener("push", (event: PushEvent) => {
  let data: { title?: string; body?: string; url?: string } = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { title: "YGinvest", body: event.data ? event.data.text() : "" };
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
  const url = (event.notification.data as { url?: string } | null)?.url || "/app/dashboard";
  event.waitUntil(
    self.clients.matchAll({ type: "window" }).then((clients) => {
      const existing = clients.find((c) => c.url.includes(url));
      if (existing) return existing.focus();
      return self.clients.openWindow(url);
    }),
  );
});
```

**중요:**
- `defaultCache`는 Serwist가 제공하는 합리적 기본값 (Next 정적자산, 이미지, 폰트, 같은 origin GET 등 자동 처리)
- `fallbacks.entries`는 네비게이션이 실패하면 `/offline`로 떨어짐
- Push 핸들러는 `serwist.addEventListeners()` 호출 **이후**에 추가해도 무방 — Workbox는 추가 이벤트 리스너에 간섭하지 않음

- [ ] **Step 2: 기존 public/sw.js 삭제**

```bash
rm "C:/Users/Helios_Neo_18/모의 주식/apps/web/public/sw.js"
```

이후 빌드 시 Serwist가 동일 경로(`public/sw.js`)에 새 파일을 자동 생성함. 기존 `lib/push.ts`의 `navigator.serviceWorker.register("/sw.js")` 호출은 그대로 동작.

- [ ] **Step 3: 커밋**

```bash
git add apps/web/app/sw.ts apps/web/public/sw.js
git commit -m "feat(web): migrate sw to app/sw.ts (Serwist + push preserved)"
```

---

## Task 4: next.config.ts — withSerwist 통합

**Files:**
- Modify: `apps/web/next.config.ts`

- [ ] **Step 1: next.config.ts 작성**

`apps/web/next.config.ts`:
```ts
import withSerwistInit from "@serwist/next";
import type { NextConfig } from "next";

const withSerwist = withSerwistInit({
  swSrc: "app/sw.ts",
  swDest: "public/sw.js",
  // dev에선 캐싱이 헷갈리므로 disable
  disable: process.env.NODE_ENV === "development",
  // 빌드 reproducibility
  reloadOnOnline: true,
});

const nextConfig: NextConfig = {
  // /sw.js 헤더 — 항상 최신 SW 받도록
  async headers() {
    return [
      {
        source: "/sw.js",
        headers: [
          { key: "Content-Type", value: "application/javascript; charset=utf-8" },
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Service-Worker-Allowed", value: "/" },
        ],
      },
    ];
  },
};

export default withSerwist(nextConfig);
```

- [ ] **Step 2: 빌드 dry-run으로 검증**

```bash
cd "C:/Users/Helios_Neo_18/모의 주식/apps/web"
npm run build 2>&1 | tail -50
```

Expected:
- Serwist 로그: "Compiling service worker" 출력
- 빌드 끝나면 `public/sw.js` 새로 생성됨
- 빌드 에러 없음

만약 `app/sw.ts`가 Next.js의 라우트 파일로 오인식되면 build 에러. 해결: `swSrc`를 `app/sw.ts`가 아닌 `src/sw.ts` 같은 비-라우팅 경로로 이동. 이 경우 plan 수정.

- [ ] **Step 3: 생성된 sw.js 빠른 확인**

```bash
head -50 "C:/Users/Helios_Neo_18/모의 주식/apps/web/public/sw.js"
```

Expected: workbox 부트스트랩 + manifest 배열 + push 핸들러 코드가 보임.

- [ ] **Step 4: 커밋 (생성물 제외)**

```bash
# 생성물(public/sw.js, sw.js.map, workbox-*.js)은 .gitignore에 추가
git add apps/web/next.config.ts
git commit -m "feat(web): wire withSerwist + sw.js cache headers"
```

---

## Task 5: 생성물 .gitignore

**Files:**
- Modify: `apps/web/.gitignore`

- [ ] **Step 1: .gitignore 확인 + 갱신**

```bash
cat apps/web/.gitignore
```

기존 내용 확인 후, 다음 라인 추가:
```
# Serwist build artifacts
/public/sw.js
/public/sw.js.map
/public/workbox-*.js
/public/workbox-*.js.map
/public/swe-worker-*.js
```

`Edit` 도구로 추가. 만약 이미 `.next` 등이 ignore되어 있으면 그 아래에 새 섹션 추가.

- [ ] **Step 2: 빌드물 untrack**

```bash
cd "C:/Users/Helios_Neo_18/모의 주식/apps/web"
git rm --cached public/sw.js 2>/dev/null || true
git rm --cached public/sw.js.map 2>/dev/null || true
git rm --cached "public/workbox-*.js" 2>/dev/null || true
```

(이미 Task 3에서 sw.js를 삭제했으므로 첫 번째는 no-op일 수 있음. 빌드 후 새로 생긴 파일은 ignore될 것.)

- [ ] **Step 3: 커밋**

```bash
git add apps/web/.gitignore
git commit -m "chore(web): gitignore Serwist build artifacts"
```

---

## Task 6: /offline fallback 페이지

**Files:**
- Create: `apps/web/app/offline/page.tsx`

- [ ] **Step 1: Offline 페이지 작성**

`apps/web/app/offline/page.tsx`:
```tsx
import Link from "next/link";
import { WifiOff, RefreshCw } from "lucide-react";

export const dynamic = "force-static";

export const metadata = {
  title: "오프라인 — YGinvest",
};

export default function OfflinePage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-background text-foreground">
      <div className="max-w-sm text-center space-y-6">
        <div className="inline-flex items-center justify-center h-20 w-20 rounded-full bg-muted">
          <WifiOff className="h-10 w-10 text-muted-foreground" />
        </div>
        <div className="space-y-2">
          <h1 className="text-2xl font-bold">오프라인 상태예요</h1>
          <p className="text-sm text-muted-foreground">
            인터넷 연결이 끊겨 새 데이터를 가져올 수 없어요.
            <br />
            연결이 복구되면 자동으로 다시 불러올게요.
          </p>
        </div>
        <div className="flex flex-col gap-2">
          <Link
            href="/app/dashboard"
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary text-primary-foreground px-4 py-2 text-sm font-medium hover:opacity-90"
          >
            <RefreshCw className="h-4 w-4" />
            대시보드로 가기
          </Link>
        </div>
      </div>
    </div>
  );
}
```

`export const dynamic = "force-static"` — 이 페이지는 SSG로 빌드되어 SW가 precache 할 수 있음.

- [ ] **Step 2: 빌드 후 정적 생성 확인**

```bash
npm run build 2>&1 | grep "offline"
```

Expected: `/offline` 라우트가 `○ (Static)`로 마킹.

- [ ] **Step 3: 커밋**

```bash
git add apps/web/app/offline/
git commit -m "feat(web): /offline fallback page (static)"
```

---

## Task 7: E2E 테스트 — 오프라인 시나리오 (prod-build harness)

**Files:**
- Create: `apps/web/tests/e2e/offline-mode.spec.ts`
- Create: `apps/web/playwright.prod.config.ts` (prod-build E2E 전용 config)
- Modify: `apps/web/package.json` (scripts에 `test:e2e:prod` 추가)

**핵심:** Serwist는 `disable: NODE_ENV === 'development'`이므로 SW는 prod 빌드에서만 동작. dev 모드 E2E는 SW 등록·오프라인 fallback을 테스트할 수 없음. 따라서 **별도의 prod harness**가 필요.

- [ ] **Step 1: 테스트 작성**

`apps/web/tests/e2e/offline-mode.spec.ts`:
```ts
import { test, expect, type Page } from "@playwright/test";

const PROD = process.env.PW_PROD === "1";

async function signupAndGoToDashboard(page: Page) {
  const email = `off-${Date.now()}@test.com`;
  await page.goto("/auth/login");
  await page.getByRole("button", { name: /가입하기/i }).click();
  await page.getByLabel("이메일").fill(email);
  await page.getByLabel("비밀번호").fill("TestPass123!");
  await page.getByRole("button", { name: /^가입$/i }).click();
  await expect(page).toHaveURL(/\/app\/dashboard/, { timeout: 15_000 });
}

test.describe("Offline mode (Serwist)", () => {
  test("SW 등록 + 오프라인 시 /offline fallback (prod-only)", async ({ page, context }) => {
    test.skip(!PROD, "Serwist disabled in dev — run with PW_PROD=1 against prod build");

    await signupAndGoToDashboard(page);

    // SW 활성화 대기 (Workbox precache 후 claim)
    await page.waitForFunction(async () => {
      const reg = await navigator.serviceWorker.getRegistration();
      return reg?.active?.state === "activated";
    }, { timeout: 10_000 });

    const swUrl = await page.evaluate(async () => {
      const reg = await navigator.serviceWorker.getRegistration();
      return reg?.active?.scriptURL ?? null;
    });
    expect(swUrl).toContain("/sw.js");

    // 한 번 더 idle 시간 (precache 완료)
    await page.waitForTimeout(1500);

    // 오프라인 전환
    await context.setOffline(true);

    // 캐시 안 된 경로 네비게이션 → /offline fallback
    await page.goto("/app/portfolio/overview", { waitUntil: "domcontentloaded" });
    await expect(page.getByText(/오프라인 상태예요/)).toBeVisible({ timeout: 10_000 });

    await context.setOffline(false);
  });

  test("/offline 페이지 직접 접근 가능 (always)", async ({ page }) => {
    await page.goto("/offline");
    await expect(page.getByText(/오프라인 상태예요/)).toBeVisible();
    await expect(page.getByRole("link", { name: /대시보드로 가기/ })).toBeVisible();
  });
});
```

- [ ] **Step 2: prod-harness Playwright config 작성**

`apps/web/playwright.prod.config.ts`:
```ts
import { defineConfig } from "@playwright/test";
import baseConfig from "./playwright.config";

export default defineConfig({
  ...baseConfig,
  webServer: {
    command: "npm run build && npm run start -- --port 3001",
    url: "http://localhost:3001",
    reuseExistingServer: false,
    timeout: 180_000,
    stdout: "pipe",
    stderr: "pipe",
  },
  use: {
    ...baseConfig.use,
    baseURL: "http://localhost:3001",
  },
});
```

(만약 기존 `playwright.config.ts`가 default export 안 하거나 다른 구조면, Step 1 시 file 읽어보고 형식 맞춤. `playwright.config.ts` 읽고 호환되는 방식으로 수정.)

- [ ] **Step 3: package.json에 prod e2e 스크립트 추가**

`apps/web/package.json` scripts에 두 줄 추가:
```json
"test:e2e:prod": "cross-env PW_PROD=1 playwright test --config=playwright.prod.config.ts",
```

(`cross-env`는 이미 사용 중이면 그대로, 아니면 npm install --save-dev cross-env 필요. 또는 `PW_PROD=1`을 그대로 두고 user가 PowerShell에선 `$env:PW_PROD=1; npm run test:e2e:prod`로 실행한다고 README에 명시.)

대안: cross-env 안 쓰고 PowerShell에서는 `$env:PW_PROD="1"; npx playwright test --config=playwright.prod.config.ts`.

- [ ] **Step 4: dev harness에서 "직접 접근" 테스트만 실행**

```bash
cd "C:/Users/Helios_Neo_18/모의 주식/apps/web"
npx playwright test offline-mode.spec.ts -g "직접 접근" 2>&1 | tail -20
```

Expected: 1 passed, 1 skipped(prod-only).

- [ ] **Step 5: prod harness E2E 실행 (옵션 — 수동 또는 CI)**

빌드가 ~30s 걸리므로 매번은 부담. 머지 직전에 1회 실행 권장:
```bash
cd "C:/Users/Helios_Neo_18/모의 주식/apps/web"
PW_PROD=1 npx playwright test --config=playwright.prod.config.ts offline-mode.spec.ts 2>&1 | tail -40
```

Expected: 2 passed.

만약 prod E2E가 시간 부족·환경 문제로 실패하면, Task 10 Step 3 수동 검증에서 Chrome DevTools로 동등 검증 후 진행 가능.

- [ ] **Step 6: 커밋**

```bash
git add apps/web/tests/e2e/offline-mode.spec.ts apps/web/playwright.prod.config.ts apps/web/package.json
git commit -m "test(web): E2E offline-mode (dev: direct page, prod harness: SW + fallback)"
```

---

## Task 7.5: 로그아웃 시 CacheStorage 비우기 (보안)

**Why:** NetworkFirst HTML 캐시에 사용자 A의 `/app/dashboard` 페이지가 들어가 있으면, 로그아웃 후 사용자 B가 같은 디바이스에서 잠시(redirect 전) 전 사용자 데이터를 볼 수 있음. 로그아웃 시 SW 캐시를 명시적으로 비우는 헬퍼 추가.

**Files:**
- Create: `apps/web/lib/sw-cache.ts`
- Modify: `apps/web/app/auth/signout/route.ts` (또는 signout action — 위치 확인 후)

- [ ] **Step 1: 기존 signout 위치 확인**

```bash
grep -rn "signOut\|sign_out\|signout" apps/web/app apps/web/lib --include="*.ts" --include="*.tsx" | head -10
```

대부분 Supabase의 `supabase.auth.signOut()` 호출 부분이 있을 것. 클라이언트 컴포넌트라면 호출 직후에 cache 비우기 가능.

- [ ] **Step 2: lib/sw-cache.ts 작성**

`apps/web/lib/sw-cache.ts`:
```ts
/**
 * Service Worker / CacheStorage helpers.
 * 로그아웃 시 다른 사용자에게 전 사용자 캐시가 노출되지 않도록 강제 정리.
 */

export async function clearAppCaches(): Promise<void> {
  if (typeof window === "undefined" || !("caches" in window)) return;
  try {
    const keys = await caches.keys();
    await Promise.all(
      keys
        // workbox 정적 자산 캐시(next-static, fonts, images)는 보존 — 다른 사용자도 같은 자산을 받음
        .filter((k) => k === "pages" || k === "read-api")
        .map((k) => caches.delete(k)),
    );
  } catch {
    // 캐시 비우기 실패는 치명적이지 않음 — 무시
  }
}
```

- [ ] **Step 3: signout 시점에 호출**

signout이 client component(예: settings의 로그아웃 버튼)에서 일어난다면 `await supabase.auth.signOut()` 직후 `await clearAppCaches()` 호출. Server action이라면 client-side로 redirect 후 mount 시점에 호출. 가장 간단한 방법: 로그아웃 트리거 컴포넌트에 추가.

(위치는 Step 1 결과로 확정. 코드 변경은 1–3줄 추가만.)

- [ ] **Step 4: 커밋**

```bash
git add apps/web/lib/sw-cache.ts apps/web/app/  # 변경된 signout 파일 포함
git commit -m "feat(web): clear pages/read-api SW caches on signout (Plan #11 hardening)"
```

---

## Task 8: README 업데이트

**Files:**
- Modify: `README.md`

- [ ] **Step 1: README 수정**

기존 README에 "Plan #11 — 오프라인 모드 (Serwist)" 섹션 추가. 위치는 Plan #9 (PWA) 섹션 다음.

내용:
```markdown
### Plan #11 — 오프라인 모드 (Serwist) ✅

- `@serwist/next` 9.5.11으로 서비스 워커 컴파일 + 명시적 런타임 캐싱
- 캐시 전략 (코드와 1:1 매칭):

| 패턴 | Handler | Cache 이름 | TTL |
|------|---------|------------|-----|
| `/_next/static/*` | CacheFirst | `next-static` | 30d / 200 entries |
| `request.destination === "image"` | CacheFirst | `images` | 30d / 100 entries |
| `request.destination === "font"` | CacheFirst | `fonts` | 1y / 30 entries |
| `GET /api/recommendations`, `GET /api/stocks/*` | StaleWhileRevalidate | `read-api` | 5m / 60 entries |
| 변경 API (POST/PATCH/DELETE) | NetworkOnly | — | — |
| HTML 네비게이션 | NetworkFirst (3s timeout) | `pages` | 1d / 50 entries |

- 모든 네비게이션 실패는 `/offline` fallback으로 처리
- 기존 Plan #7 Web Push 핸들러 그대로 유지 (`app/sw.ts`에 통합)
- 로그아웃 시 `pages` + `read-api` 캐시 자동 삭제 (`lib/sw-cache.ts`)
- Dev 모드에선 SW 비활성화 (`disable: NODE_ENV === 'development'`)
- E2E: `npm run test:e2e` (dev — `/offline` 직접 접근) / `PW_PROD=1 npx playwright test --config=playwright.prod.config.ts` (prod — SW 등록 + fallback)

오프라인 동작 테스트 (Chrome):
1. 앱 한 번 방문 → 대시보드 로드
2. DevTools → Network → "Offline"
3. 새 URL로 이동 → `/offline` 페이지 표시
```

- [ ] **Step 2: 커밋**

```bash
git add README.md
git commit -m "docs: Plan #11 offline mode (Serwist) section"
```

---

## Task 9: 빌드 + 전체 테스트 검증

- [ ] **Step 1: 빌드**

```bash
cd "C:/Users/Helios_Neo_18/모의 주식/apps/web"
rm -rf .next public/sw.js public/workbox-*.js public/sw.js.map 2>/dev/null
npm run build 2>&1 | tail -60
```

Expected:
- "Compiled successfully" 또는 동급
- Serwist 빌드 메시지
- `public/sw.js`, `public/workbox-*.js` 생성됨

- [ ] **Step 2: lint**

```bash
npm run lint 2>&1 | tail -20
```

Expected: 0 errors.

- [ ] **Step 3: E2E (offline 페이지 직접 접근 + 기존 watchlist/trading 회귀)**

```bash
npx playwright test 2>&1 | tail -30
```

Expected:
- offline `/offline 직접 접근` PASS
- 기존 watchlist E2E PASS
- 기존 trading E2E PASS or SKIP (KR 장 시간 외)
- offline `SW 등록 + fallback` SKIP (dev 환경)

만약 watchlist/trading 회귀 실패 → push registration이 깨졌을 가능성 → `app/sw.ts`의 push handler를 다시 확인.

- [ ] **Step 4: 수동 검증 — dev 서버에서 /offline 직접 접근**

```bash
npm run dev &
sleep 5
curl -s http://localhost:3000/offline | grep "오프라인 상태예요"
kill %1
```

Expected: `오프라인 상태예요` 문자열 포함된 HTML.

---

## Task 10: 머지 + 배포

- [ ] **Step 1: master 머지**

```bash
git checkout master
git pull origin master
git merge --no-ff plan-11-offline-mode -m "Merge plan-11-offline-mode: Serwist offline caching + /offline fallback"
git push origin master
```

- [ ] **Step 2: Vercel 프로덕션 배포**

```bash
cd "C:/Users/Helios_Neo_18/모의 주식/apps/web"
vercel --prod --yes 2>&1 | tail -20
```

Expected: deployment ready, https://yginvest.vercel.app 별칭 적용.

- [ ] **Step 3: 프로덕션 검증**

브라우저로 https://yginvest.vercel.app 접속:
1. DevTools → Application → Service Workers → `sw.js`의 상태가 `activated and is running` (3초 이내) — install/activate 타이밍 회귀 검증
2. DevTools → Application → Cache Storage → `pages`, `read-api`, `next-static`, `images`, `fonts` 중 일부 캐시 존재
3. DevTools → Network → "Offline" 체크 → 새 URL 이동 (예: `/app/trade/AAPL`) → `/offline` fallback 표시
4. Push 알림 — Plan #7 회귀 — 설정에서 푸시 토글 ON → 워커가 push 전송 → 알림 도착 확인 (선택적이지만 필수)
5. 로그아웃 후 같은 디바이스에서 페이지 새로고침 → `pages` / `read-api` 캐시 삭제 확인 (DevTools Application → Cache Storage)

- [ ] **Step 4: 브랜치 정리**

```bash
git branch -d plan-11-offline-mode
```

- [ ] **Step 5: TodoWrite 갱신**

Plan #11 완료 → 추후 작업: Plan #12 (NXT Phase B) 또는 다른 우선순위.

---

## Risks / Mitigations

| Risk | Mitigation |
|------|------------|
| Push 알림 깨짐 (기존 sw.js handler 미이전) | Task 3에서 4개 이벤트 핸들러 한 줄씩 옮기고 코드 리뷰 |
| Next.js 16 Turbopack과 @serwist/next 충돌 | `next build`는 webpack 기본이므로 호환. dev에선 disable. |
| `app/sw.ts`를 Next router가 라우트로 인식 | Serwist는 이미 이 패턴(`app/sw.ts`)을 권장. router는 `page.tsx`/`route.ts`만 라우팅. |
| 캐시된 인증된 API가 다른 사용자에게 노출 | 읽기 API는 StaleWhileRevalidate라 같은 origin 같은 브라우저 내에서만 공유. **Task 7.5**에서 로그아웃 시 `pages`+`read-api` 캐시 명시적 삭제. |
| install/activate 타이밍 변경 (Serwist는 precache 완료 후 claim) | Task 9 Step 3에서 SW 상태 `activated and is running` 3초 이내 확인. |
| `/sw.js`에 Cache-Control 잘못 → 사용자가 옛 SW 영영 받음 | next.config.ts에서 `no-cache, no-store, must-revalidate` 명시. |
| 빌드 산물 커밋 | Task 5에서 `.gitignore` 갱신 + `git rm --cached`. |
| E2E에서 SW 등록이 dev 모드라 동작 안 함 | `setOffline` 테스트는 `test.skip(NODE_ENV !== 'production')`로 SKIP. 프로덕션 검증은 수동. |

---

## Completion Criteria

- [x] N/A — 작성용
- ✅ `npm run build` 성공, `public/sw.js` 생성
- ✅ Push 알림 회귀 없음 — 기존 lib/push.ts 등록 호출 정상 동작
- ✅ `/offline` 페이지 SSG로 빌드
- ✅ 기존 E2E (watchlist, trading) PASS 또는 SKIP
- ✅ Vercel 프로덕션에서 `sw.js` 응답 200 + `Cache-Control: no-cache` 헤더
- ✅ DevTools Application → Service Workers에서 등록 확인
- ✅ Offline 시 fallback 페이지 표시 확인
- ✅ master 머지 + Vercel 배포 + 브랜치 정리
