"use client";

/**
 * 방명록 — 벽에 붙은 색색의 쪽지.
 *
 * 방 전체 앞 쪽지와 특정 사람 앞 쪽지가 한 벽에 같이 붙는다. 내가 받은 것만
 * 따로 모아 보는 토글이 있고, 그게 파티 다음 날 앨범을 다시 여는 이유가 된다.
 * 쓰기는 전부 /api/notes 를 거치고, 읽기는 anon 조회(실패 시 서버 폴백).
 */

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import type { Participant } from "@/lib/db/types";
import {
  DEFAULT_NOTE_COLOR,
  getNotes,
  isNoteColor,
  NOTE_BODY_MAX,
  NOTE_COLOR_LABEL,
  NOTE_COLOR_STYLE,
  NOTE_COLORS,
  type Note,
  type NoteColor,
} from "@/lib/notes";
import { getHostToken, getSessionToken } from "@/lib/session";

/** 실시간 채널 없이 주기 조회로 따라간다 — 벽이라 몇 초 늦어도 된다. */
const REFRESH_MS = 10_000;

const NO_SUBSCRIBE = () => () => {};

export default function Guestbook({
  roomId,
  roomCode,
  participants,
  me,
}: {
  roomId: string;
  roomCode: string;
  participants: Participant[];
  me: Participant | null;
}) {
  const [notes, setNotes] = useState<Note[]>([]);
  const [scope, setScope] = useState<"all" | "mine">("all");
  const [body, setBody] = useState("");
  const [color, setColor] = useState<NoteColor>(DEFAULT_NOTE_COLOR);
  const [toId, setToId] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  // localStorage 는 서버 렌더에 없다 — 수화 후에만 읽는다. 있으면 호스트다.
  const hostToken = useSyncExternalStore(
    NO_SUBSCRIBE,
    () => getHostToken(roomCode),
    () => null,
  );

  const load = useCallback(async () => {
    setNotes(await getNotes({ id: roomId, code: roomCode }));
  }, [roomId, roomCode]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 마운트 시 최초 조회
    void load();
    const t = setInterval(() => void load(), REFRESH_MS);
    return () => clearInterval(t);
  }, [load]);

  const nameOf = (id: string) =>
    participants.find((p) => p.id === id)?.nickname ?? "누군가";

  const toMe = me ? notes.filter((n) => n.to_id === me.id) : [];
  const shown = scope === "mine" ? toMe : notes;
  const left = NOTE_BODY_MAX - body.length;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const text = body.trim();
    if (!text) {
      setMessage("한 글자라도 남겨 주세요.");
      return;
    }
    setBusy(true);
    setMessage("");
    try {
      const res = await fetch("/api/notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          roomCode,
          sessionToken: getSessionToken(),
          toId: toId || null,
          body: text,
          color,
        }),
      });
      const json = (await res.json().catch(() => ({}))) as {
        note?: Note;
        error?: string;
      };
      if (!res.ok || !json.note) {
        throw new Error(json.error ?? "쪽지를 남기지 못했어요. 다시 시도해 주세요.");
      }
      setNotes((prev) => [json.note as Note, ...prev]);
      setBody("");
      setMessage("쪽지를 붙였어요.");
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "쪽지를 남기지 못했어요. 다시 시도해 주세요.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function hide(id: string) {
    setMessage("");
    try {
      const res = await fetch(`/api/notes/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hostToken, hidden: true }),
      });
      if (!res.ok) throw new Error();
      setNotes((prev) => prev.filter((n) => n.id !== id));
      setMessage("쪽지를 내렸어요.");
    } catch {
      setMessage("쪽지를 내리지 못했어요. 다시 눌러 주세요.");
    }
  }

  return (
    <div className="space-y-4 px-4 pb-4 text-ink">
      <div className="flex rounded-full bg-surface-variant p-1">
        {(["all", "mine"] as const).map((s) => (
          <button
            key={s}
            type="button"
            aria-pressed={scope === s}
            data-testid={`notes-${s}`}
            onClick={() => setScope(s)}
            className={`min-h-11 flex-1 rounded-full px-3 text-sm font-semibold ${
              scope === s ? "bg-brand-pink-hot text-ink" : "text-ink-body"
            }`}
          >
            {s === "all" ? `벽에 붙은 쪽지 ${notes.length}개` : `나에게 온 쪽지 ${toMe.length}개`}
          </button>
        ))}
      </div>

      {me ? (
        <form onSubmit={submit} className="rounded-3xl bg-card p-4 shadow-clay">
          <label htmlFor="note-body" className="block text-sm font-bold">
            쪽지 남기기
          </label>
          <textarea
            id="note-body"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={3}
            maxLength={NOTE_BODY_MAX}
            aria-describedby="note-left"
            placeholder="오늘 고마웠어요, 다음에 또 봐요!"
            className="mt-2 w-full rounded-2xl bg-card-plain px-4 py-3 text-base text-ink outline-none focus:ring-2 focus:ring-brand-pink"
          />
          <p id="note-left" className="mt-1 text-right text-xs text-ink-muted">
            {left}자 더 쓸 수 있어요
          </p>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold text-ink-body">쪽지 색</span>
            {NOTE_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                aria-label={`쪽지 색 ${NOTE_COLOR_LABEL[c]}`}
                aria-pressed={color === c}
                onClick={() => setColor(c)}
                style={{ background: NOTE_COLOR_STYLE[c].bg }}
                className={`size-11 rounded-full ${
                  color === c ? "ring-2 ring-ink ring-offset-2 ring-offset-card" : ""
                }`}
              />
            ))}
          </div>

          <div className="mt-3">
            <label htmlFor="note-to" className="block text-xs font-semibold text-ink-body">
              누구에게 남길까요
            </label>
            <select
              id="note-to"
              value={toId}
              onChange={(e) => setToId(e.target.value)}
              className="mt-1 min-h-12 w-full rounded-2xl bg-card-plain px-3 text-base text-ink"
            >
              <option value="">파티 전체에게</option>
              {participants
                .filter((p) => p.id !== me.id)
                .map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nickname}님에게
                  </option>
                ))}
            </select>
          </div>

          <button
            type="submit"
            disabled={busy || !body.trim()}
            className="mt-3 min-h-12 w-full rounded-full bg-primary px-6 text-base font-bold text-on-primary disabled:opacity-50"
          >
            {busy ? "붙이는 중이에요…" : "벽에 붙이기"}
          </button>
        </form>
      ) : (
        <p className="rounded-2xl bg-card px-4 py-3 text-sm text-ink-body">
          쪽지는 파티에 입장한 사람만 남길 수 있어요. 읽는 건 누구나 할 수 있어요.
        </p>
      )}

      {message && (
        <p role="status" className="text-sm font-semibold text-ink-body">
          {message}
        </p>
      )}

      {shown.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-hairline px-4 py-10 text-center text-sm text-ink-muted">
          {scope === "mine"
            ? "아직 나에게 온 쪽지가 없어요. 먼저 한 장 남기면 답장이 붙어요."
            : "아직 벽이 비어 있어요. 첫 쪽지를 붙여 볼까요?"}
        </p>
      ) : (
        <ul className="columns-2 gap-2">
          {shown.map((note, i) => {
            const c = isNoteColor(note.color) ? note.color : DEFAULT_NOTE_COLOR;
            return (
              <li
                key={note.id}
                data-testid="note-card"
                className="mb-2 break-inside-avoid rounded-2xl p-3 shadow-clay"
                style={{
                  background: NOTE_COLOR_STYLE[c].bg,
                  color: NOTE_COLOR_STYLE[c].ink,
                  transform: i % 2 ? "rotate(-1.2deg)" : "rotate(1deg)",
                }}
              >
                <p className="text-sm leading-relaxed whitespace-pre-wrap">{note.body}</p>
                <p className="mt-2 text-[11px] font-semibold opacity-80">
                  {nameOf(note.from_id)} →{" "}
                  {note.to_id ? `${nameOf(note.to_id)}님께` : "파티 전체에게"}
                </p>
                {hostToken && (
                  <button
                    type="button"
                    onClick={() => void hide(note.id)}
                    className="mt-2 min-h-11 w-full rounded-full bg-black/10 text-xs font-semibold"
                  >
                    이 쪽지 내리기
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
