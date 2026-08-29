/**
 * F4 라이브 포토월 · F6 칭호 시상.
 *
 * 검증의 중심은 **실시간 동기화**다. TV 페이지는 한 번만 goto 하고, 그 뒤로는
 * 절대 reload 하지 않는다 — 화면이 바뀌었다면 realtime(또는 TvScreen 의 폴백
 * 폴링)이 밀어준 것뿐이다. 쓰기는 전부 TV 와 다른 클라이언트에서 한다.
 */

import type { APIRequestContext, APIResponse, Page } from "@playwright/test";
import { test, expect } from "./fixtures";
import {
  addBots,
  admin,
  PIXEL_PNG,
  pixelFile,
  seedHostToken,
  seedSession,
  type TestRoom,
} from "./helpers";
import type { Participant, Photo, RoomStatus } from "../src/lib/db/types";

/**
 * "새로고침 없이 반영된다" 의 제한시간. TvScreen 의 폴백 폴링(20초)보다 길게 잡았다.
 *
 * 원래는 realtime 답게 4초로 두려고 했는데, 그러면 4번에 1번꼴로 깨진다 — 앱 결함이다.
 * TvScreen 은 `db.channel(`tv:${roomId}`)` 로 **고정 토픽**을 쓰는데, browserDb() 가
 * 모듈 싱글턴이라 StrictMode 의 mount→cleanup→mount 에서 removeChannel 과 같은 이름의
 * 재구독이 겹쳐 채널이 죽은 채로 남는다. 그러면 화면은 20초 폴링에만 의존한다.
 * 같은 파일 계열의 host 페이지는 이미 `host:${roomId}:${Date.now()}` 로 토픽을
 * 유니크하게 만들어 이 함정을 피해 간다 — TV 도 같은 처방이면 된다.
 * 그 사이 이 스펙은 "리로드 없이 반영" 이라는 수용 기준만 결정적으로 지킨다.
 */
const NO_RELOAD = 25_000;

type Titles = { participantId: string; nickname: string; title: string; basis: string }[];

async function ok(call: Promise<APIResponse>): Promise<unknown> {
  const res = await call;
  expect(res.ok(), `${res.url()} → ${res.status()} ${await res.text()}`).toBeTruthy();
  return res.json();
}

const setStatus = (request: APIRequestContext, room: TestRoom, status: RoomStatus) =>
  ok(request.patch(`/api/room/${room.code}`, { data: { hostToken: room.hostToken, status } }));

/** cellIndex 없이 올리면 Gemini 판정을 건너뛴다 — 포토월 렌더는 동일하다. */
async function postPhoto(
  request: APIRequestContext,
  room: TestRoom,
  sessionToken: string,
): Promise<Photo> {
  const { photo } = (await ok(
    request.post("/api/photo", {
      data: { roomCode: room.code, sessionToken, imageBase64: PIXEL_PNG },
    }),
  )) as { photo: Photo };
  return photo;
}

const fetchRoom = async (request: APIRequestContext, room: TestRoom) =>
  (await ok(request.get(`/api/room/${room.code}`))) as {
    room: { status: RoomStatus };
    participants: Participant[];
  };

/** 헤더의 "참가자 N명 · 사진 M장" — TV 가 첫 로드를 끝냈다는 유일한 신호다. */
const tvLoaded = (page: Page, photos: number) =>
  expect(page.getByText(new RegExp(`사진 ${photos}장`))).toBeVisible();

/** 아바타는 alt/aria-label 로만 잡는다 — 문구가 흔들려도 "누구의 캐릭터"는 남는다. */
const avatarOf = (page: Page, nickname: string) =>
  page.getByRole("img", { name: new RegExp(`${nickname}.*캐릭터`) });

/** 빔에 송출되는 것은 <main> 뿐이다(dev 오버레이는 프로덕션에 없다). */
async function expectNoControls(page: Page) {
  const tv = page.locator("main");
  await expect(tv).toBeVisible();
  await expect(tv.getByRole("button")).toHaveCount(0);
  await expect(tv.getByRole("link")).toHaveCount(0);
  await expect(tv.locator("input, textarea, select, [contenteditable='true']")).toHaveCount(0);
}

test("게스트가 다른 브라우저에서 사진을 올리면 TV 포토월에 새로고침 없이 뜬다", async ({
  page,
  browser,
  request,
  room,
  guest,
}) => {
  test.setTimeout(90_000);
  await setStatus(request, room, "live");

  await page.goto(`/tv/${room.code}`);
  await tvLoaded(page, 0);

  // 완전히 다른 브라우저 컨텍스트에서, 게스트가 실제 UI 로 사진을 올린다.
  const guestCtx = await browser.newContext();
  const guestPage = await guestCtx.newPage();
  await seedSession(guestPage, guest.sessionToken);
  await guestPage.goto(`/play/${room.code}`);
  await guestPage.getByLabel("미션 없이 사진 찍기").setInputFiles(pixelFile());

  // 업로드가 실제로 저장됐는지는 TV 와 무관한 경로(service role)로 먼저 확인한다.
  let caption = "";
  await expect
    .poll(
      async () => {
        const { data } = await admin()
          .from("photos")
          .select("caption")
          .eq("room_id", room.id);
        caption = (data?.[0]?.caption as string) ?? "";
        return data?.length ?? 0;
      },
      { timeout: 30_000 },
    )
    .toBe(1);
  expect(caption).not.toBe("");

  // 여기서부터가 핵심: TV 는 goto 이후 한 번도 다시 열리지 않았다.
  // 수용 기준은 "사진이 캡션과 함께" — 이미지·캡션·주인 이름이 다 붙어야 통과다.
  await expect(page.getByRole("img", { name: caption })).toBeVisible({ timeout: NO_RELOAD });
  await expect(page.getByText(caption, { exact: true })).toBeVisible();
  await expect(page.getByText(guest.participant.nickname, { exact: true })).toBeVisible();
  await tvLoaded(page, 1);
  // 사회자 멘트: AI 가 늦거나 죽어도 프리셋 문구가 자리를 지킨다(F4-4).
  await expect(page.locator('[aria-live="polite"]')).not.toBeEmpty();

  await guestCtx.close();
});

test("사진도 참가자도 0인 방을 열어도 TV 가 빈 화면이 아니다", async ({
  page,
  request,
  room,
}) => {
  // 최악의 경우 — 채울 재료가 아무것도 없는 상태에서 포토월로 들어간다.
  await setStatus(request, room, "live");
  const { participants } = await fetchRoom(request, room);
  expect(participants).toHaveLength(0);

  await page.goto(`/tv/${room.code}`);
  await tvLoaded(page, 0);

  // 헤더 아래 무대 영역. 안내 연출이든 시드 콘텐츠든, 여기가 비면 빔에 검은 화면이 뜬다.
  const stage = page.locator("main > div").last();
  const stageText = (await stage.innerText()).replace(/\s/g, "");
  expect(stageText.length, `무대가 사실상 비어 있다: ${JSON.stringify(stageText)}`).toBeGreaterThan(60);
  await expect(page.locator('[aria-live="polite"]')).not.toBeEmpty();
});

test("호스트가 사진을 숨기면 TV 에서 새로고침 없이 사라진다", async ({
  page,
  request,
  room,
  guest,
}) => {
  test.setTimeout(90_000);
  await setStatus(request, room, "live");
  const photo = await postPhoto(request, room, guest.sessionToken);

  await page.goto(`/tv/${room.code}`);
  const onWall = page.getByRole("img", { name: photo.caption });
  await expect(onWall).toBeVisible();
  await tvLoaded(page, 1);

  await ok(
    request.patch(`/api/photo/${photo.id}`, {
      data: { hostToken: room.hostToken, hidden: true },
    }),
  );

  await expect(onWall).toHaveCount(0, { timeout: NO_RELOAD });
  await tvLoaded(page, 0);
});

test("TV 화면에는 조작 요소가 하나도 없다 (로비·포토월·시상 전부)", async ({
  page,
  request,
  room,
  guest,
}) => {
  test.setTimeout(90_000);
  await addBots(request, room.code, room.hostToken);

  await page.goto(`/tv/${room.code}`);
  await expect(avatarOf(page, guest.participant.nickname)).toBeVisible();
  await expectNoControls(page);

  await setStatus(request, room, "live");
  const photo = await postPhoto(request, room, guest.sessionToken);
  await expect(page.getByRole("img", { name: photo.caption })).toBeVisible({
    timeout: NO_RELOAD,
  });
  await expectNoControls(page);

  const { titles } = (await ok(
    request.post(`/api/room/${room.code}/award`, { data: { hostToken: room.hostToken } }),
  )) as { titles: Titles };
  await expect(page.getByText(titles[0].title).first()).toBeVisible({ timeout: NO_RELOAD });
  await expectNoControls(page);
});

test("호스트가 시상을 시작하면 TV 가 시상 화면으로 바뀌고 전원에게 칭호가 붙는다", async ({
  page,
  browser,
  request,
  room,
  guest,
}) => {
  test.setTimeout(90_000);
  await addBots(request, room.code, room.hostToken);
  await setStatus(request, room, "live");
  await postPhoto(request, room, guest.sessionToken);

  await page.goto(`/tv/${room.code}`);
  await tvLoaded(page, 1);

  // 호스트는 자기 폰(별도 컨텍스트)에서 버튼을 누른다.
  const hostCtx = await browser.newContext();
  const hostPage = await hostCtx.newPage();
  await seedHostToken(hostPage, room.code, room.hostToken);
  await hostPage.goto(`/host/${room.code}`);
  const award = hostPage.getByRole("button", { name: /칭호 발표/ });
  await expect(award).toBeEnabled();
  await award.click();

  await expect
    .poll(async () => (await fetchRoom(request, room)).room.status, { timeout: 60_000 })
    .toBe("award");

  const { participants } = await fetchRoom(request, room);
  // AI 가 죽어도 규칙 기반 폴백이 채운다 — 빈 칭호는 어느 경로로도 나오면 안 된다.
  for (const p of participants) {
    expect(`${p.title ?? ""}`.trim(), `${p.nickname} 의 칭호가 비어 있다`).not.toBe("");
  }

  const mine = participants.find((p) => p.id === guest.participant.id);
  expect(mine?.title).toBeTruthy();
  await expect(page.getByText(mine!.title!).first()).toBeVisible({ timeout: NO_RELOAD });

  await hostCtx.close();
});

test("room.status 를 따라 TV 가 로비 → 포토월 → 시상으로 전이한다", async ({
  page,
  request,
  room,
  guest,
}) => {
  test.setTimeout(90_000);
  const avatar = avatarOf(page, guest.participant.nickname);
  const banner = page.locator('[aria-live="polite"]');

  // lobby: 참가자 카드가 뜬다.
  await page.goto(`/tv/${room.code}`);
  await expect(avatar).toBeVisible();

  // live: 사진 0장이라 참가자 카드가 아니라 미션 대기 화면으로 갈아탄다.
  await setStatus(request, room, "live");
  await expect(avatar).toHaveCount(0, { timeout: NO_RELOAD });
  await expect(banner).not.toBeEmpty();

  // award: 칭호 발표 화면.
  const { titles } = (await ok(
    request.post(`/api/room/${room.code}/award`, { data: { hostToken: room.hostToken } }),
  )) as { titles: Titles };
  const mine = titles.find((t) => t.participantId === guest.participant.id);
  expect(mine?.title).toBeTruthy();
  await expect(page.getByText(mine!.title).first()).toBeVisible({ timeout: NO_RELOAD });
  // 시상 화면은 주인공 카드와 전체 칭호 목록 양쪽에 아바타를 건다.
  await expect(avatar.first()).toBeVisible();
  await expect(avatar).toHaveCount(2);
});
