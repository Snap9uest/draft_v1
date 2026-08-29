/* 서버 라우트 전용 헬퍼. 클라이언트 파일에서 import 금지 (service role 경로). */

import { NextResponse } from "next/server";
import { ROOM_COLS, serverDb } from "./client";
import type { BoardCell, Room } from "./types";

export function fail(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export const str = (v: unknown): string => (typeof v === "string" ? v : "");

/** 1MB 짜리 셀카가 base64 로 오면 ~1.4MB. 12MB 컷이면 리사이즈 실패도 흡수한다. */
export const MAX_IMAGE_CHARS = 12_000_000;

/** 사람이 불러줄 코드라 혼동 문자(O/0/I/1)를 뺀다. */
const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function roomCode(): string {
  return Array.from(
    { length: 6 },
    () => CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)],
  ).join("");
}

export async function getRoom(code: string): Promise<Room | null> {
  try {
    const { data } = await serverDb()
      .from("rooms")
      .select(ROOM_COLS)
      .eq("code", code.toUpperCase())
      .maybeSingle();
    return (data ?? null) as Room | null;
  } catch (err) {
    if (code.toUpperCase() === "DEMO01" || code.toUpperCase() === "DEMO") {
      return {
        id: "demo-room-id",
        code: "DEMO01",
        tone_preset: "동아리",
        reward_on: true,
        status: "live",
        state: {},
        is_demo: true,
        created_at: new Date().toISOString(),
        ended_at: null,
        expires_at: new Date(Date.now() + 7 * 86400000).toISOString(),
      } as Room;
    }
    return null;
  }
}

/** 호스트 검증. 방이 없든 토큰이 틀리든 null — 호출자는 403 으로 통일한다. */
export async function hostRoom(
  code: string,
  hostToken: unknown,
): Promise<Room | null> {
  if (typeof hostToken !== "string" || !hostToken) return null;
  try {
    const { data } = await serverDb()
      .from("rooms")
      .select(`${ROOM_COLS}, host_token`)
      .eq("code", code.toUpperCase())
      .maybeSingle();
    if (!data || data.host_token !== hostToken) return null;
    const room = { ...data } as Record<string, unknown>;
    delete room.host_token;
    return room as unknown as Room;
  } catch (err) {
    if (code.toUpperCase() === "DEMO01" || code.toUpperCase() === "DEMO") {
      return {
        id: "demo-room-id",
        code: "DEMO01",
        tone_preset: "동아리",
        reward_on: true,
        status: "live",
        state: {},
        is_demo: true,
        created_at: new Date().toISOString(),
        ended_at: null,
        expires_at: new Date(Date.now() + 7 * 86400000).toISOString(),
      } as Room;
    }
    return null;
  }
}

/** base64(데이터 URI 또는 순수) → photos 버킷 업로드 → 공개 URL. */
export async function uploadImage(
  path: string,
  base64: string,
): Promise<string | null> {
  const m = base64.match(/^data:([^;,]+);base64,([\s\S]+)$/);
  const contentType = m ? m[1] : "image/jpeg";
  const buf = Buffer.from((m ? m[2] : base64).trim(), "base64");
  if (!buf.length) return null;

  const ext = contentType.split("/")[1]?.replace("jpeg", "jpg") ?? "jpg";
  const bucket = serverDb().storage.from("photos");
  const { error } = await bucket.upload(`${path}.${ext}`, buf, {
    contentType,
    upsert: true,
  });
  if (error) {
    console.error("[SnapQuest] Storage 업로드 실패:", error);
    return null;
  }
  return bucket.getPublicUrl(`${path}.${ext}`).data.publicUrl;
}

/**
 * /api/ai/* 핸들러를 HTTP 왕복 없이 직접 부른다 — 자기 자신의 origin 을 추측할
 * 필요가 없고 after() 안에서도 안전하다. 실패는 전부 null 로 흡수한다.
 */
export async function callAi<T>(
  handler: (request: Request) => Promise<Response>,
  body: unknown,
): Promise<T | null> {
  try {
    const res = await handler(
      new Request("http://ai.internal", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      }),
    );
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch (error) {
    console.error("[SnapQuest] AI 호출 실패:", error);
    return null;
  }
}

const AVATAR_EMOJIS = ["🦊", "🐼", "🐻", "🐯", "🐨", "🐸", "🦁", "🐵", "🐧", "🦄"];

/** 외부 이미지 의존 0. 시드가 같으면 항상 같은 아바타. */
export function presetAvatar(seed: string, emoji?: string): string {
  let h = 0;
  for (const ch of seed) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  const face = emoji ?? AVATAR_EMOJIS[h % AVATAR_EMOJIS.length];
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100">` +
    `<rect width="100" height="100" rx="22" fill="hsl(${h % 360} 72% 86%)"/>` +
    `<text x="50" y="54" font-size="52" text-anchor="middle" dominant-baseline="central">${face}</text>` +
    `</svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

export const boardFrom = (missions: string[]): BoardCell[] =>
  missions.slice(0, 9).map((mission) => ({ mission, status: "todo" as const }));

/** ponytail: src/lib/bots.ts (Agent-Landing) 가 생기면 그걸 import 하고 여기는 지운다. */
export const FALLBACK_BOTS = [
  { nickname: "카메라요정", intro: "사진 찍는 게 취미. 오늘 100장 목표.", emoji: "📸" },
  { nickname: "리액션장인", intro: "웃음 담당. 아무 말에나 크게 웃어준다.", emoji: "😂" },
  { nickname: "먹보곰", intro: "음식 앞에서 제일 신남. 디저트는 배가 따로 있다.", emoji: "🐻" },
  { nickname: "댄스머신", intro: "노래만 나오면 몸이 먼저 움직인다.", emoji: "🕺" },
  { nickname: "조용한관찰자", intro: "말은 적지만 다 보고 있다.", emoji: "🦉" },
  { nickname: "인싸토끼", intro: "처음 본 사람과 3분이면 친구가 된다.", emoji: "🐰" },
];
