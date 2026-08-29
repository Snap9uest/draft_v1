import { NextResponse } from "next/server";
import { PARTICIPANT_COLS, serverDb } from "@/lib/db/client";
import { fail, getRoom } from "@/lib/db/server";

/** GET /api/room/[code]/me?sessionToken= → `{participant}` | 404 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ code: string }> },
) {
  try {
    const { code } = await params;
    const sessionToken = new URL(request.url).searchParams.get("sessionToken") ?? "";
    if (!sessionToken) return fail("sessionToken 이 필요합니다.");

    const room = await getRoom(code);
    if (!room) return fail("방을 찾을 수 없습니다.", 404);

    const { data } = await serverDb()
      .from("participants")
      .select(PARTICIPANT_COLS)
      .eq("room_id", room.id)
      .eq("session_token", sessionToken)
      .maybeSingle();
    if (!data) return fail("아직 입장하지 않았습니다.", 404);

    return NextResponse.json({ participant: data });
  } catch (error) {
    return fail(error instanceof Error ? error.message : "조회에 실패했습니다.", 500);
  }
}
