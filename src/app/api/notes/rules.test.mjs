/**
 * node --test src/app/api/notes/rules.test.mjs
 *
 * 방명록에서 DB 없이 판정되는 부분만 본다: 문구 정규화·색 허용목록·도배 간격.
 * 여기가 틀리면 (a) 빈 쪽지나 300자 초과가 DB 제약에 부딪혀 500 이 되거나
 * (b) 30초 도배 방지가 그냥 열린다.
 */

import assert from "node:assert/strict";
import test from "node:test";

import {
  DEFAULT_NOTE_COLOR,
  NOTE_BODY_MAX,
  NOTE_COOLDOWN_MS,
  isNoteColor,
  normalizeNoteBody,
  noteTooSoon,
} from "../../../lib/notes.ts";

test("문구: 앞뒤 공백을 턴 뒤 판정한다", () => {
  assert.equal(normalizeNoteBody("  오늘 고마웠어요  "), "오늘 고마웠어요");
  assert.equal(normalizeNoteBody("   "), null, "공백뿐이면 쪽지가 아니다");
  assert.equal(normalizeNoteBody(""), null);
});

test("문구: 문자열이 아닌 건 전부 거절한다", () => {
  for (const v of [undefined, null, 42, {}, ["안녕"]]) {
    assert.equal(normalizeNoteBody(v), null);
  }
});

test("문구: 상한은 300자, 공백 털고 나서 잰다", () => {
  assert.equal(normalizeNoteBody("가".repeat(NOTE_BODY_MAX))?.length, NOTE_BODY_MAX);
  assert.equal(normalizeNoteBody("가".repeat(NOTE_BODY_MAX + 1)), null);
  assert.equal(
    normalizeNoteBody(` ${"가".repeat(NOTE_BODY_MAX)} `)?.length,
    NOTE_BODY_MAX,
    "공백 때문에 멀쩡한 쪽지가 잘리면 안 된다",
  );
});

test("색: 팔레트 4종만 통과한다", () => {
  assert.equal(isNoteColor(DEFAULT_NOTE_COLOR), true);
  for (const c of ["peach", "lavender", "ochre", "pink"]) {
    assert.equal(isNoteColor(c), true);
  }
  for (const c of ["red", "", null, undefined, 1, "PEACH"]) {
    assert.equal(isNoteColor(c), false);
  }
});

test("도배: 같은 대상에 30초 안이면 막고, 지나면 연다", () => {
  const now = Date.UTC(2026, 0, 1, 12, 0, 0);
  const ago = (ms) => new Date(now - ms).toISOString();
  assert.equal(noteTooSoon(ago(0), now), true);
  assert.equal(noteTooSoon(ago(NOTE_COOLDOWN_MS - 1), now), true);
  assert.equal(noteTooSoon(ago(NOTE_COOLDOWN_MS), now), false);
  assert.equal(noteTooSoon(ago(60_000), now), false);
});

test("도배: 직전 기록이 없거나 못 읽으면 막지 않는다", () => {
  assert.equal(noteTooSoon(null), false);
  assert.equal(noteTooSoon(undefined), false);
  assert.equal(noteTooSoon("어제쯤"), false);
});
