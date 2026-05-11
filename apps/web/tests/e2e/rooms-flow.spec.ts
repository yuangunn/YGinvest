import { test, expect, type Page, type BrowserContext } from "@playwright/test";

async function signup(
  context: BrowserContext,
  prefix: string,
): Promise<{ page: Page; email: string }> {
  const page = await context.newPage();
  const email = `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}@test.com`;
  await page.goto("/auth/login");
  await page.getByRole("button", { name: /가입하기/i }).click();
  await page.getByLabel("이메일").fill(email);
  await page.getByLabel("비밀번호").fill("TestPass123!");
  await page.getByRole("button", { name: /^가입$/i }).click();
  await expect(page).toHaveURL(/\/app\/dashboard/, { timeout: 15_000 });
  return { page, email };
}

test.describe("Rooms — 2-account flow", () => {
  test("호스트 방 생성 → 멤버 가입 → 양쪽에서 멤버 2/10 보임", async ({ browser }) => {
    const hostCtx = await browser.newContext();
    const memberCtx = await browser.newContext();
    const { page: hostPage } = await signup(hostCtx, "host");
    const { page: memberPage } = await signup(memberCtx, "mem");

    // 호스트: 방 생성
    await hostPage.goto("/app/rooms/new");
    await hostPage.getByLabel("방 이름").fill("E2E Test Room");
    await hostPage.getByRole("button", { name: "방 만들기" }).click();
    // 방 상세로 리다이렉트 (uuid format)
    await expect(hostPage).toHaveURL(/\/app\/rooms\/[0-9a-f-]{36}/, {
      timeout: 10_000,
    });
    await expect(
      hostPage.getByRole("heading", { name: "E2E Test Room" }),
    ).toBeVisible();

    // 호스트: invite_code 추출 (InviteCodeDisplay의 <code>)
    const inviteCodeText = await hostPage.locator("code").first().textContent();
    expect(inviteCodeText).toMatch(/^[A-Z0-9]{6}$/);
    const inviteCode = inviteCodeText!.trim();

    // 호스트도 자기 방에 가입 (v1: explicit — 호스트는 자동 멤버 아님)
    await hostPage.goto("/app/rooms/join");
    await hostPage.getByLabel(/초대 코드/).fill(inviteCode);
    await hostPage.getByRole("button", { name: "가입" }).click();
    await expect(hostPage).toHaveURL(/\/app\/rooms\/[0-9a-f-]{36}/);

    // 멤버: 가입
    await memberPage.goto("/app/rooms/join");
    await memberPage.getByLabel(/초대 코드/).fill(inviteCode);
    await memberPage.getByRole("button", { name: "가입" }).click();
    await expect(memberPage).toHaveURL(/\/app\/rooms\/[0-9a-f-]{36}/, {
      timeout: 10_000,
    });
    await expect(memberPage.getByText("E2E Test Room")).toBeVisible();

    // 양쪽에서 멤버 2 명 보임
    await hostPage.reload();
    await expect(hostPage.getByText(/멤버 2\/10/)).toBeVisible();
    await memberPage.reload();
    await expect(memberPage.getByText(/멤버 2\/10/)).toBeVisible();
  });
});
