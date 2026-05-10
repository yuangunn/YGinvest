import { test, expect, type Page } from "@playwright/test";

async function signupAndGoToSearch(page: Page) {
  const email = `search-${Date.now()}@test.com`;
  await page.goto("/auth/login");
  await page.getByRole("button", { name: /가입하기/i }).click();
  await page.getByLabel("이메일").fill(email);
  await page.getByLabel("비밀번호").fill("TestPass123!");
  await page.getByRole("button", { name: /^가입$/i }).click();
  await expect(page).toHaveURL(/\/app\/dashboard/, { timeout: 15_000 });
  await page.goto("/app/trade/search");
  await expect(page.getByRole("heading", { name: "종목 검색" })).toBeVisible();
}

test.describe("Stock search flow", () => {
  test("search by Korean name returns Samsung", async ({ page }) => {
    await signupAndGoToSearch(page);

    await page.getByPlaceholder(/종목명 또는 심볼/i).fill("삼성전자");

    // 결과 카드에 "삼성전자" 표시 (카드 안의 이름)
    await expect(page.getByText("삼성전자").first()).toBeVisible({ timeout: 10_000 });

    // 클릭하여 상세 페이지 이동
    await page.getByText("삼성전자").first().click();
    await expect(page).toHaveURL(/\/app\/trade\/005930\.KS/);
    await expect(page.getByRole("heading", { name: "삼성전자" })).toBeVisible();
    await expect(page.getByText("현재가")).toBeVisible();
  });

  test("search by US ticker returns AAPL", async ({ page }) => {
    await signupAndGoToSearch(page);

    await page.getByPlaceholder(/종목명 또는 심볼/i).fill("AAPL");
    await expect(page.getByText("AAPL").first()).toBeVisible({ timeout: 10_000 });
  });

  test("unknown symbol shows ad-hoc lookup option", async ({ page }) => {
    await signupAndGoToSearch(page);

    await page.getByPlaceholder(/종목명 또는 심볼/i).fill("ZZZNOTREAL");
    await expect(page.getByText(/로컬 캐시에 없는 종목/)).toBeVisible({ timeout: 5_000 });
  });
});
