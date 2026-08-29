/* eslint-disable react-hooks/rules-of-hooks -- Playwright 픽스처의 use() 는 React 훅이 아니다 */
/**
 * 스펙에서 쓰는 test/expect. 반복되는 준비만 픽스처로 뺐다 —
 * 안 쓰는 픽스처는 만들어지지도 않으므로 공짜다.
 */

import { test as base, expect } from "@playwright/test";
import type { Participant } from "../src/lib/db/types";
import { createRoom, deleteRoom, joinRoom, seedSession, type TestRoom } from "./helpers";

type Fixtures = {
  /** 코드가 `E2E` 로 시작하는 새 방. 테스트가 끝나면 지워진다. */
  room: TestRoom;
  /** room 에 입장한 게스트. page 의 localStorage 에 세션이 심어진 상태다. */
  guest: { participant: Participant; sessionToken: string };
};

export const test = base.extend<Fixtures>({
  room: async ({ request }, use) => {
    const room = await createRoom(request);
    await use(room);
    await deleteRoom(room.id);
  },

  guest: async ({ request, page, room }, use) => {
    const joined = await joinRoom(request, room.code);
    await useSession(page, joined.sessionToken);
    await use(joined);
  },
});

export { expect };
