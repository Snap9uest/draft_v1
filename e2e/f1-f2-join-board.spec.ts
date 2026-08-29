/**
 * F1 QR 입장·AI 캐릭터 / F2 개인화 빙고판.
 *
 * 이 파일이 지키는 수용 기준
 *  - F1-1 설치·로그인 없이 입장 폼까지 도달
 *  - F1-2 제출 즉시 빙고판 — 캐릭터 생성을 기다리는 차단 화면 없음(시간으로 잰다)
 *  - F1-3 프리셋 아바타가 먼저 붙는다
 *  - F1 예외 재접속 → 로컬 토큰으로 세션 복원(닉네임 재입력 없음)
 *  - F2-1 참가자마다 다른 3×3 판
 *  - F2-2 도촬류 미션 0건
 */

import type { Browser, Page } from "@playwright/test";
import { test, expect } from "./fixtures";
import { joinRoom } from "./helpers";

/** 입장 제출 → 빙고판 노출 상한. AI 아바타·판 생성(수 초)을 기다리면 반드시 넘긴다. */
const NON_BLOCKING_MS = 5_000;

/**
 * 도촬·무단촬영 금칙어. 폴백 풀의 "뒤태/뒷모습"은 본인이 취하는 포즈라 금칙이 아니다 —
 * 문제는 상대가 모르는 상태에서 찍게 만드는 문구다.
 */
const BANNED = [
  "몰래",
  "도촬",
  "훔쳐",
  "숨어서",
  "들키지",
  "모르게",
  "허락 없이",
  "무단",
  "잠든",
  "취한",
  "화장실",
  "갈아입",
];

/** 빙고 칸의 aria-label(`3번 미션: …`)에서 미션 문구만 뽑는다. */
async function missions(page: Page): Promise<string[]> {
  const cells = page.getByRole("button", { name: /^[1-9]번 미션:/ });
  await expect(cells).toHaveCount(9);
  const labels = await cells.evaluateAll((els) =>
    els.map((el) => el.getAttribute("aria-label") ?? ""),
  );
  return labels.map((l) => l.replace(/^[1-9]번 미션: /, "").replace(/ \(완료\)$/, ""));
}

/** 새 브라우저 컨텍스트로 폼을 채워 실제 입장시킨다(세션이 서로 섞이지 않는다). */
async function joinViaUi(
  browser: Browser,
  code: string,
  nickname: string,
  intro: string,
): Promise<Page> {
  const page = await (await browser.newContext()).newPage();
  await page.goto(`/play/${code}`);
  await page.getByLabel("닉네임").fill(nickname);
  await page.getByLabel(/자기소개/).fill(intro);
  await page.getByRole("button", { name: "입장하기" }).click();
  return page;
}

test("세션 없이 열면 로그인 없이 입장 폼이 뜬다", async ({ page, room }) => {
  const res = await page.goto(`/play/${room.code}`);
  expect(res?.status()).toBe(200);

  await expect(page.getByLabel("닉네임")).toBeVisible();
  await expect(page.getByRole("button", { name: "입장하기" })).toBeVisible();
  // 로그인 벽으로 튕기지 않는다.
  expect(page.url()).toContain(`/play/${room.code}`);
  // 아직 판은 없다.
  await expect(page.getByRole("button", { name: /^[1-9]번 미션:/ })).toHaveCount(0);
});

test("입장 제출은 캐릭터 생성을 기다리지 않고, 새로고침해도 세션이 남는다", async ({
  page,
  request,
  room,
}) => {
  // dev 서버의 join 라우트 최초 컴파일 시간이 측정에 섞이지 않게 미리 한 번 태운다.
  // 겸사겸사 빙고판 크로스 재료가 되는 선입장자이기도 하다.
  await joinRoom(request, room.code, { nickname: "먼저온사람" });

  await page.goto(`/play/${room.code}`);
  await page.getByLabel("닉네임").fill("소미");
  await page.getByLabel(/자기소개/).fill("사진 찍는 거 좋아함\n맥주보다 하이볼");

  const cells = page.getByRole("button", { name: /^[1-9]번 미션:/ });
  const started = Date.now();
  await page.getByRole("button", { name: "입장하기" }).click();
  await expect(cells.first()).toBeVisible();
  const elapsed = Date.now() - started;

  // F1-2: AI 아바타·AI 판 생성은 after() 로 뒤에서 돈다. 이걸 기다렸다면 여기서 터진다.
  expect(elapsed, `입장 제출 → 빙고판 노출 ${elapsed}ms`).toBeLessThan(NON_BLOCKING_MS);
  // F2: 3×3.
  await expect(cells).toHaveCount(9);
  // F1-3: 생성 전에도 프리셋 아바타가 이미 붙어 있다.
  await expect(page.getByRole("img", { name: "소미의 캐릭터" })).toBeVisible();

  // F1 재접속: 로컬 토큰으로 복원 — 폼으로 되돌아가지 않는다.
  await page.reload();
  await expect(cells).toHaveCount(9);
  await expect(page.getByRole("button", { name: "입장하기" })).toHaveCount(0);
  await expect(page.getByLabel("닉네임")).toHaveCount(0);
});

test("참가자 둘은 서로 다른 9칸을 받는다", async ({ browser, room }) => {
  test.slow(); // 실제 입장 2회 + AI 백그라운드.

  const a = await joinViaUi(browser, room.code, "가온", "보드게임 좋아함\n술은 못 마심");
  const b = await joinViaUi(browser, room.code, "나린", "사진 찍는 게 취미\n첫 참석");

  const [ma, mb] = [await missions(a), await missions(b)];
  // AI 가 죽어 폴백 풀로 떨어져도 셔플이 달라 판은 갈려야 한다. 전원 동일 판이면 F2-1 위반.
  expect(ma, `가온: ${ma.join(" / ")}\n나린: ${mb.join(" / ")}`).not.toEqual(mb);

  await a.context().close();
  await b.context().close();
});

test("미션 문구에 도촬류 표현이 없다", async ({ page, request, room, guest }) => {
  await page.goto(`/play/${room.code}`);

  // 화면에 실제로 깔린 판 + AI 생성기가 방금 뱉은 판, 둘 다 본다.
  const res = await request.post("/api/ai/bingo-board", {
    data: {
      participant: { nickname: guest.participant.nickname, intro: guest.participant.intro },
      others: [{ nickname: "먼저온사람", intro: "사진 찍는 거 좋아함" }],
      tonePreset: "친목",
    },
  });
  expect(res.status()).toBe(200);
  const generated = (await res.json()) as { missions: string[]; isFallback: boolean };
  expect(generated.missions).toHaveLength(9);

  for (const [source, list] of [
    ["렌더된 판", await missions(page)],
    [`AI 생성(isFallback=${generated.isFallback})`, generated.missions],
  ] as const) {
    const hits = list.flatMap((m) =>
      BANNED.filter((w) => m.includes(w)).map((w) => `"${m}" ← 금칙어 "${w}"`),
    );
    expect(hits, `${source} 미션에 도촬류 표현`).toEqual([]);
  }
});
