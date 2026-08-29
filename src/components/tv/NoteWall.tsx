"use client";

/** TV 방명록 — 포토월과 번갈아 뜨는 쪽지 벽. 표시 전용. */

import type { Participant } from "@/lib/db/types";
import {
  DEFAULT_NOTE_COLOR,
  isNoteColor,
  NOTE_COLOR_STYLE,
  type Note,
} from "@/lib/notes";

export default function NoteWall({
  notes,
  participants,
}: {
  notes: Note[];
  participants: Participant[];
}) {
  const nameOf = (id: string) =>
    participants.find((p) => p.id === id)?.nickname ?? "누군가";

  return (
    <>
      <h2 className="mb-[2vh] text-[clamp(1.25rem,2.4vw,2.75rem)] text-white/50">
        방금 붙은 쪽지 · 폰에서 방명록 탭
      </h2>
      <ul className="grid flex-1 content-start grid-cols-4 gap-[1.5vw]">
        {notes.slice(0, 8).map((note, i) => {
          const c = isNoteColor(note.color) ? note.color : DEFAULT_NOTE_COLOR;
          return (
            <li
              key={note.id}
              className="sq-pop rounded-3xl p-[1.4vw]"
              style={{
                background: NOTE_COLOR_STYLE[c].bg,
                color: NOTE_COLOR_STYLE[c].ink,
                transform: i % 2 ? "rotate(-1.4deg)" : "rotate(1.1deg)",
              }}
            >
              <p className="line-clamp-6 text-[clamp(1rem,1.5vw,2rem)] leading-snug font-semibold whitespace-pre-wrap">
                {note.body}
              </p>
              <p className="mt-[1vh] text-[clamp(.8rem,1.1vw,1.4rem)] font-bold opacity-80">
                {nameOf(note.from_id)} →{" "}
                {note.to_id ? `${nameOf(note.to_id)}님께` : "파티 전체에게"}
              </p>
            </li>
          );
        })}
      </ul>
    </>
  );
}
