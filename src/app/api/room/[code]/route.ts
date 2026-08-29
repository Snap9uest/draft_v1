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
    if (!room) return fail("방을 찾을 수 없어요. 방 코드를 다시 확인해 주세요.", 404);

    const { data: participants } = await serverDb()
      .from("participants")
      .select(PARTICIPANT_COLS)
      .eq("room_id", room.id)
      .order("joined_at", { ascending: true });

    return NextResponse.json({ room, participants: participants ?? [] });
  } catch (error) {
    return fail(error instanceof Error ? error.message : "파티 정보를 불러오지 못했어요. 다시 시도해 주세요.", 500);
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
    if (!room) return fail("이 기기에는 진행 권한이 없어요. 방을 만든 기기에서 열어 주세요.", 403);

    const patch: Record<string, unknown> = {};
    if (body.status !== undefined) {
      const status = str(body.status) as RoomStatus;
      if (!STATUSES.includes(status)) return fail("그 진행 단계로는 넘어갈 수 없어요.");
      patch.status = status;
      if (status === "ended") patch.ended_at = new Date().toISOString();
    }
    if (body.tonePreset !== undefined) {
      const tone = str(body.tonePreset).trim().slice(0, 20);
      if (!tone) return fail("미션 톤을 하나 골라 주세요.");
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
    if (error) return fail("설정을 저장하지 못했어요. 다시 눌러 주세요.", 500);

    return NextResponse.json({ room: data });
  } catch (error) {
    return fail(error instanceof Error ? error.message : "설정을 저장하지 못했어요. 다시 눌러 주세요.", 500);
  }
}
