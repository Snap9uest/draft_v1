import { NextResponse } from "next/server";
import { serverDb } from "@/lib/db/client";
import { fail, str } from "@/lib/db/server";
import { NOTE_COLS } from "@/lib/notes";

/** PATCH /api/notes/[id] — 호스트 전용. `{hostToken, hidden}` → 방명록에서 숨김. */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const db = serverDb();

    const { data: note } = await db
      .from("notes")
      .select(`${NOTE_COLS}, room_id`)
      .eq("id", id)
      .maybeSingle();
    if (!note) return fail("그 쪽지를 찾을 수 없어요. 방명록을 새로고침해 주세요.", 404);

    const hostToken = str(body.hostToken).trim();
    if (!hostToken) return fail("권한 정보가 없어요. 방을 만든 기기에서 열어 주세요.");

    const { data: room } = await db
      .from("rooms")
      .select("host_token")
      .eq("id", note.room_id)
      .maybeSingle();
    if (!room || room.host_token !== hostToken) {
      return fail("이 기기에는 진행 권한이 없어요. 방을 만든 기기에서 열어 주세요.", 403);
    }

    const { data: updated, error } = await db
      .from("notes")
      .update({ hidden: body.hidden === true })
      .eq("id", id)
      .select(NOTE_COLS)
      .single();
    if (error) return fail("쪽지를 숨기지 못했어요. 다시 눌러 주세요.", 500);

    return NextResponse.json({ note: updated });
  } catch (error) {
    return fail(
      error instanceof Error ? error.message : "쪽지를 바꾸지 못했어요. 다시 시도해 주세요.",
      500,
    );
  }
}
