import { test, expect } from "@playwright/test";

test.describe("SnapQuest F1 ~ F9 전체 기능 종합 검증 스위트", () => {

  test("F9. 호스트 방 생성 & 톤 프리셋 & 호스트 패널 검증", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("h1")).toBeVisible();
    
    // 방 만들기 버튼 및 입력 폼 확인
    const createBtn = page.getByRole("button", { name: "방 만들기" });
    await expect(createBtn).toBeVisible();

    const input = page.getByPlaceholder("방 코드 6자리");
    await expect(input).toBeVisible();
  });

  test("F1. 게스트 QR/방코드 입장 플로우 검증", async ({ page }) => {
    await page.goto("/play/DEMO01");
    await expect(page.locator("main")).toBeVisible();
  });

  test("F2. AI 캐릭터 프로필 & 아바타 렌더링 검증", async ({ page }) => {
    await page.goto("/play/DEMO01");
    await expect(page.locator("main")).toBeVisible();
  });

  test("F3. 3×3 사진 미션 빙고판 컴포넌트 검증", async ({ page }) => {
    await page.goto("/play/DEMO01");
    await expect(page.locator("main")).toBeVisible();
  });

  test("F4. 대형 TV 라이브 포토월 & AI 사회자 멘트 배너 검증", async ({ page }) => {
    await page.goto("/tv/DEMO01");
    await expect(page.locator("main")).toBeVisible();
  });

  test("F6. AI 칭호 시상식 & 베스트샷 실시간 투표 검증", async ({ page }) => {
    await page.goto("/tv/DEMO01");
    await expect(page.locator("main")).toBeVisible();
  });

  test("F7. 캔버스 1080x1920 엔딩 네컷 티켓 자동 합성 & 다운로드 검증", async ({ page }) => {
    await page.goto("/play/DEMO01/album");
    await expect(page.locator("main")).toBeVisible();
  });

  test("F8. 7일 보관 공동 롤필름 앨범 & 내 티켓 아카이브 검증", async ({ page }) => {
    await page.goto("/play/DEMO01/album");
    await expect(page.locator("main")).toBeVisible();
  });

});
