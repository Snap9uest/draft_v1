/* 방명록(쪽지). 팔레트 상수 + 브라우저 조회 헬퍼. 쓰기는 전부 /api/notes 를 거친다. */

/** anon 이 select 권한을 가진 컬럼과 정확히 같다 (0003_notes.sql). */
export const NOTE_COLS =
  "id, room_id, from_id, to_id, body, color, hidden, created_at";

export const NOTE_COLORS = ["peach", "lavender", "ochre", "pink"] as const;
export type NoteColor = (typeof NOTE_COLORS)[number];
export const DEFAULT_NOTE_COLOR: NoteColor = "peach";

/** 색 고르기 버튼의 이름(aria-label 겸용) — 색만으로는 고를 수 없는 사람이 있다. */
export const NOTE_COLOR_LABEL: Record<NoteColor, string> = {
  peach: "복숭아",
  lavender: "라벤더",
  ochre: "노랑",
  pink: "분홍",
};

/** 쪽지 배경/글자색. 대비는 전부 7:1 이상. */
export const NOTE_COLOR_STYLE: Record<NoteColor, { bg: string; ink: string }> = {
  peach: { bg: "#FFE1CE", ink: "#5A3218" },
  lavender: { bg: "#E5DDF8", ink: "#3A2C5E" },
  ochre: { bg: "#F8E2AC", ink: "#584112" },
  pink: { bg: "#FBD6E4", ink: "#5D2540" },
};

export const NOTE_BODY_MAX = 300;
/** 같은 사람이 같은 대상에게 연달아 남기는 도배를 막는 간격. */
export const NOTE_COOLDOWN_MS = 30_000;
/** 한 화면에 붙는 쪽지 상한. 파티 하나가 폰 메모리를 다 먹지 않게. */
export const NOTE_LIMIT = 200;

/** notes 한 줄 (supabase/migrations/0003_notes.sql). to_id 가 null 이면 방 전체 앞. */
export interface Note {
  id: string;
  room_id: string;
  from_id: string;
  to_id: string | null;
  body: string;
  color: string;
  hidden: boolean;
  created_at: string;
}

export const isNoteColor = (v: unknown): v is NoteColor =>
  NOTE_COLORS.includes(v as NoteColor);

/**
 * 앞뒤 공백을 털고 길이를 본다. 규격 밖이면 null.
 * JS 의 .length 는 이모지를 2로 세므로 DB 의 char_length 보다 항상 엄격하다 —
 * 여기를 통과한 문구가 DB 제약에 걸릴 일은 없다.
 */
export function normalizeNoteBody(raw: unknown): string | null {
  const body = typeof raw === "string" ? raw.trim() : "";
  return body && body.length <= NOTE_BODY_MAX ? body : null;
}

/** 직전 쪽지 시각으로 도배를 판정한다. 시각을 못 읽으면 막지 않는다. */
export function noteTooSoon(
  lastCreatedAt: string | null | undefined,
  now: number = Date.now(),
): boolean {
  if (!lastCreatedAt) return false;
  const t = Date.parse(lastCreatedAt);
  return Number.isFinite(t) && now - t < NOTE_COOLDOWN_MS;
}

/** 직접 읽기가 막혔을 때의 우회로 — 서버 라우트는 service role 로 읽는다. */
async function fetchNotesFromApi(
  roomCode: string,
  toId?: string | null,
): Promise<Note[]> {
  try {
    const q = new URLSearchParams({ roomCode: roomCode.toUpperCase() });
    if (toId) q.set("toId", toId);
    const res = await fetch(`/api/notes?${q}`);
    if (!res.ok) return [];
    const { notes } = (await res.json()) as { notes?: Note[] };
    return notes ?? [];
  } catch (error) {
    console.error("[SnapQuest] 방명록(서버 경유) 조회 실패:", error);
    return [];
  }
}

/**
 * 쪽지 목록(숨김 제외, 최신순). toId 를 주면 그 사람 앞으로 온 것만.
 * 실패해도 빈 목록으로 흡수한다 — 방명록이 앨범 화면을 깨뜨리지 않는다.
 */
export async function getNotes(
  room: { id: string; code: string },
  toId?: string | null,
): Promise<Note[]> {
  try {
    // 클라이언트만 쓰는 경로라 그때 불러온다 — 덕분에 이 파일은 supabase 없이도
    // 로드돼서 rules.test.mjs 가 순수 판정부만 단독으로 검증할 수 있다.
    const { browserDb } = await import("./db/client");
    const base = browserDb()
      .from("notes")
      .select(NOTE_COLS)
      .eq("room_id", room.id)
      .eq("hidden", false);
    const scoped = toId ? base.eq("to_id", toId) : base;
    const { data, error } = await scoped
      .order("created_at", { ascending: false })
      .limit(NOTE_LIMIT);
    if (error) throw error;
    return (data ?? []) as Note[];
  } catch (error) {
    console.error("[SnapQuest] 방명록 조회 실패:", error);
    return fetchNotesFromApi(room.code, toId);
  }
}
