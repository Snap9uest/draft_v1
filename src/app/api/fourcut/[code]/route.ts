import { NextResponse } from "next/server";
import { serverDb } from "@/lib/db/client";
import { fail, getRoom } from "@/lib/db/server";
import {
  buildFrame,
  cutIndexFromCaption,
  cutProgress,
  type FourcutEntry,
  readFourcut,
} from "@/lib/fourcut";

/**
 * GET /api/fourcut/[code] → `{fourcut, progress, cuts, frame}`
 *
 * 네컷 타임이 안 돌고 있으면 fourcut:null — 화면은 버튼을 숨기면 된다.
 * frame 은 room.id + 시작 시각으로 시드한 결정적 조합이라 폴링해도 안 바뀐다.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ code: string }> },
) {
  try {
    const { code } = await params;
    const room = await getRoom(code);
    if (!room) return fail("방을 찾을 수 없어요. 방 코드를 다시 확인해 주세요.", 404);

    const session = readFourcut(room.state);
    if (!session) {
      return NextResponse.json({ fourcut: null, progress: null, cuts: [], frame: [] });
    }

    // 이번 세션분만. 지난 판의 네컷이 섞이면 프레임이 엉킨다.
    const { data } = await serverDb()
      .from("photos")
      .select("id, owner_id, url, caption, created_at")
      .eq("room_id", room.id)
      .eq("hidden", false)
      .gte("created_at", session.startedAt)
      .like("caption", "네컷 %")
      .order("created_at", { ascending: true });

    const deadline = Date.parse(session.deadline);
    const cuts = (data ?? []).flatMap((row) => {
      const cutIndex = cutIndexFromCaption(row.caption);
      if (cutIndex === null) return [];
      return [
        {
          id: row.id as string,
          ownerId: row.owner_id as string,
          cutIndex,
          url: row.url as string,
          caption: row.caption as string,
          late: Date.parse(row.created_at as string) > deadline,
        },
      ];
    });

    const entries: FourcutEntry[] = cuts
      .filter((c) => !c.late)
      .map(({ ownerId, cutIndex, url }) => ({ ownerId, cutIndex, url }));

    return NextResponse.json({
      fourcut: session,
      progress: cutProgress(session),
      cuts,
      frame: buildFrame(entries, `${room.id}:${session.startedAt}`),
    });
  } catch (error) {
    return fail(
      error instanceof Error ? error.message : "네컷 상황을 불러오지 못했어요. 다시 시도해 주세요.",
      500,
    );
  }
}
