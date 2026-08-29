/**
 * 프레임 목록 — 서버 라우트와 티켓 화면이 **같은 정의 하나**를 본다.
 *
 * 해금 판정은 `./rules.ts`. 화면 쪽 계산은 안내용이고, 실제 방어선은
 * `/api/ticket` 이 `board`·`invited_by` 로 다시 세는 것이다(J3).
 */

import { DEFAULT_FRAME, FRAMES, FRAME_IDS, type FrameId } from "@/lib/canvas/constants";

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
