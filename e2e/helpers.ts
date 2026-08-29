/**
 * E2E 공용 헬퍼.
 *
 * Supabase 는 모킹하지 않는다 — 실시간 동기화가 이 제품의 핵심이라 가짜 DB 로
 * 통과하는 테스트는 검증 가치가 0이다. 대신 테스트가 만든 방은 코드를 `E2E`
 * 로 시작하게 바꿔 두고(6자 형식은 그대로라 랜딩의 6자리 입력도 통과한다),
 * 끝나면 지운다.
 */

import path from "node:path";
import type { APIRequestContext, Page } from "@playwright/test";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Participant, Room } from "../src/lib/db/types";

// Playwright 는 .env.local 을 읽지 않는다. next dev 와 같은 값을 쓰려면 직접 읽는다.
try {
  process.loadEnvFile(path.join(__dirname, "..", ".env.local"));
} catch {
  // CI 처럼 환경변수가 이미 주입된 경우 — 파일이 없어도 정상이다.
}

/** service role. 방을 지우는 API 가 없어서 정리와 사전 조작은 이 클라이언트로 한다. */
export function admin(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      "E2E 에는 실제 Supabase 가 필요합니다. .env.local 에 NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY 를 넣어주세요.",
    );
  }
  return createClient(url, key, { auth: { persistSession: false } });
}

/** 1×1 PNG. 업로드 경로만 태우는 용도 — AI 판정은 통과하지 못한다(직접 인증 경로를 쓸 것). */
export const PIXEL_PNG =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";

/** `setInputFiles(pixelFile())` 로 UI 업로드 경로에 넣는다. */
export const pixelFile = (name = "e2e.png") => ({
  name,
  mimeType: "image/png",
  buffer: Buffer.from(PIXEL_PNG.split(",")[1], "base64"),
});

export type TestRoom = { id: string; code: string; hostToken: string };

// 방 코드 문자셋은 src/lib/db/server.ts 와 같다(혼동 문자 O/0/I/1 제외).
const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const suffix = () =>
  Array.from(
    { length: 3 },
    () => CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)],
  ).join("");

const created: string[] = [];

async function json<T>(res: Awaited<ReturnType<APIRequestContext["post"]>>): Promise<T> {
  if (!res.ok()) throw new Error(`${res.url()} → ${res.status()} ${await res.text()}`);
  return (await res.json()) as T;
}

/**
 * POST /api/room 으로 방을 만들고, 코드를 `E2E???` 로 바꿔 반환한다.
 * 만든 방은 모듈에 기록돼 cleanupRooms() 가 지운다.
 */
export async function createRoom(
  request: APIRequestContext,
  opts: { tonePreset?: string; isDemo?: boolean } = {},
): Promise<TestRoom> {
  const { room, hostToken } = await json<{ room: Room; hostToken: string }>(
    await request.post("/api/room", { data: opts }),
  );
  created.push(room.id);

  const db = admin();
  for (let i = 0; i < 5; i++) {
    const code = `E2E${suffix()}`;
    const { error } = await db.from("rooms").update({ code }).eq("id", room.id);
    if (!error) return { id: room.id, code, hostToken };
    if (error.code !== "23505") throw new Error(`E2E 코드 부여 실패: ${error.message}`);
  }
  throw new Error("E2E 방 코드를 만들지 못했습니다.");
}

/**
 * POST /api/room/[code]/join. sessionToken 을 직접 넘기지 않으면 새로 만들어
 * 돌려주므로, 그대로 seedSession(page, sessionToken) 에 넣으면 브라우저가 이
 * 참가자로 인식한다.
 *
 * 주의: 이 라우트는 응답 뒤 after() 에서 아바타·빙고판을 AI 로 덮어쓴다.
 * 빙고판 내용을 단언하려면 응답 직후가 아니라 원하는 상태를 기다릴 것.
 */
export async function joinRoom(
  request: APIRequestContext,
  code: string,
  opts: {
    nickname?: string;
    intro?: string;
    sessionToken?: string;
    invitedBy?: string;
  } = {},
): Promise<{ participant: Participant; sessionToken: string }> {
  const sessionToken = opts.sessionToken ?? crypto.randomUUID();
  const { participant } = await json<{ participant: Participant }>(
    await request.post(`/api/room/${code}/join`, {
      data: {
        nickname: opts.nickname ?? `게스트${suffix()}`,
        intro: opts.intro ?? "E2E 테스트 참가자. 사진 찍는 거 좋아함.",
        sessionToken,
        invitedBy: opts.invitedBy,
      },
    }),
  );
  return { participant, sessionToken };
}

/** POST /api/room/[code]/bots → 새로 들어간 봇 수. 데모 방이면 hostToken 없이도 된다. */
export async function addBots(
  request: APIRequestContext,
  code: string,
  hostToken?: string,
): Promise<number> {
  const { added } = await json<{ added: number }>(
    await request.post(`/api/room/${code}/bots`, { data: { hostToken } }),
  );
  return added;
}

/** 이 브라우저를 해당 참가자로 만든다. goto 전에 부를 것(addInitScript). */
export async function seedSession(page: Page, sessionToken: string): Promise<void> {
  await page.addInitScript((token) => {
    try {
      localStorage.setItem("snapquest.session", token);
    } catch {
      // about:blank 등 저장소가 막힌 프레임 — 실제 페이지에서 다시 실행된다.
    }
  }, sessionToken);
}

/** 이 브라우저에 호스트 권한을 준다(/host/[code] 가 읽는 키). goto 전에 부를 것. */
export async function seedHostToken(
  page: Page,
  code: string,
  hostToken: string,
): Promise<void> {
  await page.addInitScript(
    ([key, token]) => {
      try {
        localStorage.setItem(key, token);
      } catch {
        // 위와 같음
      }
    },
    [`snapquest.host.${code.toUpperCase()}`, hostToken] as const,
  );
}

/** rooms 삭제는 participants·photos·votes 까지 cascade 된다. */
export async function deleteRoom(id: string): Promise<void> {
  await admin().from("rooms").delete().eq("id", id);
  const i = created.indexOf(id);
  if (i >= 0) created.splice(i, 1);
}

/**
 * afterAll 용. 이 워커가 만든 방 + 죽은 런이 남긴 오래된 E2E 방을 지운다.
 * ponytail: Storage 의 사진 파일은 남는다 — 버킷은 7일 만료 정책에 맡긴다.
 */
export async function cleanupRooms(): Promise<void> {
  const db = admin();
  if (created.length) await db.from("rooms").delete().in("id", created);
  created.length = 0;
  // 1시간 컷: 동시에 도는 다른 워커의 방을 지우지 않는다.
  await db
    .from("rooms")
    .delete()
    .like("code", "E2E%")
    .lt("created_at", new Date(Date.now() - 3_600_000).toISOString());
}
