/**
 * F5 네컷 타임 — 순수 계산만. import 0(서버·브라우저 양쪽에서 그대로 쓴다).
 *
 * 세션 상태는 rooms.state.fourcut 한 곳에만 산다. 파티당 한 번 도는 일시적
 * 상태라 테이블을 따로 두지 않는다. 진행 상황(지금 몇 컷인지, 몇 초 남았는지)은
 * 저장하지 않고 startedAt 하나에서 계산한다 — 폰과 TV 가 각자 계산해도 같은
 * 값이 나오고, 중간에 접속한 사람도 바로 따라붙는다.
 */

/** 컷 수. 프레임 칸 수와 같다. */
export const CUT_COUNT = 4;

/** 1컷 시작 전 카운트다운. */
export const COUNTDOWN_MS = 5_000;

/** 컷 하나에 주는 시간(포즈 확인 + 촬영). */
export const CUT_MS = 7_000;

/** 시작부터 마감까지. */
export const SESSION_MS = COUNTDOWN_MS + CUT_COUNT * CUT_MS;

/** 프리셋 포즈. 생성형 호출 0 — 원가 0, 실패 없음. */
export const POSE_MISSIONS: readonly string[] = [
  "양손으로 브이를 그려요",
  "볼에 손 올리고 고개를 갸웃해요",
  "손가락 하트를 카메라에 바짝 붙여요",
  "제일 놀란 표정을 지어요",
  "두 손 엄지척을 올려요",
  "눈 감고 제일 크게 웃어요",
  "한 손으로 얼굴 반을 가려요",
  "옆 사람 쪽으로 몸을 기울여요",
  "머리 위로 큰 하트를 만들어요",
  "제일 웃긴 표정을 지어요",
  "손으로 선글라스를 만들어 껴요",
  "박수 치는 순간을 찍어요",
];

/** rooms.state.fourcut 에 그대로 들어가는 모양. */
export interface FourcutSession {
  /** ISO. 모든 진행 계산의 기준점. */
  startedAt: string;
  /** 컷 순서대로 4개. */
  cutMissions: string[];
  /** ISO. 이 시각 뒤 도착분은 프레임에 못 들어가고 갤러리에만 남는다. */
  deadline: string;
}

export type FourcutPhase = "countdown" | "shooting" | "done";

export interface FourcutProgress {
  phase: FourcutPhase;
  /** 지금 찍을 컷(0~3). done 이면 CUT_COUNT. */
  cutIndex: number;
  /** 이 컷의 포즈. done 이면 빈 문자열. */
  mission: string;
  /** 다음 단계까지 남은 초(올림). done 이면 0. */
  secondsLeft: number;
}

/* ── 결정적 셔플 ───────────────────────────────────────────────────────── */

function hash(seed: string): number {
  let h = 2166136261;
  for (const ch of seed) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return h >>> 0;
}

/** mulberry32. 시드가 같으면 언제 어디서 돌려도 같은 수열이 나온다. */
function rng(seed: string): () => number {
  let s = hash(seed);
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** 원본을 건드리지 않는 Fisher-Yates. 같은 시드 = 같은 결과. */
export function shuffleSeeded<T>(items: readonly T[], seed: string): T[] {
  const out = [...items];
  const next = rng(seed);
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(next() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/* ── 세션 ─────────────────────────────────────────────────────────────── */

export function pickCutMissions(seed: string): string[] {
  return shuffleSeeded(POSE_MISSIONS, seed).slice(0, CUT_COUNT);
}

export function startSession(seed: string, now: Date = new Date()): FourcutSession {
  return {
    startedAt: now.toISOString(),
    cutMissions: pickCutMissions(`${seed}:${now.getTime()}`),
    deadline: new Date(now.getTime() + SESSION_MS).toISOString(),
  };
}

/** rooms.state 는 아무 JSON 이나 들어갈 수 있는 칸이라 읽을 때 모양을 검사한다. */
export function readFourcut(state: unknown): FourcutSession | null {
  const raw = (state as Record<string, unknown> | null)?.fourcut;
  if (!raw || typeof raw !== "object") return null;
  const { startedAt, cutMissions, deadline } = raw as Record<string, unknown>;
  if (typeof startedAt !== "string" || Number.isNaN(Date.parse(startedAt))) return null;
  if (typeof deadline !== "string" || Number.isNaN(Date.parse(deadline))) return null;
  if (!Array.isArray(cutMissions) || cutMissions.length !== CUT_COUNT) return null;
  if (!cutMissions.every((m) => typeof m === "string")) return null;
  return { startedAt, cutMissions: cutMissions as string[], deadline };
}

export function cutProgress(
  session: FourcutSession,
  now: Date = new Date(),
): FourcutProgress {
  const elapsed = now.getTime() - Date.parse(session.startedAt);

  if (elapsed < COUNTDOWN_MS) {
    return {
      phase: "countdown",
      cutIndex: 0,
      mission: session.cutMissions[0] ?? "",
      secondsLeft: Math.max(0, Math.ceil((COUNTDOWN_MS - elapsed) / 1000)),
    };
  }

  const cutIndex = Math.floor((elapsed - COUNTDOWN_MS) / CUT_MS);
  if (cutIndex >= CUT_COUNT) {
    return { phase: "done", cutIndex: CUT_COUNT, mission: "", secondsLeft: 0 };
  }
  const cutEnd = COUNTDOWN_MS + (cutIndex + 1) * CUT_MS;
  return {
    phase: "shooting",
    cutIndex,
    mission: session.cutMissions[cutIndex] ?? "",
    secondsLeft: Math.max(0, Math.ceil((cutEnd - elapsed) / 1000)),
  };
}

/* ── photos 귀속 ──────────────────────────────────────────────────────── */

/**
 * 네컷 사진도 그냥 photos 행이다(cell_index 는 null — 자유 사진 취급).
 * 컬럼을 늘리지 않으려고 컷 번호를 caption 에 적는다.
 */
export const cutCaption = (cutIndex: number, mission: string): string =>
  `네컷 ${cutIndex + 1}컷 · ${mission}`.slice(0, 120);

/** 캡션에서 컷 번호(0~3)를 되읽는다. 네컷 사진이 아니면 null. */
export function cutIndexFromCaption(caption: unknown): number | null {
  const m = typeof caption === "string" ? caption.match(/^네컷 ([1-4])컷 ·/) : null;
  return m ? Number(m[1]) - 1 : null;
}

/* ── 합동 프레임 ──────────────────────────────────────────────────────── */

export interface FourcutEntry {
  ownerId: string;
  cutIndex: number;
  url: string;
}

export interface FrameSlot {
  cutIndex: number;
  /** 빈 칸이면 "" — 화면이 캐릭터 카드로 채운다. */
  ownerId: string;
  url: string | null;
}

/**
 * 컷마다 다른 사람을 뽑아 한 프레임을 만든다. 시드가 같으면 결과도 같다 —
 * 폴링할 때마다 프레임이 갈아엎어지면 아무도 못 본다.
 *
 * 4명이 안 되면 같은 사람이 여러 칸에 들어가고, 그 컷을 아무도 안 찍었으면
 * 그 사람의 다른 컷으로 채운다. 그것도 없으면 url:null 을 돌려 화면이
 * 캐릭터 카드를 넣게 한다. 인원이 적다고 프레임이 안 나오면 안 된다.
 */
export function buildFrame(entries: readonly FourcutEntry[], seed: string): FrameSlot[] {
  const empty = (cutIndex: number): FrameSlot => ({ cutIndex, ownerId: "", url: null });
  if (!entries.length) return Array.from({ length: CUT_COUNT }, (_, i) => empty(i));

  const owners = shuffleSeeded([...new Set(entries.map((e) => e.ownerId))], seed);

  return Array.from({ length: CUT_COUNT }, (_, cutIndex) => {
    // 이 컷을 실제로 찍은 사람 중, 셔플 순서상 이 칸에 가장 가까운 사람.
    for (let step = 0; step < owners.length; step++) {
      const ownerId = owners[(cutIndex + step) % owners.length];
      const hit = entries.find((e) => e.ownerId === ownerId && e.cutIndex === cutIndex);
      if (hit) return { cutIndex, ownerId, url: hit.url };
    }
    // 아무도 안 찍은 컷 — 이 칸 담당자의 다른 컷으로 때운다.
    const ownerId = owners[cutIndex % owners.length];
    const alt =
      entries.find((e) => e.ownerId === ownerId) ?? entries[cutIndex % entries.length];
    return alt ? { cutIndex, ownerId: alt.ownerId, url: alt.url } : empty(cutIndex);
  });
}
