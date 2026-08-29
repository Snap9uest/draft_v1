import { NextResponse } from "next/server";
import { getFallbackMissions } from "@/lib/ai/fallbacks";
import { serverDb } from "@/lib/db/client";
import {
  boardFrom,
  FALLBACK_BOTS,
  fail,
  getRoom,
  hostRoom,
  presetAvatar,
} from "@/lib/db/server";

/**
 * POST /api/room/[code]/bots — `{hostToken?}` → `{added}`
 * 데모 방은 토큰 없이도 봇을 부를 수 있다(심사관용). 그 외에는 호스트 전용.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ code: string }> },
) {
  try {
    const { code } = await params;
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;

    let room = await hostRoom(code, body.hostToken);
    if (!room) {
      const open = await getRoom(code);
      if (!open?.is_demo) return fail("이 기기에는 진행 권한이 없어요. 방을 만든 기기에서 열어 주세요.", 403);
      room = open;
    }

    const db = serverDb();
    const { data: existing } = await db
      .from("participants")
      .select("nickname")
      .eq("room_id", room.id)
      .eq("is_bot", true);
    const taken = new Set((existing ?? []).map((p) => p.nickname as string));

    const rows = FALLBACK_BOTS.filter((b) => !taken.has(b.nickname)).map((b) => ({
      room_id: room.id,
      nickname: b.nickname,
      intro: b.intro,
      is_bot: true,
      session_token: `bot:${room.id}:${b.nickname}`,
      avatar_url: presetAvatar(b.nickname, b.emoji),
      board: boardFrom(
        getFallbackMissions(
          room.tone_preset,
          FALLBACK_BOTS.filter((o) => o.nickname !== b.nickname).map((o) => o.nickname),
        ),
      ),
    }));
    if (!rows.length) return NextResponse.json({ added: 0 });

    const { data, error } = await db.from("participants").insert(rows).select("id");
    if (error) return fail("봇 참가자를 부르지 못했어요. 다시 눌러 주세요.", 500);

    return NextResponse.json({ added: data?.length ?? 0 });
  } catch (error) {
    return fail(error instanceof Error ? error.message : "봇 참가자를 부르지 못했어요. 다시 눌러 주세요.", 500);
  }
}
