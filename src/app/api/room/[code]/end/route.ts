import { NextResponse } from "next/server";
import { ROOM_COLS, serverDb } from "@/lib/db/client";
import { fail, hostRoom } from "@/lib/db/server";

/**
 * 종료 트리거 하나에 두 가지가 걸린다(티어다운 ㉓/31).
 *
 * ① `rooms.status = "ended"` — 참가자 폰이 이걸 보고 티켓 선점 렌더를 시작한다.
 * ② 단체 프레임 — 서버에는 Canvas 가 없으므로 **구성 데이터만** 계산해
 *    `rooms.state.group_frame` 에 넣고, 실제 합성은 TV(또는 첫 조회 클라이언트)가
 *    `src/lib/canvas/ticket.ts` 로 한다. 서버에서 억지로 이미지를 만들지 않는다.
 */
export interface GroupFrame {
  /** 득표 → 시각 순 상위 4장. 4컷 셀에 그대로 들어간다. */
  photoUrls: string[];
  members: { nickname: string; avatarUrl: string | null; title: string | null }[];
  roomName: string;
  endedAt: string;
  expiresAt: string;
}

const MAX_MEMBERS = 12;

/** POST /api/room/[code]/end — 호스트 전용. `{hostToken}` → `{room, groupFrame}` */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ code: string }> },
) {
  try {
    const { code } = await params;
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const room = await hostRoom(code, body.hostToken);
    if (!room) return fail("호스트 권한이 없습니다.", 403);

    const db = serverDb();
    const [photosRes, votesRes, peopleRes] = await Promise.all([
      db
        .from("photos")
        .select("id, url, created_at")
        .eq("room_id", room.id)
        .eq("hidden", false),
      db.from("votes").select("photo_id").eq("room_id", room.id),
      db
        .from("participants")
        .select("nickname, avatar_url, title, is_bot")
        .eq("room_id", room.id)
        .order("joined_at", { ascending: true }),
    ]);

    const tally = new Map<string, number>();
    for (const v of (votesRes.data ?? []) as { photo_id: string }[]) {
      tally.set(v.photo_id, (tally.get(v.photo_id) ?? 0) + 1);
    }
    const photos = ((photosRes.data ?? []) as {
      id: string;
      url: string;
      created_at: string;
    }[])
      .slice()
      .sort(
        (a, b) =>
          (tally.get(b.id) ?? 0) - (tally.get(a.id) ?? 0) ||
          Date.parse(a.created_at) - Date.parse(b.created_at),
      );

    const endedAt = new Date().toISOString();
    const groupFrame: GroupFrame = {
      photoUrls: photos.slice(0, 4).map((p) => p.url),
      members: ((peopleRes.data ?? []) as {
        nickname: string;
        avatar_url: string | null;
        title: string | null;
      }[])
        .slice(0, MAX_MEMBERS)
        .map((p) => ({
          nickname: p.nickname,
          avatarUrl: p.avatar_url,
          title: p.title,
        })),
      roomName: `${room.tone_preset} 파티`,
      endedAt,
      expiresAt: room.expires_at,
    };

    const { data, error } = await db
      .from("rooms")
      .update({
        status: "ended",
        ended_at: room.ended_at ?? endedAt,
        state: { ...(room.state ?? {}), group_frame: groupFrame },
      })
      .eq("id", room.id)
      .select(ROOM_COLS)
      .single();
    if (error) return fail(`파티 종료에 실패했습니다: ${error.message}`, 500);

    return NextResponse.json({ room: data, groupFrame });
  } catch (error) {
    return fail(error instanceof Error ? error.message : "파티 종료에 실패했습니다.", 500);
  }
}
