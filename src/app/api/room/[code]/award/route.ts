import { NextResponse } from "next/server";
import { POST as generateTitles } from "@/app/api/ai/titles/route";
import { getFallbackTitles } from "@/lib/ai/fallbacks";
import type { TitlesResponse } from "@/lib/ai/types";
import { serverDb } from "@/lib/db/client";
import type { BoardCell } from "@/lib/db/types";
import { callAi, fail, hostRoom } from "@/lib/db/server";

export const maxDuration = 60;

/** POST /api/room/[code]/award — 호스트 전용. `{hostToken}` → `{titles}` */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ code: string }> },
) {
  try {
    const { code } = await params;
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const room = await hostRoom(code, body.hostToken);
    if (!room) return fail("이 기기에는 진행 권한이 없어요. 방을 만든 기기에서 열어 주세요.", 403);

    const db = serverDb();
    const { data: rows } = await db
      .from("participants")
      .select("id, nickname, board")
      .eq("room_id", room.id)
      .order("joined_at", { ascending: true });

    const participants = (rows ?? []).map((p) => {
      const done = ((p.board ?? []) as BoardCell[]).filter((c) => c.status === "done");
      return {
        id: p.id as string,
        nickname: p.nickname as string,
        completedMissions: done.map((c) => c.mission),
        captions: done.map((c) => c.caption ?? "").filter(Boolean),
      };
    });
    if (!participants.length) return fail("아직 참가자가 없어요. 한 명이라도 들어온 뒤에 발표해 주세요.", 409);

    // 배치 1회. 실패하면 완료 미션 수로 정렬한 규칙 기반 칭호.
    const res = await callAi<TitlesResponse>(generateTitles, { participants });
    const titles = res?.titles?.length ? res.titles : getFallbackTitles(participants);

    await Promise.all(
      titles.map((t) =>
        db
          .from("participants")
          .update({ title: t.title, title_basis: t.basis })
          .eq("id", t.participantId),
      ),
    );
    await db.from("rooms").update({ status: "award" }).eq("id", room.id);

    return NextResponse.json({ titles });
  } catch (error) {
    return fail(error instanceof Error ? error.message : "칭호를 만들지 못했어요. 잠시 뒤 다시 눌러 주세요.", 500);
  }
}
