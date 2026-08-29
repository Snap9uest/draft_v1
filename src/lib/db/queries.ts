/* 브라우저 anon 클라이언트로 읽는 조회 헬퍼. 쓰기는 전부 /api 라우트를 거친다. */

import { browserDb, PARTICIPANT_COLS, ROOM_COLS } from "./client";
import type { Participant, Photo, Room } from "./types";

/** 환경변수 누락·네트워크 오류를 화면 크래시 대신 빈 결과로 흡수한다. */
function warn(where: string, error: unknown) {
  console.error(`[SnapQuest] ${where} 조회 실패:`, error);
}

export async function getRoomWithParticipants(
  code: string,
): Promise<{ room: Room; participants: Participant[] } | null> {
  try {
    const db = browserDb();
    const { data: room, error } = await db
      .from("rooms")
      .select(ROOM_COLS)
      .eq("code", code.toUpperCase())
      .maybeSingle();
    if (error) throw error;
    if (!room) return null;

    const { data: participants } = await db
      .from("participants")
      .select(PARTICIPANT_COLS)
      .eq("room_id", room.id)
      .order("joined_at", { ascending: true });

    return {
      room: room as Room,
      participants: (participants ?? []) as Participant[],
    };
  } catch (error) {
    warn("방", error);
    // Supabase 키가 없거나 연결 실패 시 DEMO01 방 안전 폴백 제공
    if (code.toUpperCase() === "DEMO01" || code.toUpperCase() === "DEMO") {
      return {
        room: {
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
        } as Room,
        participants: [],
      };
    }
    return null;
  }
}

export async function getRoomPhotos(
  roomId: string,
  includeHidden = false,
): Promise<Photo[]> {
  try {
    let q = browserDb()
      .from("photos")
      .select("*")
      .eq("room_id", roomId)
      .order("created_at", { ascending: false });
    if (!includeHidden) q = q.eq("hidden", false);
    const { data, error } = await q;
    if (error) throw error;
    return (data ?? []) as Photo[];
  } catch (error) {
    warn("사진", error);
    return [];
  }
}

/** 0002 이후 anon 은 session_token 컬럼을 못 읽는다 — 서버 라우트를 거친다. */
export async function getMyParticipant(
  code: string,
  sessionToken: string,
): Promise<Participant | null> {
  if (!sessionToken) return null;
  try {
    const res = await fetch(
      `/api/room/${encodeURIComponent(code)}/me?sessionToken=${encodeURIComponent(sessionToken)}`,
    );
    if (!res.ok) return null;
    const { participant } = (await res.json()) as { participant: Participant };
    return participant ?? null;
  } catch (error) {
    warn("내 참가자", error);
    return null;
  }
}
