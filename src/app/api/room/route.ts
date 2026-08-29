import { NextResponse } from "next/server";
import { ROOM_COLS, serverDb } from "@/lib/db/client";
import { fail, roomCode, str } from "@/lib/db/server";

/** POST /api/room — 방 생성. `{tonePreset, isDemo?}` → `{room, hostToken}` */
export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const tonePreset = str(body.tonePreset).trim().slice(0, 20) || "친목";
    const hostToken = crypto.randomUUID();
    const db = serverDb();

    // 코드 충돌(23505)은 재시도로 흡수한다.
    for (let i = 0; i < 5; i++) {
      const { data, error } = await db
        .from("rooms")
        .insert({
          code: roomCode(),
          host_token: hostToken,
          tone_preset: tonePreset,
          is_demo: body.isDemo === true,
        })
        .select(ROOM_COLS)
        .single();
      if (data) return NextResponse.json({ room: data, hostToken });
      if (error?.code !== "23505") {
        return fail(`방 생성에 실패했습니다: ${error?.message ?? "알 수 없는 오류"}`, 500);
      }
    }
    return fail("방 코드를 만들지 못했습니다. 다시 시도해 주세요.", 500);
  } catch (error) {
    return fail(error instanceof Error ? error.message : "방 생성에 실패했습니다.", 500);
  }
}
