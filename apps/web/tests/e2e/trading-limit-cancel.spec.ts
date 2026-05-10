import { test, expect, type Page } from "@playwright/test";

async function signupAndGoToTrade(page: Page, symbol: string) {
  const email = `lim-${Date.now()}@test.com`;
  await page.goto("/auth/login");
  await page.getByRole("button", { name: /가입하기/i }).click();
  await page.getByLabel("이메일").fill(email);
  await page.getByLabel("비밀번호").fill("TestPass123!");
  await page.getByRole("button", { name: /^가입$/i }).click();
  await expect(page).toHaveURL(/\/app\/dashboard/, { timeout: 15_000 });
  await page.goto(`/app/trade/${encodeURIComponent(symbol)}`);
}

test.describe("Trading — limit + cancel", () => {
  test("USD: 환전 → 지정가 매수 → 펜딩 → 취소", async ({ page }) => {
    // USD 잔고 0이라 매수 안 됨 → 환전 후 매수
    await signupAndGoToTrade(page, "AAPL");

    // 환전: KRW → USD 1,400,000 (대략 $1000)
    await page.goto("/app/fx");
    await page.getByLabel(/금액/).fill("1400000");
    await page.getByRole("button", { name: /^환전/ }).click();
    await expect(page.getByText(/완료/)).toBeVisible({ timeout: 5_000 });
    await page.waitForTimeout(2000);  // reload 후 잔고 반영 대기

    // 지정가 매수 — 의도적으로 낮은 가격으로 미체결 펜딩 만들기
    await page.goto("/app/trade/AAPL");
    await page.getByRole("button", { name: "지정가" }).first().click();
    await page.getByLabel("수량").fill("1");
    await page.getByLabel(/지정가/).fill("50");  // 도달 X
    await page.getByRole("button", { name: /^매수.*지정가/ }).click();

    await expect(page.getByText(/주문 접수됨/)).toBeVisible({ timeout: 10_000 });

    // 주문 페이지에서 펜딩 + 취소 버튼
    await page.goto("/app/portfolio/orders");
    await expect(page.getByText("AAPL")).toBeVisible();
    await expect(page.getByText("pending")).toBeVisible();

    page.on("dialog", (d) => d.accept());
    await page.getByRole("button", { name: "취소" }).first().click();
    await page.waitForLoadState("networkidle");
    await expect(page.getByText("cancelled")).toBeVisible({ timeout: 5_000 });
  });
});
