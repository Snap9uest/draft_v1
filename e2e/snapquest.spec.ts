import { test, expect } from "@playwright/test";

test.describe("SnapQuest Full E2E Journey", () => {

  test("1. 메인 랜딩 화면 렌더링 검증", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("h1")).toBeVisible();
    await expect(page.getByText("SnapQuest").first()).toBeVisible();
  });

  test("2. [F9] 메인 화면의 방 만들기 및 입장 입력 폼 검증", async ({ page }) => {
    await page.goto("/");
    const createBtn = page.getByRole("button", { name: "방 만들기" });
    await expect(createBtn).toBeVisible();

    const input = page.getByPlaceholder("방 코드 6자리");
    await expect(input).toBeVisible();
    await input.fill("TEST01");
  });

  test("3. [F9/F4] TV 대형 스크린 & 라이브 포토월 검증", async ({ page }) => {
    await page.goto("/tv/DEMO01");
    await expect(page.getByText("SNAPQUEST").first()).toBeVisible();
    await expect(page.getByText("DEMO01").first()).toBeVisible();
  });

  test("4. [F4] 실시간 TV 포토월 화면 검증", async ({ page }) => {
    await page.goto("/test-photowall");
    await expect(page.getByText("SNAPQUEST").first()).toBeVisible();
  });

  test("5. [F7] 엔딩 네컷 티켓 캔버스 합성 스튜디오 검증", async ({ page }) => {
    await page.goto("/test-ticket");
    await expect(page.getByText("나만의 네컷 전리품 커스텀")).toBeVisible();

    const ticketImage = page.locator('img[alt="Composed Ticket"]');
    await expect(ticketImage).toBeVisible();

    const src = await ticketImage.getAttribute("src");
    expect(src).toContain("data:image/png;base64");

    const downloadBtn = page.getByRole("button", { name: /티켓 이미지 저장/ });
    await expect(downloadBtn).toBeEnabled();
  });

});
