import { NextResponse } from "next/server";
import { serverDb } from "@/lib/db/client";
import type { BoardCell } from "@/lib/db/types";
import { fail, str } from "@/lib/db/server";

/**
 * PATCH /api/photo/[id] — 두 갈래.
 * 호스트: `{hostToken, hidden}` → 포토월·앨범에서 숨김
 * 본인:   `{sessionToken}`      → AI 판정 실패분 수동 인증(self_check) + 칸 채우기
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const db = serverDb();

    const { data: photo } = await db
      .from("photos")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (!photo) return fail("사진을 찾을 수 없습니다.", 404);

    const sessionToken = str(body.sessionToken).trim();
    if (sessionToken) {
      const { data: owner } = await db
        .from("participants")
        .select("id, board")
        .eq("id", photo.owner_id)
        .eq("session_token", sessionToken)
        .maybeSingle();
      if (!owner) return fail("본인이 올린 사진만 인증할 수 있습니다.", 403);

      const { data: updated, error } = await db
        .from("photos")
        .update({ verify_status: "self_check" })
        .eq("id", id)
        .select("*")
        .single();
      if (error) return fail(`인증에 실패했습니다: ${error.message}`, 500);

      const cell = photo.cell_index as number | null;
      if (cell !== null) {
        const board = [...((owner.board ?? []) as BoardCell[])];
        board[cell] = {
          mission: board[cell]?.mission ?? "",
          status: "done",
          photoId: id,
          caption: (photo.caption as string) || board[cell]?.caption,
        };
        await db.from("participants").update({ board }).eq("id", owner.id);
      }
      return NextResponse.json({ photo: updated });
    }

    const hostToken = str(body.hostToken).trim();
    if (!hostToken) return fail("hostToken 또는 sessionToken 이 필요합니다.");
    const { data: room } = await db
      .from("rooms")
      .select("host_token")
      .eq("id", photo.room_id)
      .maybeSingle();
    if (!room || room.host_token !== hostToken) {
      return fail("호스트 권한이 없습니다.", 403);
    }

    const { data: updated, error } = await db
      .from("photos")
      .update({ hidden: body.hidden === true })
      .eq("id", id)
      .select("*")
      .single();
    if (error) return fail(`사진 숨김에 실패했습니다: ${error.message}`, 500);

    return NextResponse.json({ photo: updated });
  } catch (error) {
    return fail(error instanceof Error ? error.message : "사진 수정에 실패했습니다.", 500);
  }
}
