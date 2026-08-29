/**
 * F9 호스트 진행 도구 + 랜딩.
 * 기준: docs/SnapQuest_기능명세서_v2.md [F9] 수용 기준 1·3·5 와 "전 기능 호스트 토큰 보유자만".
 *
 * 화면 문구가 자주 바뀌는 중이라 이름 셀렉터는 정규식으로 느슨하게 잡는다.
 * (문구가 바뀌어도 통과하되, 버튼·권한·상태가 깨지면 반드시 실패한다.)
 */

import { test, expect } from "./fixtures";
import { admin, seedHostToken, seedSession } from "./helpers";

/** 방 코드 문자셋(혼동 문자 O/0/I/1 제외) — src/lib/db/server.ts 와 같다. */
const CODE_RE = /^[A-HJ-NP-Z2-9]{6}$/;

/** 리워드가 켜졌을 때만 나올 법한 낱말들. 꺼진 방에서는 한 번도 나오면 안 된다. */
const REWARD_WORDS = /리워드|교환권|경품|상품권/;

/** 랜딩에서 UI 로 만든 방은 픽스처가 모르므로 여기서 지운다. */
const uiRooms: string[] = [];
test.afterAll(async () => {
  if (uiRooms.length) await admin().from("rooms").delete().in("code", uiRooms);
  uiRooms.length = 0;
});

test("[수용1] 랜딩 '방 만들기' → 호스트 화면+방 코드까지 클릭 3회 이내", async ({ page }) => {
  await page.goto("/");

  let clicks = 0;
  const click = async (name: RegExp) => {
    clicks += 1;
    await page.getByRole("button", { name }).click();
  };

  await click(/방 만들기/);
  await page.waitForURL(/\/host\/[A-Z0-9]{6}$/, { timeout: 30_000 });

  const code = page.url().split("/").pop()!.toUpperCase();
  uiRooms.push(code);
  expect(code).toMatch(CODE_RE);

  // 방 코드가 6자 한 덩어리로 노출되고, 입장 QR 도 같이 떠야 "도달"이다.
  await expect(page.getByText(code, { exact: true })).toBeVisible();
  await expect(page.getByRole("img", { name: new RegExp(`${code}.*QR`) })).toBeVisible();

  expect(clicks).toBeLessThanOrEqual(3);
});

test("[수용1] 호스트 화면의 QR·입장 링크가 이 방의 /play/[code] 를 가리킨다", async ({
  page,
  room,
  baseURL,
}) => {
  await seedHostToken(page, room.code, room.hostToken);
  await page.goto(`/host/${room.code}`);

  const qr = page.getByRole("img", { name: new RegExp(`${room.code}.*QR`) });
  await expect(qr).toBeVisible();
  await expect(qr).toHaveAttribute("src", /^data:image\/png;base64,/);

  // QR 과 같은 변수(joinUrl)로 그려지는 텍스트 링크를 검증한다.
  // ponytail: PNG 픽셀 디코딩은 안 한다 — 대신 그 URL 을 실제로 열어 이 방인지 확인한다.
  const joinUrl = `${baseURL}/play/${room.code}`;
  await expect(page.getByText(joinUrl, { exact: true })).toBeVisible();

  await page.goto(joinUrl);
  await expect(page.getByRole("button", { name: /입장하기/ })).toBeVisible();
  await expect(page.getByText(new RegExp(`방 ${room.code}`))).toBeVisible();
});

test("[수용3] 리워드 토글은 기본 꺼짐이고, 꺼진 동안 게스트 화면엔 리워드 문구가 없다", async ({
  page,
  context,
  room,
  guest,
}) => {
  await seedHostToken(page, room.code, room.hostToken);
  await page.goto(`/host/${room.code}`);

  const toggle = page.getByRole("checkbox", { name: /리워드/ });
  await expect(toggle).toBeEnabled(); // 호스트 토큰이 있으니 조작은 열려 있고
  await expect(toggle).not.toBeChecked(); // 기본값은 꺼짐이다

  const { data } = await admin()
    .from("rooms")
    .select("reward_on")
    .eq("id", room.id)
    .single();
  expect(data?.reward_on).toBe(false);

  const g = await context.newPage();
  await seedSession(g, guest.sessionToken);
  await g.goto(`/play/${room.code}`);
  await expect(g.getByTestId("cell-0")).toBeVisible();
  await expect(g.getByText(REWARD_WORDS)).toHaveCount(0);

  await g.getByTestId("go-album").click();
  await expect(g.getByTestId("album-all")).toBeVisible();
  await expect(g.getByText(REWARD_WORDS)).toHaveCount(0);
});

test("호스트 토큰 없는 브라우저에서는 진행 조작이 잠긴다", async ({ page, room }) => {
  await page.goto(`/host/${room.code}`);

  // 권한 안내 = 토큰(진행 코드) 붙여넣기 폼
  await expect(page.getByLabel(/진행 코드|호스트 토큰/)).toBeVisible();

  for (const name of [/파티 시작/, /봇/, /칭호/, /파티 (끝내기|종료)/]) {
    await expect(page.getByRole("button", { name })).toBeDisabled();
  }
  await expect(page.getByRole("checkbox", { name: /리워드/ })).toBeDisabled();
});

test("hostToken 없이 호스트 API 를 직접 부르면 403 이고 방은 그대로다", async ({
  request,
  room,
}) => {
  const noToken = await request.patch(`/api/room/${room.code}`, {
    data: { status: "ended", rewardOn: true },
  });
  expect(noToken.status()).toBe(403);

  const wrongToken = await request.patch(`/api/room/${room.code}`, {
    data: { hostToken: crypto.randomUUID(), rewardOn: true },
  });
  expect(wrongToken.status()).toBe(403);

  expect((await request.post(`/api/room/${room.code}/award`, { data: {} })).status()).toBe(403);
  expect((await request.post(`/api/room/${room.code}/end`, { data: {} })).status()).toBe(403);

  const { data } = await admin()
    .from("rooms")
    .select("status, reward_on, ended_at")
    .eq("id", room.id)
    .single();
  expect(data).toMatchObject({ status: "lobby", reward_on: false, ended_at: null });
});

test("[수용5] 종료 처리 후 room.status 는 ended 이고 게스트에게 엔딩(앨범)이 열린다", async ({
  page,
  context,
  room,
  guest,
}) => {
  await seedHostToken(page, room.code, room.hostToken);
  await page.goto(`/host/${room.code}`);

  await page.getByRole("button", { name: /파티 (끝내기|종료)/ }).click();
  await page.getByRole("button", { name: /끝낼게요|종료하기/ }).click();

  await expect
    .poll(
      async () => {
        const { data } = await admin()
          .from("rooms")
          .select("status")
          .eq("id", room.id)
          .single();
        return data?.status;
      },
      { timeout: 15_000 },
    )
    .toBe("ended");

  const g = await context.newPage();
  await seedSession(g, guest.sessionToken);
  await g.goto(`/play/${room.code}`);

  // 종료되면 게스트에게 남는 화면은 빙고판이 아니라 엔딩 콘텐츠(앨범)다 — 탭 조작 없이.
  await expect(g.getByTestId("album-all")).toBeVisible();
  await expect(g.getByTestId("go-album")).toHaveAttribute("aria-current", "page");
});

/**
 * F9 수용 기준 5의 나머지 절반: "종료 처리 시 단체 프레임 자동 합성(F7)이 실행된다".
 * 서버는 /api/room/[code]/end 에서 rooms.state.group_frame 을 만들지만,
 * 호스트 화면의 종료 버튼은 PATCH /api/room/[code] {status:"ended"} 만 부른다.
 */
test("[수용5] 호스트 종료 처리가 단체 프레임 구성까지 만든다", async ({ page, room }) => {
  await seedHostToken(page, room.code, room.hostToken);
  await page.goto(`/host/${room.code}`);

  await page.getByRole("button", { name: /파티 (끝내기|종료)/ }).click();
  await page.getByRole("button", { name: /끝낼게요|종료하기/ }).click();

  await expect
    .poll(
      async () => {
        const { data } = await admin()
          .from("rooms")
          .select("status, state")
          .eq("id", room.id)
          .single();
        return data?.status === "ended"
          ? ((data?.state as Record<string, unknown> | null)?.group_frame ?? null)
          : undefined;
      },
      { timeout: 15_000 },
    )
    .toBeTruthy();
});
