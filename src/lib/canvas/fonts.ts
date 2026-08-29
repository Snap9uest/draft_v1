"use client";

/**
 * 티어다운 ⑲ — `document.fonts.load()` 는 "로드됨"을 보장하지 않는다.
 * @font-face 가 아예 정의돼 있지 않아도 빈 배열로 resolve 하고 throw 하지 않는다.
 * 실검증은 `fonts.check()` 로만 되고, load 에 넘긴 문자열은 ctx.font 에 쓸 것과
 * weight/size 까지 완전히 동일해야 같은 face 를 본다.
 */

/** 1순위 패밀리. @font-face 나 로컬 설치가 없으면 check() 가 false 가 되어 폴백된다. */
const PRIMARY = '"Pretendard Variable"';

/** globals.css 의 --font-sans 와 같은 스택. */
export const FALLBACK_STACK =
  'Pretendard, "Apple SD Gothic Neo", "Malgun Gothic", "Noto Sans KR", system-ui, -apple-system, sans-serif';

/** 폰트 때문에 티켓이 안 나오는 게 최악이다. 상한을 넘기면 폴백으로 그린다. */
const TIMEOUT_MS = 2500;

/** 한글 폰트는 서브셋에 따라 글자별로 갈린다 — 실제로 각인할 글자로 검사한다. */
const SAMPLE = "가나다보관SnapQuest0123";

/** ctx.font 문자열. load/check/그리기가 전부 이 함수 하나를 거친다. */
export function fontSpec(weight: number, sizePx: number, family: string): string {
  return `${weight} ${Math.round(sizePx)}px ${family}`;
}

export interface LoadedFont {
  /** ctx.font 의 family 자리에 그대로 넣는다. */
  family: string;
  usedFallback: boolean;
}

export async function loadTicketFont(
  specs: readonly { weight: number; size: number }[],
): Promise<LoadedFont> {
  const fallback: LoadedFont = { family: FALLBACK_STACK, usedFallback: true };
  if (typeof document === "undefined" || !document.fonts) return fallback;

  const strings = specs.map((s) => fontSpec(s.weight, s.size, PRIMARY));
  try {
    await Promise.race([
      Promise.all(strings.map((s) => document.fonts.load(s, SAMPLE))),
      new Promise<void>((resolve) => setTimeout(resolve, TIMEOUT_MS)),
    ]);
  } catch {
    // load() 가 거절해도 판정은 아래 check() 가 한다.
  }

  const ok = strings.every(check);
  if (!ok) {
    console.warn(
      `[SnapQuest] 티켓 웹폰트(${PRIMARY}) 검증 실패 — 기본 스택으로 각인합니다.`,
    );
  }
  return ok ? { family: `${PRIMARY}, ${FALLBACK_STACK}`, usedFallback: false } : fallback;
}

function check(spec: string): boolean {
  try {
    return document.fonts.check(spec, SAMPLE);
  } catch {
    return false; // 파싱 실패는 SyntaxError 로 던진다
  }
}
