import { NextResponse } from "next/server";
import { PARTICIPANT_COLS, ROOM_COLS, serverDb } from "@/lib/db/client";
import type { RoomStatus } from "@/lib/db/types";
import { fail, getRoom, hostRoom, str } from "@/lib/db/server";

const STATUSES: RoomStatus[] = ["lobby", "live", "award", "ended"];

/** GET /api/room/[code] → `{room, participants}` */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ code: string }> },
) {
  try {
    const { code } = await params;
    const room = await getRoom(code);
    if (!room) return fail("방을 찾을 수 없습니다.", 404);

    const { data: participants } = await serverDb()
      .from("participants")
      .select(PARTICIPANT_COLS)
      .eq("room_id", room.id)
      .order("joined_at", { ascending: true });

    return NextResponse.json({ room, participants: participants ?? [] });
  } catch (error) {
    return fail(error instanceof Error ? error.message : "방 조회에 실패했습니다.", 500);
  }
}

/** PATCH /api/room/[code] — 호스트 전용. `{hostToken, status?, tonePreset?, rewardOn?}` */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ code: string }> },
) {
  try {
    const { code } = await params;
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const room = await hostRoom(code, body.hostToken);
    if (!room) return fail("호스트 권한이 없습니다.", 403);

    const patch: Record<string, unknown> = {};
    if (body.status !== undefined) {
      const status = str(body.status) as RoomStatus;
      if (!STATUSES.includes(status)) return fail("올바르지 않은 상태값입니다.");
      patch.status = status;
      if (status === "ended") patch.ended_at = new Date().toISOString();
    }
    if (body.tonePreset !== undefined) {
      const tone = str(body.tonePreset).trim().slice(0, 20);
      if (!tone) return fail("톤 프리셋이 비어 있습니다.");
      patch.tone_preset = tone;
    }
    if (body.rewardOn !== undefined) patch.reward_on = body.rewardOn === true;
    if (!Object.keys(patch).length) return NextResponse.json({ room });

    const { data, error } = await serverDb()
      .from("rooms")
      .update(patch)
      .eq("id", room.id)
      .select(ROOM_COLS)
      .single();
    if (error) return fail(`방 수정에 실패했습니다: ${error.message}`, 500);

    return NextResponse.json({ room: data });
  } catch (error) {
    return fail(error instanceof Error ? error.message : "방 수정에 실패했습니다.", 500);
  }
}
