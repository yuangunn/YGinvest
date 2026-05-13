# Background Sync (오프라인 중 주문 큐잉) Implementation Plan — Plan #11.5

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (chosen by user — inline) to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 오프라인 중에 매수/매도, 환전, 관심종목 토글, 주문 취소를 시도하면 Background Sync 큐에 저장되어 연결 복구 시 자동 재전송된다. 사용자는 "예약됨" 토스트로 즉시 피드백을 받고, 주문 체결 시 Plan #7 Web Push로 알림 받는다.

**Architecture:** Plan #11에서 추가한 `app/sw.ts`의 `NetworkOnly` 변경 API 핸들러를 강화 — Workbox `BackgroundSyncPlugin`을 부착해서 fetch 실패 시 IndexedDB에 큐잉. 브라우저가 'sync' 이벤트를 발사하면 SW가 자동 재전송. 큐는 카테고리별로 분리(`orders-sync`, `fx-sync`, `watchlist-sync`)해서 디버깅과 유지보수 용이성 확보. 클라이언트는 `lib/offline-fetch.ts` 헬퍼로 fetch를 감싸 `navigator.onLine === false` 감지 시 sonner toast로 "예약됨" 안내. 시장가 주문은 sync 시점 가격으로 체결됨을 사용자에게 명시 (가격 risk 투명성).

**Tech Stack:** serwist의 `BackgroundSyncPlugin` (Workbox 래퍼, IndexedDB 큐), `navigator.onLine`, sonner toast, Playwright `context.setOffline`.

---

## Scope (explicit limits)

In scope:
- **Orders** — POST `/api/orders` (시장가/지정가), DELETE `/api/orders/[id]` (취소)
- **FX** — POST `/api/fx/exchange`
- **Watchlist** — POST + DELETE `/api/watchlist/[symbol]`
- 클라이언트 helper `offlineFetch()` — fetch 결과를 `{ status: "ok" | "queued" | "error", ... }`로 정규화
- 4개 폼 컴포넌트(OrderForm, FxExchangeForm, WatchlistButton, CancelOrderButton)에 helper 적용
- 시장가 주문 toast에 "가격 risk" 명시
- 최대 보존 시간 60분 (`maxRetentionTime: 60`) — 1시간 넘은 큐는 자동 폐기
- README "Background Sync (Plan #11.5)" 섹션
- E2E — offline 주문 → online 복귀 → 큐 처리 확인 (prod harness)

Out of scope (defer):
- Rooms (room 생성/가입) — 오프라인 사용 시나리오 드뭄
- Push subscribe/unsubscribe — 알림 자체가 의미 없음
- Notification settings — 동일
- Portfolio switcher — 클라이언트 쿠키만 변경
- Stock search — GET이라 캐싱으로 충분
- 큐 상태 UI — pending sync 개수 시각화 (별도 plan)
- iOS Safari 지원 — Background Sync API는 Chrome/Edge/Firefox만, iOS Safari 미지원 (graceful degradation: 그냥 실패)
- 사용자 입력 시점 가격 freeze (`limit_price` 명시되면 OK, 시장가는 sync 시점 가격)

---

## File Structure

### Web — new
- **Create** `apps/web/lib/offline-fetch.ts` — mutation fetch wrapper

### Web — modify
- **Modify** `apps/web/app/sw.ts` — BackgroundSyncPlugin 3개 매처 + import
- **Modify** `apps/web/components/order-form.tsx` — 헬퍼 적용
- **Modify** `apps/web/components/fx-exchange-form.tsx` — 헬퍼 적용
- **Modify** `apps/web/components/watchlist-button.tsx` — 헬퍼 적용
- **Modify** `apps/web/components/cancel-order-button.tsx` — 헬퍼 적용

### Tests
- **Create** `apps/web/tests/e2e/background-sync.spec.ts` — prod harness 전용

### Docs
- **Modify** `README.md` — Plan #11.5 섹션 추가

---

## Task 1: 환경 점검

- [ ] **Step 1: branch 확인**

```bash
git branch --show-current
```

Expected: `plan-11-5-background-sync`

- [ ] **Step 2: serwist 버전 + BackgroundSyncPlugin 익스포트 확인**

```bash
cd "C:/Users/Helios_Neo_18/모의 주식/apps/web"
npm ls serwist 2>&1 | tail -3
```

Expected: `serwist@9.5.11` 단일 버전. 9.x에서 BackgroundSyncPlugin export 확인됨 (Plan #11 install 시 동일 dep 사용).

추가 패키지 설치 불필요. 이 plan은 DB 변경 없음.

---

## Task 2: `lib/offline-fetch.ts` helper 작성

**Files:**
- Create: `apps/web/lib/offline-fetch.ts`

**핵심:** mutation fetch는 세 가지 결과:
1. `ok` — 200대 응답, 정상 처리됨
2. `queued` — 네트워크 실패 + `navigator.onLine === false` → SW BackgroundSyncPlugin이 큐에 저장
3. `error` — 4xx/5xx 응답 또는 온라인 상태인데 네트워크 에러 (서버 다운 등)

- [ ] **Step 1: 헬퍼 작성**

`apps/web/lib/offline-fetch.ts`:
```ts
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
```

- [ ] **Step 2: 커밋**

```bash
git add apps/web/lib/offline-fetch.ts
git commit -m "feat(web): offlineFetch helper — distinguish queued vs error (Plan #11.5)"
```

---

## Task 3: `app/sw.ts`에 BackgroundSyncPlugin 추가

**Files:**
- Modify: `apps/web/app/sw.ts`

- [ ] **Step 1: BackgroundSyncPlugin import**

`app/sw.ts` 상단 import에 `BackgroundSyncPlugin` 추가:
```ts
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
```

- [ ] **Step 2: 큐 인스턴스 3개 생성**

`runtimeCaching` 배열 정의 **직전**에 추가:
```ts
// =========================================================================
// Background Sync queues (Plan #11.5) — categorical for debuggability
// =========================================================================
const ordersSyncPlugin = new BackgroundSyncPlugin("orders-sync", {
  maxRetentionTime: 60, // minutes
});
const fxSyncPlugin = new BackgroundSyncPlugin("fx-sync", {
  maxRetentionTime: 60,
});
const watchlistSyncPlugin = new BackgroundSyncPlugin("watchlist-sync", {
  maxRetentionTime: 60,
});
```

- [ ] **Step 3: runtimeCaching의 "변경 API" 매처를 3개 분리**

기존:
```ts
// 5. 변경 API — 절대 캐시 안 함 (POST/PATCH/DELETE)
{
  matcher: ({ request }) => request.method !== "GET",
  handler: new NetworkOnly(),
},
```

다음으로 교체:
```ts
// 5a. Orders mutation — Background Sync queueing
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
```

매처 순서가 중요 — Workbox는 first-match-wins. 5a→5b→5c→5d.

- [ ] **Step 4: 빌드로 검증**

```bash
cd "C:/Users/Helios_Neo_18/모의 주식/apps/web"
rm -rf .next
npm run build 2>&1 | tail -20
```

Expected:
- "Compiled successfully"
- Serwist bundle 메시지
- `public/sw.js` 생성됨
- 빌드 에러 없음

- [ ] **Step 5: SW 안의 BackgroundSync 클래스 포함 확인**

```bash
grep -c "BackgroundSync\|backgroundSync\|orders-sync" "C:/Users/Helios_Neo_18/모의 주식/apps/web/public/sw.js"
```

Expected: 양수 (compiled queue 이름이 들어 있음)

- [ ] **Step 6: 커밋**

```bash
git add apps/web/app/sw.ts
git commit -m "feat(sw): BackgroundSyncPlugin for orders/fx/watchlist mutations (Plan #11.5)"
```

---

## Task 4: 4개 폼 컴포넌트에 헬퍼 적용

### Task 4a: WatchlistButton

**Files:**
- Modify: `apps/web/components/watchlist-button.tsx`

- [ ] **Step 1: 헬퍼 적용**

```tsx
"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { offlineFetch } from "@/lib/offline-fetch";

type Props = {
  symbol: string;
  initialWatched: boolean;
};

export function WatchlistButton({ symbol, initialWatched }: Props) {
  const [watched, setWatched] = useState(initialWatched);
  const [isPending, startTransition] = useTransition();

  function toggle() {
    startTransition(async () => {
      const method = watched ? "DELETE" : "POST";
      const wasWatched = watched;
      const result = await offlineFetch(
        `/api/watchlist/${encodeURIComponent(symbol)}`,
        { method },
      );
      if (result.status === "ok") {
        toast.success(wasWatched ? "관심종목 해제됨" : "관심종목 추가됨");
        setWatched(!wasWatched);
      } else if (result.status === "queued") {
        toast.info(
          wasWatched
            ? "오프라인 — 연결 시 관심종목 해제됩니다"
            : "오프라인 — 연결 시 관심종목 추가됩니다",
        );
        // optimistic toggle so user doesn't think it didn't work
        setWatched(!wasWatched);
      } else {
        toast.error(`실패: ${result.error}`);
      }
    });
  }

  return (
    <Button variant="outline" size="sm" onClick={toggle} disabled={isPending}>
      {watched ? "★ 관심종목 해제" : "☆ 관심종목 추가"}
    </Button>
  );
}
```

### Task 4b: CancelOrderButton

**Files:**
- Modify: `apps/web/components/cancel-order-button.tsx`

- [ ] **Step 1: 헬퍼 적용**

```tsx
"use client";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { offlineFetch } from "@/lib/offline-fetch";

export function CancelOrderButton({ orderId }: { orderId: string }) {
  const [loading, setLoading] = useState(false);
  async function cancel() {
    if (!confirm("이 주문을 취소하시겠습니까?")) return;
    setLoading(true);
    const result = await offlineFetch(`/api/orders/${orderId}`, {
      method: "DELETE",
    });
    setLoading(false);
    if (result.status === "ok") {
      toast.success("주문 취소됨");
      location.reload();
    } else if (result.status === "queued") {
      toast.info("오프라인 — 연결 시 취소 요청 전송됩니다");
    } else {
      toast.error(`취소 실패: ${result.error}`);
    }
  }
  return (
    <Button size="sm" variant="outline" onClick={cancel} disabled={loading}>
      취소
    </Button>
  );
}
```

### Task 4c: OrderForm

**Files:**
- Modify: `apps/web/components/order-form.tsx`

**중요:** 시장가 주문은 sync 시점 가격으로 체결됨 — 사용자에게 명확히 알려야 함.

- [ ] **Step 1: 헬퍼 적용**

`submit` 함수 부분만 교체:
```tsx
import { offlineFetch } from "@/lib/offline-fetch";
import { toast } from "sonner";

// ... 컴포넌트 안 ...
async function submit(e: React.FormEvent) {
  e.preventDefault();
  setMessage(null);
  setSubmitting(true);
  const body: Record<string, unknown> = {
    portfolio_id: portfolioId,
    symbol,
    side,
    type,
    quantity: Number(quantity),
  };
  if (type === "limit") body.limit_price = Number(limitPrice);
  const result = await offlineFetch<{ filled_avg_price?: number }>(
    "/api/orders",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
  );
  setSubmitting(false);
  if (result.status === "ok") {
    setMessage({
      kind: "ok",
      text:
        type === "market"
          ? `체결됨: ${result.data.filled_avg_price}`
          : "주문 접수됨 (대기)",
    });
  } else if (result.status === "queued") {
    const note =
      type === "market"
        ? "오프라인 — 연결 시 자동 전송됩니다 (시장가는 그때 가격으로 체결)"
        : "오프라인 — 연결 시 자동 전송됩니다";
    toast.info(note);
    setMessage({ kind: "ok", text: "동기화 예약됨" });
  } else {
    setMessage({ kind: "err", text: result.error });
  }
}
```

기존 inline Alert는 유지 (E2E 의존성). `message.text === "체결됨..."` 정규식 패턴 변하지 않음.

### Task 4d: FxExchangeForm

**Files:**
- Modify: `apps/web/components/fx-exchange-form.tsx`

- [ ] **Step 1: 헬퍼 적용**

`submit` 함수 부분만 교체:
```tsx
import { offlineFetch } from "@/lib/offline-fetch";
import { toast } from "sonner";

// ... 컴포넌트 안 ...
async function submit(e: React.FormEvent) {
  e.preventDefault();
  setMessage(null);
  setSubmitting(true);
  const [from_currency, to_currency] =
    direction === "KRW_TO_USD" ? ["KRW", "USD"] : ["USD", "KRW"];
  const result = await offlineFetch<{ to_amount: number; rate: number }>(
    "/api/fx/exchange",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        portfolio_id: portfolioId,
        from_currency,
        to_currency,
        from_amount: Number(amount),
      }),
    },
  );
  setSubmitting(false);
  if (result.status === "ok") {
    setMessage({
      kind: "ok",
      text: `완료: ${result.data.to_amount} ${to_currency} (rate ${result.data.rate})`,
    });
    setTimeout(() => location.reload(), 1500);
  } else if (result.status === "queued") {
    toast.info("오프라인 — 연결 시 환전 요청 전송됩니다 (그때 환율 적용)");
    setMessage({ kind: "ok", text: "동기화 예약됨" });
  } else {
    setMessage({ kind: "err", text: result.error });
  }
}
```

### Task 4e: 커밋

- [ ] **Step 1: 커밋**

```bash
git add apps/web/components/watchlist-button.tsx \
        apps/web/components/cancel-order-button.tsx \
        apps/web/components/order-form.tsx \
        apps/web/components/fx-exchange-form.tsx
git commit -m "feat(web): wire offlineFetch helper into mutation forms (Plan #11.5)"
```

---

## Task 5: E2E — Background Sync prod harness 테스트

**Files:**
- Create: `apps/web/tests/e2e/background-sync.spec.ts`

**핵심:** dev 환경에선 SW 비활성 → Background Sync 동작 안 함. prod harness(`playwright.prod.config.ts`)에서만 의미 있는 테스트.

- [ ] **Step 1: 테스트 작성**

```ts
import { test, expect, type Page } from "@playwright/test";

const PROD = process.env.PW_PROD === "1";

async function signupAndGoToTrade(page: Page, symbol: string) {
  const email = `bgsync-${Date.now()}@test.com`;
  await page.goto("/auth/login");
  await page.getByRole("button", { name: /가입하기/i }).click();
  await page.getByLabel("이메일").fill(email);
  await page.getByLabel("비밀번호").fill("TestPass123!");
  await page.getByRole("button", { name: /^가입$/i }).click();
  await expect(page).toHaveURL(/\/app\/dashboard/, { timeout: 15_000 });
  await page.goto(`/app/trade/${encodeURIComponent(symbol)}`);
}

test.describe("Background Sync (Plan #11.5)", () => {
  test("오프라인 시 watchlist 토글 → 'queued' 토스트", async ({
    page,
    context,
  }) => {
    test.skip(!PROD, "BackgroundSync requires registered SW (prod build)");
    await signupAndGoToTrade(page, "AAPL");

    // SW 활성화 대기
    await page.waitForFunction(
      async () => {
        const reg = await navigator.serviceWorker.getRegistration();
        return reg?.active?.state === "activated";
      },
      { timeout: 10_000 },
    );

    await context.setOffline(true);

    // 관심종목 토글 시도
    await page.getByRole("button", { name: /관심종목 추가/ }).click();

    // queued 메시지
    await expect(
      page.getByText(/오프라인.*관심종목 추가/),
    ).toBeVisible({ timeout: 10_000 });

    await context.setOffline(false);
  });

  test("client navigator.onLine===false 감지 정확함", async ({
    page,
    context,
  }) => {
    test.skip(!PROD, "SW must be registered to test offline detection");
    await signupAndGoToTrade(page, "AAPL");
    await context.setOffline(true);
    const isOnline = await page.evaluate(() => navigator.onLine);
    expect(isOnline).toBe(false);
    await context.setOffline(false);
  });

  test("watchlist mutation이 BackgroundSync IDB 큐에 저장됨", async ({
    page,
    context,
  }) => {
    test.skip(!PROD, "IndexedDB queue requires registered SW");
    await signupAndGoToTrade(page, "AAPL");

    // SW activated
    await page.waitForFunction(
      async () => {
        const reg = await navigator.serviceWorker.getRegistration();
        return reg?.active?.state === "activated";
      },
      { timeout: 10_000 },
    );

    await context.setOffline(true);
    await page.getByRole("button", { name: /관심종목 추가/ }).click();
    await expect(page.getByText(/오프라인.*관심종목 추가/)).toBeVisible({
      timeout: 10_000,
    });

    // IDB 큐에 1 entry 있는지 page.evaluate로 검증
    const queueLength = await page.evaluate(async () => {
      return new Promise<number>((resolve) => {
        const req = indexedDB.open("serwist-background-sync");
        req.onsuccess = () => {
          const db = req.result;
          // Workbox가 만드는 store 이름은 카테고리별. watchlist-sync 확인.
          const stores = Array.from(db.objectStoreNames);
          if (stores.length === 0) return resolve(0);
          // requests store가 있는지
          const storeName = stores.find((n) => n.includes("requests")) ?? stores[0];
          const tx = db.transaction(storeName, "readonly");
          const store = tx.objectStore(storeName);
          const countReq = store.count();
          countReq.onsuccess = () => resolve(countReq.result);
          countReq.onerror = () => resolve(-1);
        };
        req.onerror = () => resolve(-2);
      });
    });
    expect(queueLength).toBeGreaterThan(0);

    await context.setOffline(false);
  });
});
```

- [ ] **Step 2: dev 환경에선 SKIP 확인**

```bash
cd "C:/Users/Helios_Neo_18/모의 주식/apps/web"
npx playwright test background-sync.spec.ts 2>&1 | tail -10
```

Expected: 2 skipped (PW_PROD 미설정).

- [ ] **Step 3: 커밋**

```bash
git add apps/web/tests/e2e/background-sync.spec.ts
git commit -m "test(web): E2E Background Sync (prod-only — queued toast + onLine)"
```

---

## Task 6: README 업데이트

**Files:**
- Modify: `README.md`

- [ ] **Step 1: README 수정**

Plan #11 섹션 다음에 Plan #11.5 추가:

```markdown
### Plan #11.5 — Background Sync (오프라인 중 주문 큐잉) ✅ 완료

- [x] Workbox `BackgroundSyncPlugin` — orders/fx/watchlist 변경 API를 IndexedDB 큐에 저장 후 'sync' 이벤트로 자동 재전송
- [x] 큐 카테고리 분리: `orders-sync` / `fx-sync` / `watchlist-sync` (디버깅 용이성)
- [x] 최대 보존 시간 `maxRetentionTime: 60` — 1시간 넘은 큐는 자동 폐기
- [x] 클라이언트 helper `lib/offline-fetch.ts` — `navigator.onLine === false` 감지 → `{ status: "queued" }` 반환
- [x] 4개 폼 적용: `OrderForm`, `FxExchangeForm`, `WatchlistButton`, `CancelOrderButton`
- [x] 시장가 주문 토스트에 가격 risk 명시: "시장가는 그때 가격으로 체결"
- [x] 환전 토스트에 환율 risk 명시: "그때 환율 적용"
- [x] iOS Safari는 Background Sync API 미지원 — graceful degradation (그냥 실패)

큐 동작 검증 (Chrome):
1. https://yginvest.vercel.app 한 번 방문 → SW 활성화
2. DevTools → Network → "Offline"
3. 관심종목 토글 / 주문 / 환전 → 토스트 "오프라인 — 연결 시 자동..."
4. DevTools → Application → Service Workers → "sync" 이벤트 강제 발사
   또는 Network "Offline" 해제 → 자동 재전송
5. DevTools → Application → IndexedDB → `serwist-background-sync` 큐 비워짐 확인
```

`다음 plans` 섹션에서 "Background Sync" 항목 제거.

- [ ] **Step 2: 커밋**

```bash
git add README.md
git commit -m "docs: Plan #11.5 Background Sync — completion section"
```

---

## Task 7: 빌드 + lint + E2E 검증

- [ ] **Step 1: 빌드**

```bash
cd "C:/Users/Helios_Neo_18/모의 주식/apps/web"
rm -rf .next public/sw.js
npm run build 2>&1 | tail -20
```

Expected: 빌드 성공, `public/sw.js` 생성, 에러 없음.

- [ ] **Step 2: lint**

```bash
npm run lint 2>&1 | tail -5
```

Expected: 0 errors, 0 warnings.

- [ ] **Step 3: 전체 E2E**

```bash
npx playwright test 2>&1 | tail -10
```

Expected:
- watchlist E2E PASS (helper migration 회귀 없음)
- trading market order PASS or SKIP
- offline-mode dev test PASS
- background-sync dev tests SKIP (2)
- 기타 PASS

만약 watchlist E2E 실패 → optimistic toggle UX가 기존 테스트 expectation과 안 맞을 가능성. helper 적용 코드에서 토글 타이밍 확인.

---

## Task 8: 머지 + 배포

- [ ] **Step 1: master 머지**

```bash
cd "C:/Users/Helios_Neo_18/모의 주식"
git checkout master
git pull origin master
git merge --no-ff plan-11-5-background-sync \
  -m "Merge plan-11-5-background-sync: BackgroundSync queue + offlineFetch helper"
git push origin master
```

- [ ] **Step 2: Vercel 프로덕션 배포**

```bash
cd "C:/Users/Helios_Neo_18/모의 주식/apps/web"
vercel --prod --yes 2>&1 | tail -15
```

Expected: deployment ready, https://yginvest.vercel.app 별칭 적용.

- [ ] **Step 3: 프로덕션 수동 검증**

브라우저로 https://yginvest.vercel.app 로그인 후:
1. DevTools Application → Service Workers → `sw.js` `activated`
2. DevTools Application → IndexedDB → `serwist-background-sync` DB 존재 (큐 비어있음)
3. DevTools Network → "Offline"
4. /app/trade/AAPL → ☆ 관심종목 추가 → 토스트 "오프라인 — 연결 시 관심종목 추가됩니다"
5. DevTools Application → IndexedDB → `serwist-background-sync` → `watchlist-sync` queue에 1 entry
6. Network "Offline" 해제 → 잠시 후 큐 비워짐 → /app/watchlist에서 AAPL 보이는지 확인

- [ ] **Step 4: 브랜치 정리**

```bash
git branch -d plan-11-5-background-sync
```

---

## Risks / Mitigations

| Risk | Mitigation |
|------|------------|
| 시장가 주문 가격 차이 (offline 시점 vs sync 시점) | OrderForm 토스트에 "그때 가격으로 체결" 명시. 사용자에게 투명. |
| 환전 환율 차이 (동일) | FxExchangeForm 토스트에 "그때 환율 적용" 명시. |
| iOS Safari 미지원 | Plan #11에서도 동일 — graceful degradation. fetch 실패 시 그냥 toast.error. |
| 60분 후 큐 자동 폐기 — 사용자가 모를 수 있음 | 시간 길지 않은 mutation 가정. UI에 큐 상태 표시는 별도 plan. |
| Cookie/session expiration 중에 sync 재전송 | 서버가 401 응답 → SW가 큐에서 폐기 (재시도 안 함). BackgroundSyncPlugin은 Request object 전체를 IDB에 직렬화하므로 cookies(`credentials: "same-origin"` default)가 replay 시 자동 포함됨. 사용자는 401 받으면 다시 로그인하면 OK. |
| optimistic UI(watchlist toggle) 후 sync 시점에 실패 | 60분 안에 다시 토글 가능. 영구적 손상 없음. |
| 매처 순서 5a→5b→5c→5d 잘못되면 nested matcher 무력화 | 매처 코드에 주석 + Task 3 Step 4 빌드 검증으로 회귀 방지. |
| client side에서 `navigator.onLine` 신뢰성 — Chrome도 false negative 가능 | 헬퍼는 fetch가 throw할 때만 onLine을 체크. `online === true`인데 fetch가 throw하면 "error"로 분류 — 적절. |

---

## Completion Criteria

- ✅ `npm run build` 성공, sw.js에 BackgroundSync 코드 포함
- ✅ 4개 폼 컴포넌트 helper 적용 + 기존 E2E 회귀 없음
- ✅ `/offline` page + watchlist + trading E2E PASS
- ✅ background-sync E2E 2개 모두 SKIP(dev) — prod harness에서만 실행
- ✅ master 머지 + Vercel 배포
- ✅ 프로덕션 수동 검증 — IndexedDB 큐에 1 entry → 큐 비워짐
