"use client";

/**
 * 엔딩 네컷 티켓 합성 (F7).
 *
 * 티어다운 ⑰ — "합성이 끝났다"는 시점을 코드로 만든다.
 * 에셋 decode 와 폰트 검증이 **끝난 뒤에만** 그리기를 시작하고, 그리기는 단일 동기
 * 패스다. `img.onload` 로 나중에 얹는 경로가 없으므로 같은 입력이면 같은 픽셀이 나온다.
 */

import {
  BORDER,
  CARD_RADIUS,
  CELL_RADIUS,
  DEFAULT_FRAME,
  FRAMES,
  H,
  LAYOUT,
  SPACING,
  TEXT,
  W,
  coverRect,
  ddayLabel,
  stampDate,
  type FrameId,
  type FramePalette,
  type Rect,
} from "./constants";
import { fontSpec, loadTicketFont, type LoadedFont } from "./fonts";

export interface TicketInput {
  /** 각인 1행 앞부분 */
  roomName: string;
  nickname: string;
  title?: string | null;
  /** 원형 아바타. cross-origin 이어도 되고, 실패하면 이모지로 떨어진다. */
  avatarUrl?: string | null;
  avatarEmoji?: string;
  /** 앞 4장만 쓴다. 부족하면 캐릭터·칭호 카드로 채운다. */
  photoUrls?: readonly (string | null | undefined)[];
  frame?: FrameId;
  /** 각인 1행 시각. 결정성을 원하면 반드시 넘긴다. */
  takenAt?: Date;
  /** room.expires_at → 각인 2행 D-day */
  expiresAt?: Date | null;
  /** D-day 기준 시각. 결정성을 원하면 반드시 넘긴다. */
  now?: Date;
}

export interface TicketResult {
  blob: Blob;
  /** 화면 표시는 이 캔버스를 CSS 로 축소만 한다(업스케일 금지). */
  canvas: HTMLCanvasElement;
  /** 로드 실패·CORS 오염으로 플레이스홀더로 강등된 셀 인덱스(0~3) */
  failedCells: number[];
  usedFallbackFont: boolean;
}

const FONT_SPECS = Object.values(TEXT);

/** 에셋은 모듈 스코프 캐시. 프레임을 바꿔 재합성할 때 다시 받지 않는다. */
const imageCache = new Map<string, Promise<HTMLImageElement>>();

export async function compose(input: TicketInput): Promise<TicketResult> {
  const frameId: FrameId = input.frame && FRAMES[input.frame] ? input.frame : DEFAULT_FRAME;
  const pal = FRAMES[frameId];
  const takenAt = validDate(input.takenAt) ?? new Date();
  const now = validDate(input.now) ?? new Date();

  const urls = (input.photoUrls ?? []).filter(isSafeUrl).slice(0, 4);
  const avatarUrl = isSafeUrl(input.avatarUrl) ? input.avatarUrl : null;

  // ① 에셋 decode + 폰트 검증을 await 완료한 뒤에만 그리기 시작한다.
  const [font, settled] = await Promise.all([
    loadTicketFont(FONT_SPECS),
    Promise.allSettled(
      [avatarUrl, ...urls].map((u) =>
        u ? loadImage(u) : Promise.reject(new Error("no url")),
      ),
    ),
  ]);

  const value = (i: number) =>
    settled[i]?.status === "fulfilled" ? settled[i].value : null;

  const draw: DrawState = {
    pal,
    frameId,
    font,
    avatar: value(0),
    cells: [0, 1, 2, 3].map((i) => (i < urls.length ? value(i + 1) : null)),
    roomName: clean(input.roomName, 24) || "SnapQuest",
    nickname: clean(input.nickname, 16) || "게스트",
    title: clean(input.title, 20),
    emoji: clean(input.avatarEmoji, 4) || "🎉",
    stamp: stampDate(takenAt),
    dday: ddayLabel(input.expiresAt ?? null, now),
  };

  const failed = new Set<number>();
  urls.forEach((_, i) => {
    if (!draw.cells[i]) failed.add(i);
  });

  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d", { alpha: false });
  if (!ctx) throw new Error("이 브라우저에서는 티켓을 만들 수 없어요.");

  // ③ 오염 선제 검사 — 저장 시점이 아니라 합성 직후에 잡는다(티어다운 ⑱).
  //    Supabase Storage 는 cross-origin 이 확정이라 CORS 헤더가 빠지면 여기서 걸린다.
  paint(ctx, draw);
  if (isTainted(ctx)) {
    draw.cells.forEach((img, i) => {
      if (img && taints(img)) {
        draw.cells[i] = null;
        failed.add(i);
      }
    });
    if (draw.avatar && taints(draw.avatar)) draw.avatar = null;
    paint(ctx, draw);
    if (isTainted(ctx)) {
      // 원인을 못 집었으면 사진을 전부 내린다. 티켓이 안 나오는 것보다 낫다.
      draw.cells = [null, null, null, null];
      draw.avatar = null;
      urls.forEach((_, i) => failed.add(i));
      paint(ctx, draw);
    }
  }

  return {
    blob: await toBlob(canvas),
    canvas,
    failedCells: [...failed].sort((a, b) => a - b),
    usedFallbackFont: font.usedFallback,
  };
}

/* ── 단일 동기 draw 패스. 순서 고정: 배경 → 사진 4컷 → 프레임 → 헤더 → 각인 ── */

interface DrawState {
  pal: FramePalette;
  frameId: FrameId;
  font: LoadedFont;
  avatar: HTMLImageElement | null;
  cells: (HTMLImageElement | null)[];
  roomName: string;
  nickname: string;
  title: string;
  emoji: string;
  stamp: string;
  dday: string;
}

function paint(ctx: CanvasRenderingContext2D, d: DrawState): void {
  const { pal } = d;
  const card = LAYOUT.card;

  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = 1;
  ctx.clearRect(0, 0, W, H);

  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, pal.bg[0]);
  bg.addColorStop(1, pal.bg[1]);
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  roundRect(ctx, card.x, card.y, card.w, card.h, CARD_RADIUS);
  ctx.fillStyle = pal.card;
  ctx.fill();

  let placeholderRank = 0;
  LAYOUT.cells.forEach((cell, i) => {
    ctx.save();
    roundRect(ctx, cell.x, cell.y, cell.w, cell.h, CELL_RADIUS);
    ctx.clip();
    const img = d.cells[i];
    if (img) {
      const s = coverRect(img.naturalWidth, img.naturalHeight, cell.w, cell.h);
      ctx.fillStyle = pal.slot;
      ctx.fillRect(cell.x, cell.y, cell.w, cell.h);
      if (s.sw > 0) ctx.drawImage(img, s.sx, s.sy, s.sw, s.sh, cell.x, cell.y, cell.w, cell.h);
    } else {
      // ④ 조용한 빈칸 금지 — 사용자가 자기 사진이 사라진 줄 안다.
      drawPlaceholder(ctx, d, cell, placeholderRank++);
    }
    ctx.restore();
  });

  drawFrame(ctx, d);
  drawHeader(ctx, d);
  drawEngraving(ctx, d);
}

function drawPlaceholder(
  ctx: CanvasRenderingContext2D,
  d: DrawState,
  cell: Rect,
  rank: number,
): void {
  const { pal } = d;
  ctx.fillStyle = pal.slot;
  ctx.fillRect(cell.x, cell.y, cell.w, cell.h);

  const cx = cell.x + cell.w / 2;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  if (rank === 0) {
    ctx.font = spec(d, TEXT.emoji);
    ctx.fillStyle = pal.ink;
    ctx.fillText(d.emoji, cx, cell.y + cell.h * 0.42);
    ctx.font = spec(d, TEXT.slot);
    ctx.fillStyle = pal.sub;
    ctx.fillText(fit(ctx, d.nickname, cell.w - BORDER), cx, cell.y + cell.h * 0.74);
    return;
  }
  if (rank === 1) {
    ctx.font = spec(d, TEXT.slot);
    ctx.fillStyle = pal.accent;
    ctx.fillText("칭호", cx, cell.y + cell.h * 0.34);
    ctx.font = spec(d, TEXT.badge);
    ctx.fillStyle = pal.ink;
    ctx.fillText(
      fit(ctx, d.title || "집계 중", cell.w - BORDER),
      cx,
      cell.y + cell.h * 0.58,
    );
    return;
  }

  // 남는 칸: 벡터 마크만. 빈 사각형으로 두지 않는다.
  ctx.save();
  ctx.globalAlpha = 0.35;
  ctx.strokeStyle = pal.accent;
  ctx.lineWidth = Math.round(W * 0.005);
  ctx.beginPath();
  ctx.arc(cx, cell.y + cell.h * 0.44, cell.h * 0.2, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(cx, cell.y + cell.h * 0.44, cell.h * 0.09, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
  ctx.font = spec(d, TEXT.slot);
  ctx.fillStyle = pal.sub;
  ctx.fillText("SnapQuest", cx, cell.y + cell.h * 0.78);
}

/** 프레임 장식은 전부 자체 벡터. PNG 오버레이·캐릭터 IP 금지(P5), 해상도 독립. */
function drawFrame(ctx: CanvasRenderingContext2D, d: DrawState): void {
  const { pal } = d;
  const c = LAYOUT.card;
  ctx.save();

  if (d.frameId === "neon") {
    const g = Math.round(W * 0.016);
    ctx.strokeStyle = pal.accent;
    ctx.lineWidth = Math.round(W * 0.005);
    roundRect(ctx, c.x - g, c.y - g, c.w + g * 2, c.h + g * 2, CARD_RADIUS + g);
    ctx.stroke();
    ctx.globalAlpha = 0.18;
    for (const [x, y] of [
      [c.x, c.y],
      [c.x + c.w, c.y],
      [c.x, c.y + c.h],
      [c.x + c.w, c.y + c.h],
    ]) {
      ctx.beginPath();
      ctx.arc(x, y, W * 0.09, 0, Math.PI * 2);
      ctx.fillStyle = pal.accent;
      ctx.fill();
    }
  } else if (d.frameId === "confetti") {
    ctx.lineWidth = Math.round(W * 0.009);
    ctx.lineCap = "round";
    ctx.strokeStyle = pal.accent;
    const ribbons: [number, number, number, number, number, number, number, number][] = [
      [0.06, 0.13, 0.3, 0.05, 0.62, 0.2, 0.94, 0.09],
      [0.04, 0.9, 0.32, 0.98, 0.66, 0.86, 0.96, 0.95],
      [0.08, 0.06, 0.36, 0.14, 0.68, 0.03, 0.95, 0.16],
    ];
    ribbons.forEach((r, i) => {
      ctx.globalAlpha = i === 2 ? 0.4 : 0.85;
      ctx.beginPath();
      ctx.moveTo(r[0] * W, r[1] * H);
      ctx.bezierCurveTo(r[2] * W, r[3] * H, r[4] * W, r[5] * H, r[6] * W, r[7] * H);
      ctx.stroke();
    });
    ctx.globalAlpha = 0.9;
    const dots: [number, number, number][] = [
      [0.12, 0.05, 0.016],
      [0.86, 0.04, 0.011],
      [0.2, 0.17, 0.009],
      [0.74, 0.16, 0.014],
      [0.1, 0.93, 0.013],
      [0.9, 0.91, 0.01],
      [0.42, 0.965, 0.016],
      [0.6, 0.03, 0.012],
    ];
    for (const [x, y, r] of dots) {
      ctx.beginPath();
      ctx.arc(x * W, y * H, r * W, 0, Math.PI * 2);
      ctx.fillStyle = pal.accent;
      ctx.fill();
    }
  } else {
    // film: 카드 좌우 바깥에 세로 퍼포레이션 + 상하 바
    const hw = Math.round(W * 0.022);
    const hh = Math.round(W * 0.034);
    const gap = Math.round(W * 0.02);
    const left = c.x - hw - Math.round(W * 0.012);
    const right = c.x + c.w + Math.round(W * 0.012);
    ctx.fillStyle = pal.accent;
    ctx.globalAlpha = 0.75;
    for (let y = c.y; y + hh <= c.y + c.h; y += hh + gap) {
      roundRect(ctx, left, y, hw, hh, hw * 0.3);
      ctx.fill();
      roundRect(ctx, right, y, hw, hh, hw * 0.3);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.fillRect(c.x, c.y - Math.round(W * 0.008), c.w, Math.round(W * 0.004));
    ctx.fillRect(c.x, c.y + c.h + Math.round(W * 0.004), c.w, Math.round(W * 0.004));
  }

  ctx.restore();
}

function drawHeader(ctx: CanvasRenderingContext2D, d: DrawState): void {
  const { pal } = d;
  const h = LAYOUT.header;
  const size = Math.round(W * 0.115);
  const cx = h.x + BORDER + size / 2;
  const cy = h.y + h.h / 2;

  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, size / 2, 0, Math.PI * 2);
  ctx.fillStyle = pal.slot;
  ctx.fill();
  ctx.clip();
  if (d.avatar) {
    const s = coverRect(d.avatar.naturalWidth, d.avatar.naturalHeight, size, size);
    if (s.sw > 0) {
      ctx.drawImage(d.avatar, s.sx, s.sy, s.sw, s.sh, cx - size / 2, cy - size / 2, size, size);
    }
  } else {
    ctx.font = spec(d, { weight: 400, size: size * 0.6 });
    ctx.fillStyle = pal.ink;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(d.emoji, cx, cy + size * 0.04);
  }
  ctx.restore();

  ctx.beginPath();
  ctx.arc(cx, cy, size / 2, 0, Math.PI * 2);
  ctx.strokeStyle = pal.accent;
  ctx.lineWidth = Math.round(W * 0.004);
  ctx.stroke();

  const textX = cx + size / 2 + SPACING;
  const maxW = h.x + h.w - BORDER - textX;

  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.font = spec(d, TEXT.nick);
  ctx.fillStyle = pal.ink;
  ctx.fillText(fit(ctx, d.nickname, maxW), textX, h.y + h.h * 0.4);

  if (d.title) {
    ctx.font = spec(d, TEXT.badge);
    const padX = Math.round(W * 0.018);
    const label = fit(ctx, d.title, maxW - padX * 2);
    const bw = ctx.measureText(label).width + padX * 2;
    const bh = Math.round(TEXT.badge.size * 1.9);
    const by = Math.round(h.y + h.h * 0.68 - bh / 2);
    roundRect(ctx, textX, by, bw, bh, bh / 2);
    ctx.fillStyle = pal.accent;
    ctx.fill();
    ctx.fillStyle = pal.bg[1];
    ctx.fillText(label, textX + padX, by + bh / 2);
  }
}

/** 각인 2행 — 이 한 줄이 "이 순간을 기록했다"의 전부다. */
function drawEngraving(ctx: CanvasRenderingContext2D, d: DrawState): void {
  const { pal } = d;
  ctx.textBaseline = "alphabetic";

  ctx.font = spec(d, TEXT.caption);
  ctx.fillStyle = pal.ink;
  ctx.textAlign = "center";
  const line = d.stamp ? `${d.roomName} · ${d.stamp}` : d.roomName;
  ctx.fillText(fit(ctx, line, LAYOUT.card.w - BORDER * 2), LAYOUT.caption.x, LAYOUT.caption.y);

  ctx.save();
  ctx.globalAlpha = 0.5;
  ctx.font = spec(d, TEXT.micro);
  ctx.fillStyle = pal.sub;
  ctx.textAlign = "right";
  ctx.fillText(`SnapQuest · ${d.dday}`, LAYOUT.micro.x, LAYOUT.micro.y);
  ctx.restore();
}

/* ── 유틸 ── */

const spec = (d: DrawState, t: { weight: number; size: number }) =>
  fontSpec(t.weight, t.size, d.font.family);

function fit(ctx: CanvasRenderingContext2D, text: string, maxW: number): string {
  if (!text || maxW <= 0) return text;
  if (ctx.measureText(text).width <= maxW) return text;
  let t = text;
  while (t.length > 1 && ctx.measureText(`${t}…`).width > maxW) t = t.slice(0, -1);
  return `${t}…`;
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  const rr = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

/** crossOrigin 은 src 대입 **전**에. 뒤에 넣으면 안 먹는다(⑱). */
function loadImage(url: string): Promise<HTMLImageElement> {
  const hit = imageCache.get(url);
  if (hit) return hit;
  const p = (async () => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.decoding = "async";
    img.src = url;
    await img.decode();
    return img;
  })();
  p.catch(() => imageCache.delete(url)); // 일시적 실패를 영구 캐시하지 않는다
  imageCache.set(url, p);
  return p;
}

function isTainted(ctx: CanvasRenderingContext2D): boolean {
  try {
    ctx.getImageData(0, 0, 1, 1);
    return false;
  } catch {
    return true;
  }
}

/** 한 번 오염된 캔버스는 계속 오염이므로 매번 새 1×1 캔버스로 판별한다. */
function taints(img: CanvasImageSource): boolean {
  const c = document.createElement("canvas");
  c.width = c.height = 1;
  const cx = c.getContext("2d");
  if (!cx) return true;
  try {
    cx.drawImage(img, 0, 0, 1, 1);
    cx.getImageData(0, 0, 1, 1);
    return false;
  } catch {
    return true;
  }
}

function toBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("티켓 이미지를 만들지 못했어요."))),
      "image/jpeg",
      0.92,
    );
  });
}

/** DB 에서 온 URL 은 신뢰 경계다. img src 로 넘어가기 전에 스킴을 좁힌다. */
function isSafeUrl(u: unknown): u is string {
  if (typeof u !== "string" || !u) return false;
  if (u.startsWith("blob:") || u.startsWith("data:image/")) return true;
  try {
    const base = typeof location === "undefined" ? undefined : location.href;
    const p = new URL(u, base).protocol;
    return p === "https:" || p === "http:";
  } catch {
    return false;
  }
}

/** 개행·제어문자는 fillText 에서 두부로 찍힌다. 길이도 여기서 자른다. */
// eslint-disable-next-line no-control-regex
const CONTROL_OR_SPACE = /[\s\u0000-\u001f\u007f]+/g;

function clean(s: unknown, max: number): string {
  return typeof s === "string"
    ? s.replace(CONTROL_OR_SPACE, " ").trim().slice(0, max)
    : "";
}

function validDate(d: unknown): Date | null {
  return d instanceof Date && !Number.isNaN(d.getTime()) ? d : null;
}
