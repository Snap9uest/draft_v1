import { NextResponse } from "next/server";
import { serverDb } from "@/lib/db/client";
import { fail, getRoom, str } from "@/lib/db/server";

/** POST /api/vote — `{roomCode, sessionToken, photoId}` → `{ok}`. 1인 1표(재투표는 덮어쓰기). */
export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const roomCode = str(body.roomCode).trim();
    const sessionToken = str(body.sessionToken).trim();
    const photoId = str(body.photoId).trim();
    if (!roomCode || !sessionToken || !photoId) {
      return fail("방 코드·세션 토큰·사진 ID가 모두 필요합니다.");
    }

    const room = await getRoom(roomCode);
    if (!room) return fail("방을 찾을 수 없습니다.", 404);

    const db = serverDb();
    const { data: voter } = await db
      .from("participants")
      .select("id")
      .eq("room_id", room.id)
      .eq("session_token", sessionToken)
      .maybeSingle();
    if (!voter) return fail("먼저 방에 입장해 주세요.", 403);

    const { data: photo } = await db
      .from("photos")
      .select("id")
      .eq("id", photoId)
      .eq("room_id", room.id)
      .eq("hidden", false)
      .maybeSingle();
    if (!photo) return fail("투표할 수 없는 사진입니다.", 404);

    const { error } = await db
      .from("votes")
      .upsert(
        { voter_id: voter.id, photo_id: photoId, room_id: room.id },
        { onConflict: "voter_id" },
      );
    if (error) return fail(`투표에 실패했습니다: ${error.message}`, 500);

    return NextResponse.json({ ok: true });
  } catch (error) {
    return fail(error instanceof Error ? error.message : "투표에 실패했습니다.", 500);
  }
}
