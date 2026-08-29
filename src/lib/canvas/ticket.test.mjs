/**
 * node --test src/lib/canvas/ticket.test.mjs
 *
 * 브라우저 Canvas 가 없으므로 순수 계산만 검증한다:
 * 레이아웃 좌표 산출 / 중앙 크롭 좌표 / 각인 문자열(D-day).
 * constants.ts 는 relative import 가 없어 node 가 단독으로 로드할 수 있다.
 */

import assert from "node:assert/strict";
import test from "node:test";

import {
  BORDER,
  CARD_W,
  CELL_ASPECT,
  H,
  LAYOUT,
  LEDGE,
  SPACING,
  UPLOAD_MIN_LONG_EDGE,
  W,
  coverRect,
  ddayLabel,
  stampDate,
} from "./constants.ts";

test("레이아웃: 카드가 스토리 캔버스 안에 들어간다", () => {
  const c = LAYOUT.card;
  assert.ok(c.x >= 0 && c.y >= 0, "카드가 캔버스 밖으로 나감");
  assert.ok(c.x + c.w <= W, "카드 폭 초과");
  assert.ok(c.y + c.h <= H, "카드 높이 초과 — 4컷 2×2 가 아니면 여기서 터진다");
  assert.equal(c.x * 2 + c.w, W, "좌우 여백이 비대칭");
});

test("레이아웃: 4컷 2×2, 셀은 4:3, 카드 안", () => {
  const cells = LAYOUT.cells;
  assert.equal(cells.length, 4);
  for (const cell of cells) {
    assert.ok(Math.abs(cell.w / cell.h - CELL_ASPECT) < 0.01, "셀 종횡비가 4:3 아님");
    assert.ok(cell.x >= LAYOUT.card.x + BORDER - 1, "셀이 좌측 여백을 침범");
    assert.ok(cell.x + cell.w <= LAYOUT.card.x + LAYOUT.card.w - BORDER + 1);
    assert.ok(cell.y + cell.h <= LAYOUT.card.y + LAYOUT.card.h);
  }
  assert.equal(cells[1].x - (cells[0].x + cells[0].w), SPACING, "가로 컷 간격");
  assert.equal(cells[2].y - (cells[0].y + cells[0].h), SPACING, "세로 컷 간격");
  assert.equal(cells[0].y, cells[1].y);
  assert.equal(cells[0].x, cells[2].x);
});

test("레이아웃: 하단 턱 / 상단 여백 = 2.25 (네컷다움의 핵심 비율)", () => {
  const bottom = LAYOUT.card.y + LAYOUT.card.h - (LAYOUT.cells[2].y + LAYOUT.cells[2].h);
  assert.ok(Math.abs(bottom / BORDER - 2.25) < 0.05, `실제 ${bottom / BORDER}`);
  assert.equal(bottom, BORDER + LEDGE);
});

test("레이아웃: 각인 2행이 카드 안에 있고 1행보다 아래다", () => {
  assert.ok(LAYOUT.caption.y < LAYOUT.micro.y);
  assert.ok(LAYOUT.micro.y <= LAYOUT.card.y + LAYOUT.card.h);
  assert.ok(LAYOUT.caption.y > LAYOUT.cells[2].y + LAYOUT.cells[2].h);
  assert.equal(LAYOUT.micro.x, LAYOUT.card.x + CARD_W - BORDER);
});

test("업로드 하한이 셀 폭의 2배 여유를 준다", () => {
  assert.ok(
    UPLOAD_MIN_LONG_EDGE >= LAYOUT.cells[0].w * 2,
    "업로드 하한이 셀 폭 2배 아래로 내려가면 티켓에서 뭉갠다",
  );
});

test("중앙 크롭: 가로로 긴 사진은 좌우를 잘라낸다", () => {
  const cell = LAYOUT.cells[0];
  const s = coverRect(4000, 1000, cell.w, cell.h);
  assert.equal(s.sh, 1000, "세로는 전부 쓴다");
  assert.ok(s.sw < 4000, "가로를 잘라야 한다");
  assert.ok(Math.abs(s.sw / s.sh - cell.w / cell.h) < 0.001, "잘린 영역이 셀 비율");
  assert.equal(s.sy, 0);
  assert.equal(s.sx, (4000 - s.sw) / 2, "중앙 크롭이 아님");
});

test("중앙 크롭: 세로로 긴 사진(아이폰 세로)은 위아래를 잘라낸다", () => {
  const cell = LAYOUT.cells[0];
  const s = coverRect(1000, 4000, cell.w, cell.h);
  assert.equal(s.sw, 1000, "가로는 전부 쓴다");
  assert.ok(s.sh < 4000);
  assert.equal(s.sx, 0);
  assert.equal(s.sy, (4000 - s.sh) / 2);
});

test("중앙 크롭: 잘못된 입력에 NaN 을 뱉지 않는다", () => {
  assert.deepEqual(coverRect(0, 0, 100, 100), { sx: 0, sy: 0, sw: 0, sh: 0 });
  assert.deepEqual(coverRect(NaN, 10, 100, 100), { sx: 0, sy: 0, sw: 0, sh: 0 });
});

test("각인 1행: YYYY.MM.DD HH:mm 제로패딩", () => {
  assert.equal(stampDate(new Date(2026, 0, 3, 9, 5)), "2026.01.03 09:05");
  assert.equal(stampDate(new Date(2026, 11, 31, 23, 59)), "2026.12.31 23:59");
  assert.equal(stampDate(new Date("nope")), "");
});

test("각인 2행: 보관 D-day", () => {
  const now = new Date(2026, 7, 29, 12, 0);
  const plus = (days) => new Date(now.getTime() + days * 86_400_000);
  assert.equal(ddayLabel(plus(7), now), "보관 D-7");
  assert.equal(ddayLabel(plus(0.5), now), "보관 D-1", "당일 남은 시간은 D-1");
  assert.equal(ddayLabel(plus(-1), now), "보관 종료");
  assert.equal(ddayLabel(now, now), "보관 종료");
  assert.equal(ddayLabel(null, now), "보관 중");
  assert.equal(ddayLabel(new Date("nope"), now), "보관 중");
});
