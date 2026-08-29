"use client";

/**
 * 잠금 프레임(gold) — film 팔레트 위에 얹는 **자체 벡터** 금박 오버레이.
 *
 * PNG 오버레이·캐릭터 IP 금지(P5). 좌표는 전부 W 비율이라 레이아웃이 바뀌어도
 * 장식이 사진 한가운데로 들어오지 않는다(P9).
 */

import { CARD_RADIUS, LAYOUT, W } from "@/lib/canvas/constants";
import { compose, type TicketInput, type TicketResult } from "@/lib/canvas/ticket";
import { baseFrame, GOLD, type TicketFrame } from "@/app/api/ticket/frames";

export async function composeTicket(
  frame: TicketFrame,
  input: Omit<TicketInput, "frame">,
): Promise<TicketResult> {
  const result = await compose({ ...input, frame: baseFrame(frame) });
  if (frame !== GOLD) return result;

  const ctx = result.canvas.getContext("2d");
  if (!ctx) return result;
  drawGold(ctx);
  // 오버레이를 얹었으니 blob 을 다시 굽는다 — 화면·저장·업로드가 같은 픽셀이어야 한다.
  return { ...result, blob: await toBlob(result.canvas) };
}

function drawGold(ctx: CanvasRenderingContext2D): void {
  const c = LAYOUT.card;
  const gap = Math.round(W * 0.021);
  const x = c.x - gap;
  const y = c.y - gap;
  const w = c.w + gap * 2;
  const h = c.h + gap * 2;

  const gold = ctx.createLinearGradient(x, y, x + w, y + h);
  gold.addColorStop(0, "#f8e59a");
  gold.addColorStop(0.3, "#c08f2e");
  gold.addColorStop(0.55, "#fff2bd");
  gold.addColorStop(0.8, "#b07f22");
  gold.addColorStop(1, "#f3dd92");

  ctx.save();
  ctx.strokeStyle = gold;
  ctx.fillStyle = gold;
  ctx.lineJoin = "round";

  ctx.lineWidth = Math.round(W * 0.009);
  roundRect(ctx, x, y, w, h, CARD_RADIUS + gap);
  ctx.stroke();

  const in2 = Math.round(W * 0.011);
  ctx.lineWidth = Math.round(W * 0.003);
  roundRect(ctx, x + in2, y + in2, w - in2 * 2, h - in2 * 2, CARD_RADIUS + gap - in2);
  ctx.stroke();

  // 네 모서리 컬 + 스파클
  const curl = Math.round(W * 0.075);
  ctx.lineWidth = Math.round(W * 0.005);
  const corners: [number, number, number, number][] = [
    [x, y, 1, 1],
    [x + w, y, -1, 1],
    [x, y + h, 1, -1],
    [x + w, y + h, -1, -1],
  ];
  for (const [cx, cy, sx, sy] of corners) {
    ctx.beginPath();
    ctx.moveTo(cx + sx * curl, cy);
    ctx.bezierCurveTo(
      cx + sx * curl * 0.35,
      cy + sy * curl * 0.05,
      cx + sx * curl * 0.05,
      cy + sy * curl * 0.35,
      cx,
      cy + sy * curl,
    );
    ctx.stroke();
    sparkle(ctx, cx + sx * curl * 0.5, cy + sy * curl * 0.5, W * 0.011);
  }

  ctx.globalAlpha = 0.85;
  sparkle(ctx, c.x + c.w * 0.5, y - Math.round(W * 0.02), W * 0.02);
  sparkle(ctx, c.x + c.w * 0.5, c.y + c.h + Math.round(W * 0.03), W * 0.014);
  ctx.restore();
}

/** 4각 반짝임. arc/bezier 만 쓰므로 해상도 독립. */
function sparkle(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number): void {
  const k = r * 0.16;
  ctx.beginPath();
  ctx.moveTo(cx, cy - r);
  ctx.quadraticCurveTo(cx + k, cy - k, cx + r, cy);
  ctx.quadraticCurveTo(cx + k, cy + k, cx, cy + r);
  ctx.quadraticCurveTo(cx - k, cy + k, cx - r, cy);
  ctx.quadraticCurveTo(cx - k, cy - k, cx, cy - r);
  ctx.closePath();
  ctx.fill();
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

function toBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("티켓 이미지를 만들지 못했어요."))),
      "image/jpeg",
      0.92,
    );
  });
}
