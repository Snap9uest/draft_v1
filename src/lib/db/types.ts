/* Row shapes for the tables in supabase/migrations/0001_init.sql. */

export type RoomStatus = "lobby" | "live" | "award" | "ended";
export type VerifyStatus = "pending" | "ai_pass" | "self_check";
export type CellStatus = "todo" | "judging" | "done";

/** One of the nine squares on a guest's board. */
export interface BoardCell {
  mission: string;
  status: CellStatus;
  photoId?: string;
  caption?: string;
}

export interface Room {
  id: string;
  code: string;
  tone_preset: string;
  reward_on: boolean;
  status: RoomStatus;
  /** Transient broadcast blob: countdown, current award step, and the like. */
  state: Record<string, unknown>;
  is_demo: boolean;
  created_at: string;
  ended_at: string | null;
  expires_at: string;
}

export interface Participant {
  id: string;
  room_id: string;
  nickname: string;
  intro: string;
  avatar_url: string | null;
  avatar_is_ai: boolean;
  invited_by: string | null;
  is_bot: boolean;
  board: BoardCell[];
  title: string | null;
  title_basis: string | null;
  ticket_url: string | null;
  ticket_frame: string | null;
  joined_at: string;
}

export interface Photo {
  id: string;
  room_id: string;
  owner_id: string;
  cell_index: number | null;
  url: string;
  caption: string;
  mc_reaction: string | null;
  verify_status: VerifyStatus;
  hidden: boolean;
  created_at: string;
}

export interface Vote {
  voter_id: string;
  photo_id: string;
  room_id: string;
  created_at: string;
}

/** A board counts as won once any row, column, or diagonal is complete. */
export const BINGO_LINES: readonly (readonly number[])[] = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8],
  [0, 3, 6], [1, 4, 7], [2, 5, 8],
  [0, 4, 8], [2, 4, 6],
];

export function completedLines(board: BoardCell[]): number {
  return BINGO_LINES.filter((line) =>
    line.every((i) => board[i]?.status === "done"),
  ).length;
}
