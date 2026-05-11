import { test, expect, type Page } from "@playwright/test";

async function signupAndGoToTrade(page: Page, symbol: string) {
  const email = `wl-${Date.now()}@test.com`;
  await page.goto("/auth/login");
  await page.getByRole("button", { name: /가입하기/i }).click();
  await page.getByLabel("이메일").fill(email);
  await page.getByLabel("비밀번호").fill("TestPass123!");
  await page.getByRole("button", { name: /^가입$/i }).click();
  await expect(page).toHaveURL(/\/app\/dashboard/, { timeout: 15_000 });
  await page.goto(`/app/trade/${encodeURIComponent(symbol)}`);
}

test.describe("Watchlist", () => {
  test("AAPL 추가 → /app/watchlist에 보임 → 해제 → 비어있음", async ({ page }) => {
    await signupAndGoToTrade(page, "AAPL");

    // ☆ 관심종목 추가
    await page.getByRole("button", { name: /관심종목 추가/ }).click();
    await expect(page.getByRole("button", { name: /관심종목 해제/ })).toBeVisible();

    // /app/watchlist에서 보이는지
    await page.goto("/app/watchlist");
    await expect(page.getByText("Apple")).toBeVisible();

    // 다시 상세로 가서 해제
    await page.goto("/app/trade/AAPL");
    await page.getByRole("button", { name: /관심종목 해제/ }).click();
    await expect(page.getByRole("button", { name: /관심종목 추가/ })).toBeVisible();

    // /app/watchlist에서 사라짐
    await page.goto("/app/watchlist");
    await expect(page.getByText(/관심 종목이 없어요/)).toBeVisible();
  });
});
