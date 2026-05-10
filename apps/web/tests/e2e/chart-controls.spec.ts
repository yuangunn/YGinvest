import { test, expect, type Page } from "@playwright/test";

async function signupAndGoToTrade(page: Page, symbol: string) {
  const email = `cc-${Date.now()}@test.com`;
  await page.goto("/auth/login");
  await page.getByRole("button", { name: /가입하기/i }).click();
  await page.getByLabel("이메일").fill(email);
  await page.getByLabel("비밀번호").fill("TestPass123!");
  await page.getByRole("button", { name: /^가입$/i }).click();
  await expect(page).toHaveURL(/\/app\/dashboard/, { timeout: 15_000 });
  await page.goto(`/app/trade/${encodeURIComponent(symbol)}`);
}

test.describe("Chart controls", () => {
  test("AAPL 차트: interval 토글 + RSI 지표", async ({ page }) => {
    await signupAndGoToTrade(page, "AAPL");

    // 일봉이 기본 — 버튼 보이는지
    await expect(page.getByRole("button", { name: "일봉" })).toBeVisible();
    await expect(page.getByRole("button", { name: "1시간" })).toBeVisible();
    await expect(page.getByRole("button", { name: "15분" })).toBeVisible();

    // 1시간 클릭 → 차트 데이터 fetch (워커 RPC 또는 데이터 없음)
    await page.getByRole("button", { name: "1시간" }).click();
    await page.waitForTimeout(2_000);

    // 일봉으로 돌아가서 RSI 확인 (initialBars 기반이라 안정적)
    await page.getByRole("button", { name: "일봉" }).click();
    await page.getByRole("button", { name: "RSI" }).click();
    await expect(page.getByText(/RSI\(14\)/)).toBeVisible({ timeout: 5_000 });
  });
});
