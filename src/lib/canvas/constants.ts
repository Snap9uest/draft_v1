/**
 * 티켓 합성 규격 — Picapica 비율(docs/reference_teardown.md 3-A/3-B)을 1080×1920 에 이식.
 *
 * 절대 픽셀을 코드에 박지 않는다. 전부 W 비율에서 파생한다.
 * (Picapica 는 스티커 좌표를 `x + width - 160` 으로 박아서 세로 레이아웃에서
 *  스티커가 사진 한가운데로 들어오는 버그를 냈다 — P9.)
 *
 * 순수 계산(레이아웃·중앙크롭·각인 문자열)은 전부 이 파일에 둔다.
 * ticket.test.mjs 가 relative import 없이 이 파일 하나만 로드할 수 있어야 하기 때문.
 */

/** 인스타 스토리 규격. 내보내기는 이 실픽셀, 화면 표시는 CSS 축소만. */
export const W = 1080;
export const H = 1920;

const px = (ratio: number) => Math.round(ratio * W);

/** 사방 여백 (Picapica 40/480) */
export const BORDER = px(0.083);
/** 컷 사이 간격 (15/480) */
export const SPACING = px(0.031);
/** 하단에만 BORDER 에 추가되는 "턱" (50/480). 하단/상단 = 2.25 가 인화물 느낌의 전부 */
export const LEDGE = px(0.104);
/** 각인 1행 글자 크기 */
export const CAPTION = px(0.042);
/** 각인 2행 글자 크기 (알파 0.5) */
export const MICRO = px(0.025);
/** 헤더(아바타·닉네임·칭호) 높이 */
export const HEADER = px(0.185);
/** 사진 셀 종횡비 (가로:세로) */
export const CELL_ASPECT = 4 / 3;

/** 좌우 여백이 정확히 대칭이 되도록 카드 폭을 캔버스에서 역산한다 (0.86W ≈ 928). */
const CARD_X = Math.round((W - px(0.86)) / 2);
export const CARD_W = W - CARD_X * 2;

export const CARD_RADIUS = px(0.033);
export const CELL_RADIUS = px(0.018);

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

const INNER_W = CARD_W - BORDER * 2;
/** 4컷 2×2 확정. 세로 4컷 스트립은 1:4.67 이라 1080×1920 에 산술적으로 안 들어간다. */
const CELL_W = Math.floor((INNER_W - SPACING) / 2);
const CELL_H = Math.round(CELL_W / CELL_ASPECT);
const GRID_H = CELL_H * 2 + SPACING;

/**
 * 헤더 + 상단 여백 + 4컷 + 하단 턱.
 * 턱은 BORDER 에 LEDGE 를 **더한 값 전체**다 — BORDER 를 한 번 더 얹으면
 * 하단/상단이 3.24 가 되어 네컷다움의 핵심 비율 2.25 가 깨진다.
 */
const CARD_H = HEADER + BORDER + GRID_H + (BORDER + LEDGE);
const CARD_Y = Math.round((H - CARD_H) / 2);
const GRID_X = CARD_X + BORDER;
const GRID_Y = CARD_Y + HEADER + BORDER;
const CARD_BOTTOM = CARD_Y + CARD_H;

export const LAYOUT = {
  card: { x: CARD_X, y: CARD_Y, w: CARD_W, h: CARD_H } as Rect,
  header: { x: CARD_X, y: CARD_Y, w: CARD_W, h: HEADER } as Rect,
  /** 0=좌상 1=우상 2=좌하 3=우하 */
  cells: [0, 1, 2, 3].map<Rect>((i) => ({
    x: GRID_X + (i % 2) * (CELL_W + SPACING),
    y: GRID_Y + Math.floor(i / 2) * (CELL_H + SPACING),
    w: CELL_W,
    h: CELL_H,
  })),
  /** 각인 1행: 가운데 정렬, 카드 바닥에서 BORDER 위 (Picapica 의 height-40) */
  caption: { x: CARD_X + Math.round(CARD_W / 2), y: CARD_BOTTOM - BORDER, size: CAPTION },
  /** 각인 2행: 우측 정렬, 카드 바닥에서 BORDER/2 위 (height-20) */
  micro: {
    x: CARD_X + CARD_W - BORDER,
    y: CARD_BOTTOM - Math.round(BORDER / 2),
    size: MICRO,
  },
} as const;

/** ctx.font 로 조립할 weight/size 짝. fonts.ts 의 검증 문자열과 반드시 같은 값을 쓴다. */
export const TEXT = {
  nick: { weight: 700, size: px(0.055) },
  badge: { weight: 600, size: px(0.031) },
  caption: { weight: 600, size: CAPTION },
  micro: { weight: 500, size: MICRO },
  slot: { weight: 600, size: px(0.028) },
  emoji: { weight: 400, size: px(0.085) },
} as const;

/* ── 프레임 3종. 장식은 ticket.ts 가 벡터로만 그린다(PNG·캐릭터 IP 금지, P5) ── */

export type FrameId = "neon" | "confetti" | "film";

export interface FramePalette {
  label: string;
  /** 스토리 배경 그라데이션 위/아래 */
  bg: [string, string];
  card: string;
  slot: string;
  ink: string;
  sub: string;
  accent: string;
}

export const FRAMES: Record<FrameId, FramePalette> = {
  neon: {
    label: "네온",
    bg: ["#12102a", "#050410"],
    card: "#1b1836",
    slot: "#272350",
    ink: "#f5f3ff",
    sub: "#b9b3e6",
    accent: "#c9ff4d",
  },
  confetti: {
    label: "컨페티",
    bg: ["#2a1030", "#120616"],
    card: "#fdf6ef",
    slot: "#f0e2d4",
    ink: "#2b1a2f",
    sub: "#7a6070",
    accent: "#ff3d8b",
  },
  film: {
    label: "필름",
    bg: ["#1a1a1a", "#070707"],
    card: "#111111",
    slot: "#232323",
    ink: "#f2efe6",
    sub: "#9c968a",
    accent: "#e8c34a",
  },
};

export const FRAME_IDS = Object.keys(FRAMES) as FrameId[];
export const DEFAULT_FRAME: FrameId = "neon";

/* ── F3 업로드 규격 — 티켓 셀 크기에서 역산한다 ── */

/**
 * 업로드 리사이즈 하한. 셀 폭 357 의 2배 여유(㉑).
 * 이 값 아래로 내리면 티켓 셀에서 사진이 뭉갠다.
 */
export const UPLOAD_MIN_LONG_EDGE = 800;
/** 실제 상한. 하한보다 커야 하고, base64 전송량이 실제 제약이다. */
export const UPLOAD_MAX_LONG_EDGE = 1280;
/** src/lib/db/server.ts 의 MAX_IMAGE_CHARS 와 같은 값 — 클라이언트에서 먼저 걸러 400 을 막는다. */
export const MAX_UPLOAD_CHARS = 12_000_000;

/* ── 순수 계산 ── */

/**
 * 중앙 크롭 단일 경로. 레터박스 금지 —
 * 파티 사진은 비율이 제각각이라 흰 여백이 생기면 티켓이 무너진다(P2).
 */
export function coverRect(
  iw: number,
  ih: number,
  w: number,
  h: number,
): { sx: number; sy: number; sw: number; sh: number } {
  if (!(iw > 0) || !(ih > 0) || !(w > 0) || !(h > 0)) {
    return { sx: 0, sy: 0, sw: 0, sh: 0 };
  }
  // 나눗셈 왕복 대신 곱으로 구한다 — 꽉 차는 축이 부동소수점 오차 없이 정확히 원본값이 된다.
  const sw = Math.min(iw, (ih * w) / h);
  const sh = Math.min(ih, (iw * h) / w);
  return { sx: (iw - sw) / 2, sy: (ih - sh) / 2, sw, sh };
}

const two = (n: number) => String(n).padStart(2, "0");

/** 각인 1행용 로컬 시각 `YYYY.MM.DD HH:mm`. 날짜가 없으면 그냥 사진 콜라주다. */
export function stampDate(d: Date): string {
  if (!(d instanceof Date) || Number.isNaN(d.getTime())) return "";
  return `${d.getFullYear()}.${two(d.getMonth() + 1)}.${two(d.getDate())} ${two(d.getHours())}:${two(d.getMinutes())}`;
}

/**
 * 각인 2행용 보관 D-day. 재방문이 없으면 배너가 트리거로 성립하지 않으므로
 * 티켓 이미지 자체에 만료를 새긴다(F8 리텐션).
 */
export function ddayLabel(expiresAt: Date | null | undefined, now: Date): string {
  if (!(expiresAt instanceof Date) || Number.isNaN(expiresAt.getTime())) return "보관 중";
  const days = Math.ceil((expiresAt.getTime() - now.getTime()) / 86_400_000);
  return days > 0 ? `보관 D-${days}` : "보관 종료";
}
