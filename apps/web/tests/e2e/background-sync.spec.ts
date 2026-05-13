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
        // Workbox/Serwist의 IDB 이름 패턴
        const candidates = [
          "serwist-background-sync",
          "workbox-background-sync",
        ];
        let pending = candidates.length;
        let found = -1;
        for (const dbName of candidates) {
          const req = indexedDB.open(dbName);
          req.onsuccess = () => {
            const db = req.result;
            const stores = Array.from(db.objectStoreNames);
            if (stores.length === 0) {
              db.close();
              if (--pending === 0) resolve(found);
              return;
            }
            const storeName =
              stores.find((n) => n.toLowerCase().includes("requests")) ??
              stores[0];
            const tx = db.transaction(storeName, "readonly");
            const store = tx.objectStore(storeName);
            const countReq = store.count();
            countReq.onsuccess = () => {
              if (countReq.result > 0) found = countReq.result;
              db.close();
              if (--pending === 0) resolve(found);
            };
            countReq.onerror = () => {
              db.close();
              if (--pending === 0) resolve(found);
            };
          };
          req.onerror = () => {
            if (--pending === 0) resolve(found);
          };
        }
      });
    });
    expect(queueLength).toBeGreaterThan(0);

    await context.setOffline(false);
  });
});
