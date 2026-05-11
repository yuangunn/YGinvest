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
  test("SW 등록 + 오프라인 시 /offline fallback (prod-only)", async ({
    page,
    context,
  }) => {
    test.skip(
      !PROD,
      "Serwist disabled in dev — run with PW_PROD=1 against prod build",
    );

    await signupAndGoToDashboard(page);

    // SW 활성화 대기 (Workbox precache 후 claim)
    await page.waitForFunction(
      async () => {
        const reg = await navigator.serviceWorker.getRegistration();
        return reg?.active?.state === "activated";
      },
      { timeout: 10_000 },
    );

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
    await page.goto("/app/portfolio/overview", {
      waitUntil: "domcontentloaded",
    });
    await expect(page.getByText(/오프라인 상태예요/)).toBeVisible({
      timeout: 10_000,
    });

    await context.setOffline(false);
  });

  test("/offline 페이지 직접 접근 가능 (always)", async ({ page }) => {
    await page.goto("/offline");
    await expect(page.getByText(/오프라인 상태예요/)).toBeVisible();
    await expect(
      page.getByRole("link", { name: /대시보드로 가기/ }),
    ).toBeVisible();
  });
});
