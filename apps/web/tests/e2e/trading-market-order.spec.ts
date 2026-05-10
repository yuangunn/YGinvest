import { test, expect, type Page } from "@playwright/test";

async function signupAndGoToTrade(page: Page, symbol: string) {
  const email = `trade-${Date.now()}@test.com`;
  await page.goto("/auth/login");
  await page.getByRole("button", { name: /가입하기/i }).click();
  await page.getByLabel("이메일").fill(email);
  await page.getByLabel("비밀번호").fill("TestPass123!");
  await page.getByRole("button", { name: /^가입$/i }).click();
  await expect(page).toHaveURL(/\/app\/dashboard/, { timeout: 15_000 });
  await page.goto(`/app/trade/${encodeURIComponent(symbol)}`);
}

test.describe("Trading — market order", () => {
  test("KR 종목 시장가 매수 → 보유 + 잔고 갱신", async ({ page }) => {
    // KR 장: 평일 09:00–15:30 KST = UTC 00:00–06:30
    const now = new Date();
    const day = now.getUTCDay();
    const hour = now.getUTCHours();
    const minute = now.getUTCMinutes();
    const totalMin = hour * 60 + minute;
    const isKrOpen = day >= 1 && day <= 5 && totalMin >= 0 && totalMin <= 6 * 60 + 30;
    test.skip(!isKrOpen, "KR 장 마감 시간이라 스킵");

    await signupAndGoToTrade(page, "005930.KS");
    await expect(page.getByRole("heading", { name: /삼성전자/ })).toBeVisible();

    // 시장가 매수 1주
    await page.getByRole("button", { name: "시장가" }).first().click();
    await page.getByLabel("수량").fill("1");
    await page.getByRole("button", { name: /^매수.*시장가/ }).click();

    await expect(page.getByText(/체결됨/)).toBeVisible({ timeout: 10_000 });

    // 보유 페이지 가서 1주 표시
    await page.goto("/app/portfolio/holdings");
    await expect(page.getByText(/삼성전자/)).toBeVisible();
    await expect(page.getByText(/1주/)).toBeVisible();
  });

  test("매수 후 매도 — 잔고 복구", async ({ page }) => {
    const now = new Date();
    const day = now.getUTCDay();
    const hour = now.getUTCHours();
    const minute = now.getUTCMinutes();
    const totalMin = hour * 60 + minute;
    const isKrOpen = day >= 1 && day <= 5 && totalMin >= 0 && totalMin <= 6 * 60 + 30;
    test.skip(!isKrOpen, "KR 장 마감 시간이라 스킵");

    await signupAndGoToTrade(page, "005930.KS");
    await page.getByLabel("수량").fill("1");
    await page.getByRole("button", { name: /^매수.*시장가/ }).click();
    await expect(page.getByText(/체결됨/)).toBeVisible({ timeout: 10_000 });

    // 매도
    await page.getByRole("button", { name: "매도" }).first().click();
    await page.getByLabel("수량").fill("1");
    await page.getByRole("button", { name: /^매도.*시장가/ }).click();
    await expect(page.getByText(/체결됨/)).toBeVisible({ timeout: 10_000 });

    await page.goto("/app/portfolio/holdings");
    await expect(page.getByText(/보유 없음/)).toBeVisible();
  });
});
