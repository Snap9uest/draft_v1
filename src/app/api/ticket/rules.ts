/**
 * 해금 판정과 슬롯 선택 규칙 — 의존성 0.
 *
 * import 가 하나도 없어야 `rules.test.mjs` 가 node 로 단독 로드할 수 있다.
 * 빙고 줄 수는 `completedLines()`(src/lib/db/types.ts)로 세서 넘긴다 — 여기서
 * 다시 구현하지 않는다.
 */

export interface UnlockState {
  /** 완성한 빙고 줄 수 */
  bingoLines: number;
  /** 내 초대 링크로 입장한 사람 수 */
  invited: number;
  unlocked: boolean;
}

/** 해금 2경로: 빙고 1줄 **또는** 초대 링크로 1명 입장. 결제·SNS 공유 경로는 없다. */
export function unlockState(bingoLines: number, invited: number): UnlockState {
  const lines = count(bingoLines);
  const people = count(invited);
  return { bingoLines: lines, invited: people, unlocked: lines >= 1 || people >= 1 };
}

/** 망가진 입력이 열쇠가 되지 않게 음수·NaN·소수를 여기서 정리한다. */
const count = (n: unknown): number =>
  typeof n === "number" && Number.isFinite(n) ? Math.max(0, Math.trunc(n)) : 0;

/** 티켓 4컷. */
export const SLOTS = 4;

/**
 * 슬롯별 교체·스왑. `slice(0,4)` 로 잘라 넣지 않는다(P1).
 *
 * 목록은 항상 앞에서부터 채워진 상태를 유지한다 — `compose()` 가 빈 자리를 걸러
 * 앞으로 당기므로, 여기서 구멍을 남기면 **미리보기와 출력이 어긋난다**(P3).
 */
export function placePick(picks: string[], slot: number, photoId: string): string[] {
  if (!photoId || !Number.isInteger(slot) || slot < 0 || slot >= SLOTS) return picks;
  const next = picks.slice(0, SLOTS);
  const at = next.indexOf(photoId);
  if (at === slot) return picks;
  if (at >= 0) {
    // 이미 다른 칸에 있으면 두 칸을 맞바꾼다
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
  else if (next.length < SLOTS) next.push(photoId);
  return next;
}

/** 비운 칸은 빈칸으로 남지 않고 뒤 사진이 당겨온다 — 남는 칸은 캐릭터·칭호 카드가 채운다. */
export function clearPick(picks: string[], slot: number): string[] {
  return picks.filter((_, i) => i !== slot);
}
