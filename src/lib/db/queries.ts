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

export async function getMyParticipant(
  roomId: string,
  sessionToken: string,
): Promise<Participant | null> {
  if (!sessionToken) return null;
  try {
    const { data, error } = await browserDb()
      .from("participants")
      .select(PARTICIPANT_COLS)
      .eq("room_id", roomId)
      .eq("session_token", sessionToken)
      .maybeSingle();
    if (error) throw error;
    return (data ?? null) as Participant | null;
  } catch (error) {
    warn("내 참가자", error);
    return null;
  }
}
