/**
 * 프레임 목록과 해금 규칙 — 서버 라우트와 티켓 화면이 **같은 정의 하나**를 본다.
 *
 * 해금은 화면에서 계산한 값을 절대 신뢰하지 않는다(J3). 화면 쪽 계산은 안내용이고,
 * 실제 방어선은 `/api/ticket` 이 `board`·`invited_by` 로 다시 세는 것이다.
 */

// frames.test.mjs 가 node 로 단독 로드할 수 있게 relative import 만 쓴다.
import {
  DEFAULT_FRAME,
  FRAMES,
  FRAME_IDS,
  type FrameId,
} from "../../../lib/canvas/constants";
import { completedLines, type BoardCell } from "../../../lib/db/types";

/** 기본 3종 무료 + 잠금 1종. 결제·SNS 공유 해금 경로는 없다. */
export const GOLD = "gold";
export type TicketFrame = FrameId | typeof GOLD;

export const TICKET_FRAMES: readonly TicketFrame[] = [...FRAME_IDS, GOLD];
export const DEFAULT_TICKET_FRAME: TicketFrame = DEFAULT_FRAME;

const LOCKED: readonly TicketFrame[] = [GOLD];
export const isLocked = (frame: TicketFrame): boolean => LOCKED.includes(frame);

export const FRAME_LABEL: Record<TicketFrame, string> = {
  ...(Object.fromEntries(FRAME_IDS.map((id) => [id, FRAMES[id].label])) as Record<
    FrameId,
    string
  >),
  [GOLD]: "골드",
};

/** gold 는 별도 팔레트가 아니라 film 위에 얹는 금박 오버레이다(ticket.ts 는 건드리지 않는다). */
export const baseFrame = (frame: TicketFrame): FrameId =>
  frame === GOLD ? "film" : frame;

/** 신뢰 경계: 요청 본문·쿼리에서 온 값은 반드시 이걸 통과해야 한다. */
export function parseFrame(v: unknown): TicketFrame | null {
  return typeof v === "string" && (TICKET_FRAMES as readonly string[]).includes(v)
    ? (v as TicketFrame)
    : null;
}

export interface UnlockState {
  /** 완성한 빙고 줄 수 */
  bingoLines: number;
  /** 내 초대 링크로 입장한 사람 수 */
  invited: number;
  unlocked: boolean;
}

/** 해금 2경로: 빙고 1줄 **또는** 초대 링크로 1명 입장. */
export function unlockState(
  board: BoardCell[] | null | undefined,
  invited: number,
): UnlockState {
  const bingoLines = completedLines(Array.isArray(board) ? board : []);
  const n = Number.isFinite(invited) ? Math.max(0, Math.trunc(invited)) : 0;
  return { bingoLines, invited: n, unlocked: bingoLines >= 1 || n >= 1 };
}

/* ── 슬롯 선택 ── */

/**
 * 슬롯별 교체·스왑. `slice(0,4)` 로 잘라 넣지 않는다(P1).
 *
 * 목록은 항상 앞에서부터 채워진 상태를 유지한다 — `compose()` 가 null 을 걸러
 * 앞으로 당기므로, 여기서 빈 칸을 남겨두면 **미리보기와 출력이 어긋난다**(P3).
 */
export function placePick(picks: string[], slot: number, photoId: string): string[] {
  if (!photoId || slot < 0 || slot > 3) return picks;
  const next = picks.slice(0, 4);
  const at = next.indexOf(photoId);
  if (at === slot) return picks;
  if (at >= 0) {
    if (slot < next.length) {
      next[at] = next[slot];
      next[slot] = photoId;
    } else {
      next.splice(at, 1);
      next.push(photoId);
    }
    return next;
  }
  if (slot < next.length) next[slot] = photoId;
  else if (next.length < 4) next.push(photoId);
  return next;
}

/** 비운 칸은 빈칸으로 남지 않고 뒤 사진이 당겨온다 — 남는 칸은 캐릭터·칭호 카드가 채운다. */
export function clearPick(picks: string[], slot: number): string[] {
  return picks.filter((_, i) => i !== slot);
}
