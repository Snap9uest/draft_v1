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
    if (!sessionToken) return fail("입장 정보가 없어요. 다시 입장해 주세요.");

    const room = await getRoom(code);
    if (!room) return fail("방을 찾을 수 없어요. 방 코드를 다시 확인해 주세요.", 404);

    const { data } = await serverDb()
      .from("participants")
      .select(PARTICIPANT_COLS)
      .eq("room_id", room.id)
      .eq("session_token", sessionToken)
      .maybeSingle();
    if (!data) return fail("아직 입장하지 않았어요.", 404);

    return NextResponse.json({ participant: data });
  } catch (error) {
    return fail(error instanceof Error ? error.message : "내 정보를 불러오지 못했어요. 다시 시도해 주세요.", 500);
  }
}
