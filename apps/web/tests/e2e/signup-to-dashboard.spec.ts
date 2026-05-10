import { test, expect } from "@playwright/test";

test.describe("Auth flow", () => {
  test("signup → auto-redirect to dashboard with portfolio", async ({ page }) => {
    const email = `e2e-${Date.now()}@test.com`;
    const password = "TestPass123!";

    await page.goto("/auth/login");
    await page.getByRole("button", { name: /가입하기/i }).click();
    await page.getByLabel("이메일").fill(email);
    await page.getByLabel("비밀번호").fill(password);
    await page.getByRole("button", { name: /^가입$/i }).click();

    await expect(page).toHaveURL(/\/app\/dashboard/, { timeout: 15_000 });
    await expect(page.getByText(/KRW 잔고/i)).toBeVisible();
    await expect(page.getByText(/₩100,000,000/).first()).toBeVisible();
    await expect(page.getByText(/USD 잔고/i)).toBeVisible();
    await expect(page.getByText(/\$0\.00/).first()).toBeVisible();
  });

  test("logged out user redirected from /app/* to /auth/login", async ({ page }) => {
    await page.goto("/app/dashboard");
    await expect(page).toHaveURL(/\/auth\/login/);
  });
});
