import { test, expect, type Page } from "@playwright/test";

function isNxtSession(): boolean {
  const now = new Date();
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  const day = kst.getUTCDay();
  if (day === 0 || day === 6) return false;
  const minutes = kst.getUTCHours() * 60 + kst.getUTCMinutes();
  if (minutes >= 480 && minutes < 530) return true; // pre 08:00-08:50
  if (minutes >= 930 && minutes < 1200) return true; // after 15:30-20:00
  return false;
}

function isKrxRegular(): boolean {
  const now = new Date();
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  const day = kst.getUTCDay();
  if (day === 0 || day === 6) return false;
  const minutes = kst.getUTCHours() * 60 + kst.getUTCMinutes();
  return minutes >= 540 && minutes < 920; // 09:00-15:20
}

async function signupAndGoToTrade(page: Page, symbol: string) {
  const email = `mid-${Date.now()}@test.com`;
  await page.goto("/auth/login");
  await page.getByRole("button", { name: /가입하기/i }).click();
  await page.getByLabel("이메일").fill(email);
  await page.getByLabel("비밀번호").fill("TestPass123!");
  await page.getByRole("button", { name: /^가입$/i }).click();
  await expect(page).toHaveURL(/\/app\/dashboard/, { timeout: 15_000 });
  await page.goto(`/app/trade/${encodeURIComponent(symbol)}`);
}

test.describe("Midpoint order (Plan #12)", () => {
  test("NXT pre/after 시간에 미드포인트 매수 → 체결", async ({ page }) => {
    test.skip(!isNxtSession(), "NXT pre/after 시간 외 — 미드포인트 비활성");

    await signupAndGoToTrade(page, "005930.KS");
    await expect(page.getByRole("heading", { name: /삼성전자/ })).toBeVisible();

    // 매수 sheet 열기
    await page.getByRole("button", { name: "매수" }).first().click();
    // 미드포인트 타입 선택
    await page.getByRole("button", { name: "미드포인트" }).click();
    await page.getByLabel("수량").fill("1");
    // 제출 — "(미드포인트)" 가 붙은 매수 버튼
    await page.getByRole("button", { name: /^매수.*미드포인트/ }).click();

    await expect(page.getByText(/체결됨/)).toBeVisible({ timeout: 10_000 });

    // 보유 확인
    await page.goto("/app/portfolio/holdings");
    await expect(page.getByText(/삼성전자/)).toBeVisible();
  });

  test("KRX 정규장에는 미드포인트 버튼 비활성", async ({ page }) => {
    test.skip(!isKrxRegular(), "정규장 시간 아님 — 본 테스트는 09:00–15:20 KST에서만");

    await signupAndGoToTrade(page, "005930.KS");
    await page.getByRole("button", { name: "매수" }).first().click();
    await expect(page.getByRole("button", { name: "미드포인트" })).toBeDisabled();
  });

  test("KR 종목 NXT 시간에 NxtSpreadBadge 표시", async ({ page }) => {
    test.skip(!isNxtSession(), "NXT pre/after 시간 외 — 배지 표시 없음");

    await signupAndGoToTrade(page, "005930.KS");
    await expect(page.getByText(/NXT.*Bid.*Ask.*spread.*bps/)).toBeVisible({
      timeout: 5_000,
    });
  });
});
