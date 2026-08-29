import { defineConfig, devices } from "@playwright/test";

/** 배포된 프리뷰를 겨눌 때는 E2E_BASE_URL 을 주고, 없으면 로컬 dev 를 띄운다. */
const baseURL = process.env.E2E_BASE_URL ?? "http://localhost:3000";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: [["list"], ["html", { open: "never" }]],
  // 사진 업로드는 Gemini 판정을 응답 전에 끝내고 온다 — 기본 30초로는 모자란다.
  timeout: 60_000,
  expect: { timeout: 10_000 },

  use: {
    baseURL,
    trace: "on-first-retry",
  },

  // 주 사용자가 폰이고, 그중 iOS 가 제일 까다롭다(WebKit: 파일 입력·localStorage·실시간).
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile-safari", use: { ...devices["iPhone 14"] } },
  ],

  // E2E_BASE_URL 이 있으면 그 서버를 그대로 쓴다(직접 띄우지 않는다).
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: "npm run dev",
        url: baseURL,
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
      },
});
