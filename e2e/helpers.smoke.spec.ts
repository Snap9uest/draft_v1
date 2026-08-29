/**
 * 헬퍼·설정 자체의 자가 점검. 기능 검증은 F1~F9 스펙이 한다.
 * 여기가 깨지면 다른 스펙은 전부 헛돈다.
 */

import { test, expect } from "./fixtures";
import { addBots, createRoom, deleteRoom } from "./helpers";

test("createRoom 은 E2E 코드로 실제 방을 만든다", async ({ request, room }) => {
  expect(room.code).toMatch(/^E2E[A-HJ-NP-Z2-9]{3}$/);

  const res = await request.get(`/api/room/${room.code}`);
  expect(res.status()).toBe(200);
  const { room: fetched } = await res.json();
  expect(fetched.id).toBe(room.id);
  expect(fetched.status).toBe("lobby");
});

test("guest 픽스처로 들어가면 조인 폼이 아니라 빙고판이 뜬다", async ({
  page,
  room,
  guest,
}) => {
  await page.goto(`/play/${room.code}`);

  await expect(page.getByRole("button", { name: /^1번 미션:/ })).toBeVisible();
  await expect(page.getByRole("button", { name: "입장하기" })).toHaveCount(0);
  expect(guest.participant.board).toHaveLength(9);
});

test("addBots 는 호스트 토큰으로 봇 6명을 넣고, deleteRoom 은 방을 지운다", async ({
  request,
}) => {
  const room = await createRoom(request);

  expect(await addBots(request, room.code, room.hostToken)).toBe(6);
  // 두 번째 호출은 중복 투입 없이 0.
  expect(await addBots(request, room.code, room.hostToken)).toBe(0);

  const { participants } = await (await request.get(`/api/room/${room.code}`)).json();
  expect(participants).toHaveLength(6);

  await deleteRoom(room.id);
  expect((await request.get(`/api/room/${room.code}`)).status()).toBe(404);
});
