import { NextResponse } from "next/server";
import { serverDb } from "@/lib/db/client";
import { fail, getRoom, MAX_IMAGE_CHARS, str, uploadImage } from "@/lib/db/server";
import { CUT_COUNT, cutCaption, readFourcut } from "@/lib/fourcut";

export const maxDuration = 60;

/**
 * POST /api/fourcut/submit — `{roomCode, sessionToken, cutIndex, imageBase64}`
 * → `{photo, late}`
 *
 * 네컷 사진도 그냥 photos 행이다: cell_index 는 null(자유 사진 취급), 컷 번호는
 * caption 에 적는다. 판정도 사회자 멘트도 부르지 않는다 — 4컷을 7초 안에
 * 넘겨야 하는 자리라 왕복을 하나도 끼우지 않는다.
 */
export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;

    const roomCode = str(body.roomCode).trim();
    const sessionToken = str(body.sessionToken).trim();
    const imageBase64 = str(body.imageBase64).trim();
    if (!roomCode || !sessionToken) {
      return fail("입장 정보가 없어요. 다시 입장한 뒤 올려 주세요.");
    }
    if (!imageBase64) return fail("사진이 안 담겼어요. 다시 찍어 주세요.");
    if (imageBase64.length > MAX_IMAGE_CHARS) {
      return fail("사진이 너무 커요. 다시 찍어볼까요?", 413);
    }

    const cutIndex = Number(body.cutIndex);
    if (!Number.isInteger(cutIndex) || cutIndex < 0 || cutIndex >= CUT_COUNT) {
      return fail("몇 번째 컷인지 알 수 없어요. 화면을 새로고침한 뒤 다시 찍어 주세요.");
    }

    const room = await getRoom(roomCode);
    if (!room) return fail("방을 찾을 수 없어요. 방 코드를 다시 확인해 주세요.", 404);

    const session = readFourcut(room.state);
    if (!session) {
      return fail("지금은 네컷 타임이 아니에요. 호스트가 시작하면 화면에 떠요.", 409);
    }

    const db = serverDb();
    const { data: participant } = await db
      .from("participants")
      .select("id")
      .eq("room_id", room.id)
      .eq("session_token", sessionToken)
      .maybeSingle();
    if (!participant) return fail("먼저 파티에 입장해 주세요.", 403);

    const url = await uploadImage(
      `${room.id}/fourcut-${participant.id}-${cutIndex}-${Date.now()}`,
      imageBase64,
    );
    if (!url) return fail("사진을 올리지 못했어요. 다시 한 번 시도해 주세요.", 502);

    const caption = cutCaption(cutIndex, session.cutMissions[cutIndex] ?? "");

    // 같은 컷을 다시 찍으면 행을 늘리지 않고 덮어쓴다.
    const { data: existing } = await db
      .from("photos")
      .select("id")
      .eq("room_id", room.id)
      .eq("owner_id", participant.id)
      .eq("caption", caption)
      .maybeSingle();

    const { data: photo, error } = existing
      ? await db.from("photos").update({ url }).eq("id", existing.id).select("*").single()
      : await db
          .from("photos")
          .insert({
            room_id: room.id,
            owner_id: participant.id,
            cell_index: null,
            url,
            caption,
            verify_status: "self_check",
          })
          .select("*")
          .single();
    if (error || !photo) return fail("사진을 저장하지 못했어요. 다시 시도해 주세요.", 500);

    // 마감 뒤 도착분도 버리지 않는다 — 프레임에만 못 들어가고 갤러리에는 남는다.
    const late = Date.now() > Date.parse(session.deadline);
    return NextResponse.json({ photo, late });
  } catch (error) {
    return fail(
      error instanceof Error ? error.message : "사진을 저장하지 못했어요. 다시 시도해 주세요.",
      500,
    );
  }
}
