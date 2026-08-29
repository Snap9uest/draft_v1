import { after, NextResponse } from "next/server";
import { POST as generateReaction } from "@/app/api/ai/mc-reaction/route";
import { POST as verifyPhoto } from "@/app/api/ai/verify-photo/route";
import { getFallbackCaption } from "@/lib/ai/fallbacks";
import type { McReactionResponse, VerifyPhotoResponse } from "@/lib/ai/types";
import { serverDb } from "@/lib/db/client";
import type { BoardCell } from "@/lib/db/types";
import {
  callAi,
  fail,
  getRoom,
  MAX_IMAGE_CHARS,
  str,
  uploadImage,
} from "@/lib/db/server";

export const maxDuration = 60;

/**
 * POST /api/photo
 * `{roomCode, sessionToken, cellIndex?, imageBase64}` → `{photo, verified, caption}`
 *
 * 판정 실패는 에러가 아니다 — 사진은 저장하고 verified:false 를 돌려주면
 * 클라이언트가 "직접 인증하기" 버튼을 띄운다(PATCH /api/photo/[id]).
 */
export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;

    const roomCode = str(body.roomCode).trim();
    const sessionToken = str(body.sessionToken).trim();
    const imageBase64 = str(body.imageBase64).trim();
    if (!roomCode || !sessionToken) return fail("입장 정보가 없어요. 다시 입장한 뒤 올려 주세요.");
    if (!imageBase64) return fail("사진이 안 담겼어요. 다시 골라 주세요.");
    if (imageBase64.length > MAX_IMAGE_CHARS) {
      return fail("사진이 너무 커요. 다시 찍어볼까요?", 413);
    }

    let cellIndex: number | null = null;
    if (body.cellIndex !== null && body.cellIndex !== undefined) {
      const n = Number(body.cellIndex);
      if (!Number.isInteger(n) || n < 0 || n > 8) return fail("그 미션 칸을 찾을 수 없어요. 빙고판에서 다시 골라 주세요.");
      cellIndex = n;
    }

    const room = await getRoom(roomCode);
    if (!room) return fail("방을 찾을 수 없어요. 방 코드를 다시 확인해 주세요.", 404);

    const db = serverDb();
    const { data: participant } = await db
      .from("participants")
      .select("id, nickname, board")
      .eq("room_id", room.id)
      .eq("session_token", sessionToken)
      .maybeSingle();
    if (!participant) return fail("먼저 파티에 입장해 주세요.", 403);

    const url = await uploadImage(
      `${room.id}/${participant.id}-${Date.now()}`,
      imageBase64,
    );
    if (!url) return fail("사진을 올리지 못했어요. 다시 한 번 시도해 주세요.", 502);

    const board = (participant.board ?? []) as BoardCell[];
    const mission = cellIndex === null ? "" : (board[cellIndex]?.mission ?? "");

    // 인증 판정은 참가자가 기다리는 값이라 응답 전에 끝낸다.
    let verified = false;
    let caption = getFallbackCaption();
    if (cellIndex !== null && mission) {
      const res = await callAi<VerifyPhotoResponse>(verifyPhoto, {
        missionText: mission,
        imageBase64,
      });
      if (res) {
        verified = res.verified;
        caption = res.caption || caption;
      }
    }

    const { data: photo, error } = await db
      .from("photos")
      .insert({
        room_id: room.id,
        owner_id: participant.id,
        cell_index: cellIndex,
        url,
        caption,
        verify_status: verified ? "ai_pass" : "pending",
      })
      .select("*")
      .single();
    if (error || !photo) {
      return fail("사진을 저장하지 못했어요. 다시 시도해 주세요.", 500);
    }

    if (verified && cellIndex !== null) {
      const next = [...board];
      next[cellIndex] = {
        mission: next[cellIndex]?.mission ?? mission,
        status: "done",
        photoId: photo.id as string,
        caption,
      };
      await db.from("participants").update({ board: next }).eq("id", participant.id);
    }

    const nickname = participant.nickname as string;
    const photoId = photo.id as string;
    after(async () => {
      const res = await callAi<McReactionResponse>(generateReaction, {
        nickname,
        missionText: mission,
        caption,
      });
      if (res?.reaction) {
        await db.from("photos").update({ mc_reaction: res.reaction }).eq("id", photoId);
      }
    });

    return NextResponse.json({ photo, verified, caption });
  } catch (error) {
    return fail(error instanceof Error ? error.message : "사진을 저장하지 못했어요. 다시 시도해 주세요.", 500);
  }
}
