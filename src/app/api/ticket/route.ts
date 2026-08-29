import { NextResponse } from "next/server";
import { PARTICIPANT_COLS, serverDb } from "@/lib/db/client";
import type { BoardCell } from "@/lib/db/types";
import { fail, getRoom, MAX_IMAGE_CHARS, str, uploadImage } from "@/lib/db/server";
import { isLocked, parseFrame, unlockState } from "./frames";

export const maxDuration = 60;

/**
 * POST /api/ticket — 티켓 저장 + **해금 재검증**.
 * `{roomCode, sessionToken, frame, imageBase64?}` → `{ticketUrl, frame, unlock}`
 *
 * 클라이언트가 "빙고 했어요"라고 말하는 걸 믿지 않는다(J3). 잠금 프레임이면
 * `board` 로 라인 수를, `invited_by` 로 초대 입장 수를 서버가 다시 센다.
 */
export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;

    const roomCode = str(body.roomCode).trim();
    const sessionToken = str(body.sessionToken).trim();
    if (!roomCode || !sessionToken || sessionToken.length > 64) {
      return fail("방 코드와 세션 토큰이 필요합니다.");
    }
    const frame = parseFrame(body.frame);
    if (!frame) return fail("올바르지 않은 프레임입니다.");

    const imageBase64 = str(body.imageBase64).trim();
    if (imageBase64.length > MAX_IMAGE_CHARS) {
      return fail("티켓 이미지가 너무 큽니다.", 413);
    }
    if (imageBase64 && !/^data:image\/(jpeg|png|webp);base64,/.test(imageBase64)) {
      return fail("티켓 이미지 형식이 올바르지 않습니다.");
    }

    const room = await getRoom(roomCode);
    if (!room) return fail("방을 찾을 수 없습니다.", 404);

    const db = serverDb();
    const { data: me } = await db
      .from("participants")
      .select("id, board")
      .eq("room_id", room.id)
      .eq("session_token", sessionToken)
      .maybeSingle();
    if (!me) return fail("이 방의 참가자가 아닙니다.", 403);

    // 해금 재계산 — 요청 본문의 어떤 값도 여기에 관여하지 않는다.
    const { count } = await db
      .from("participants")
      .select("id", { count: "exact", head: true })
      .eq("room_id", room.id)
      .eq("invited_by", me.id as string);
    const unlock = unlockState((me.board ?? []) as BoardCell[], count ?? 0);

    if (isLocked(frame) && !unlock.unlocked) {
      return NextResponse.json(
        {
          error: "아직 잠긴 프레임이에요. 빙고 1줄을 완성하거나 초대 링크로 1명을 데려오면 열려요.",
          unlock,
        },
        { status: 403 },
      );
    }

    const url = imageBase64
      ? await uploadImage(`tickets/${me.id as string}`, imageBase64)
      : null;

    const patch: Record<string, unknown> = { ticket_frame: frame };
    if (url) patch.ticket_url = url;
    const { data, error } = await db
      .from("participants")
      .update(patch)
      .eq("id", me.id as string)
      .select(PARTICIPANT_COLS)
      .single();
    if (error) return fail(`티켓 저장에 실패했습니다: ${error.message}`, 500);

    return NextResponse.json({
      ticketUrl: (data?.ticket_url as string | null) ?? null,
      frame,
      unlock,
    });
  } catch (error) {
    return fail(error instanceof Error ? error.message : "티켓 저장에 실패했습니다.", 500);
  }
}
