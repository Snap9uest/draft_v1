import { NextResponse } from "next/server";
import { serverDb } from "@/lib/db/client";
import { fail, getRoom, str } from "@/lib/db/server";
import {
  DEFAULT_NOTE_COLOR,
  isNoteColor,
  NOTE_BODY_MAX,
  NOTE_COLS,
  NOTE_LIMIT,
  noteTooSoon,
  normalizeNoteBody,
} from "@/lib/notes";

/**
 * POST /api/notes
 * `{roomCode, sessionToken, toId?, body, color?}` → `{note}`
 *
 * toId 를 빼면 방 전체 앞으로 남는다. 같은 사람이 같은 대상에게 30초 안에
 * 또 쓰는 건 막는다 — 방명록이 도배판이 되면 아무도 다시 열어보지 않는다.
 */
export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;

    const roomCode = str(body.roomCode).trim();
    const sessionToken = str(body.sessionToken).trim();
    if (!roomCode || !sessionToken) {
      return fail("입장 정보가 없어요. 다시 입장한 뒤 남겨 주세요.");
    }

    const text = normalizeNoteBody(body.body);
    if (!text) return fail(`한 글자부터 ${NOTE_BODY_MAX}자까지 남길 수 있어요.`);

    const color =
      body.color === undefined || body.color === null ? DEFAULT_NOTE_COLOR : body.color;
    if (!isNoteColor(color)) return fail("그 색은 고를 수 없어요. 네 가지 색 중에서 골라 주세요.");

    const room = await getRoom(roomCode);
    if (!room) return fail("방을 찾을 수 없어요. 방 코드를 다시 확인해 주세요.", 404);

    const db = serverDb();
    const { data: author } = await db
      .from("participants")
      .select("id")
      .eq("room_id", room.id)
      .eq("session_token", sessionToken)
      .maybeSingle();
    if (!author) return fail("먼저 파티에 입장해 주세요.", 403);

    const toId = str(body.toId).trim() || null;
    if (toId) {
      const { data: target } = await db
        .from("participants")
        .select("id")
        .eq("id", toId)
        .eq("room_id", room.id)
        .maybeSingle();
      if (!target) return fail("그 사람을 찾을 수 없어요. 목록에서 다시 골라 주세요.", 404);
    }

    const mine = db.from("notes").select("created_at").eq("from_id", author.id);
    const { data: last } = await (toId ? mine.eq("to_id", toId) : mine.is("to_id", null))
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (noteTooSoon(last?.created_at as string | undefined)) {
      return fail("방금 남겼어요. 30초 뒤에 한 장 더 남길 수 있어요.", 429);
    }

    const { data: note, error } = await db
      .from("notes")
      .insert({
        room_id: room.id,
        from_id: author.id,
        to_id: toId,
        body: text,
        color,
      })
      .select(NOTE_COLS)
      .single();
    if (error || !note) return fail("쪽지를 남기지 못했어요. 다시 시도해 주세요.", 500);

    return NextResponse.json({ note });
  } catch (error) {
    return fail(
      error instanceof Error ? error.message : "쪽지를 남기지 못했어요. 다시 시도해 주세요.",
      500,
    );
  }
}

/**
 * GET /api/notes?roomCode=&toId= → `{notes}`
 * toId 를 빼면 방의 쪽지 전부. 숨김 처리분은 빼고 최신순.
 */
export async function GET(request: Request) {
  try {
    const params = new URL(request.url).searchParams;
    const roomCode = (params.get("roomCode") ?? "").trim();
    if (!roomCode) return fail("방 코드가 없어요. 방 링크로 다시 들어와 주세요.");

    const room = await getRoom(roomCode);
    if (!room) return fail("방을 찾을 수 없어요. 방 코드를 다시 확인해 주세요.", 404);

    const toId = (params.get("toId") ?? "").trim();
    const base = serverDb()
      .from("notes")
      .select(NOTE_COLS)
      .eq("room_id", room.id)
      .eq("hidden", false);
    const { data } = await (toId ? base.eq("to_id", toId) : base)
      .order("created_at", { ascending: false })
      .limit(NOTE_LIMIT);

    return NextResponse.json({ notes: data ?? [] });
  } catch (error) {
    return fail(
      error instanceof Error ? error.message : "방명록을 불러오지 못했어요. 다시 시도해 주세요.",
      500,
    );
  }
}
