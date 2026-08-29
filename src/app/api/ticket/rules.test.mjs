/**
 * node --test src/app/api/ticket/rules.test.mjs
 *
 * 해금 규칙과 슬롯 교체·스왑만 검증한다 — 브라우저도 DB 도 필요 없는 순수 로직이고,
 * 여기가 틀리면 (a) 잠긴 프레임이 그냥 열리거나 (b) 미리보기와 출력이 어긋난다.
 * rules.ts 는 import 가 없어 node 가 단독으로 로드할 수 있다.
 */

import assert from "node:assert/strict";
import test from "node:test";

import { SLOTS, clearPick, placePick, unlockState } from "./rules.ts";

test("해금: 조건 미충족이면 잠긴 채로", () => {
  const u = unlockState(0, 0);
  assert.equal(u.unlocked, false);
});

test("해금 경로 ①: 빙고 1줄", () => {
  assert.equal(unlockState(1, 0).unlocked, true);
});

test("해금 경로 ②: 초대 링크로 1명 입장", () => {
  assert.equal(unlockState(0, 1).unlocked, true);
});

test("해금: 망가진 입력이 열쇠가 되지 않는다", () => {
  assert.equal(unlockState(Number.NaN, Number.NaN).unlocked, false);
  assert.equal(unlockState(-3, -5).unlocked, false);
  assert.equal(unlockState(0, 0.9).invited, 0, "0.9명은 0명");
  assert.equal(unlockState("1", "1").unlocked, false, "문자열은 숫자가 아니다");
});

test("슬롯: 빈 칸에 넣으면 뒤에 붙고 4장을 넘지 않는다", () => {
  let p = placePick([], 0, "a");
  p = placePick(p, 3, "b"); // 아직 1장뿐이라 구멍 없이 뒤에 붙는다
  assert.deepEqual(p, ["a", "b"]);
  p = placePick(placePick(p, 2, "c"), 3, "d");
  assert.deepEqual(p, ["a", "b", "c", "d"]);
  assert.deepEqual(placePick(p, 3, "e"), ["a", "b", "c", "e"], "4칸일 땐 교체");
  assert.equal(p.length, SLOTS);
});

test("슬롯: 이미 다른 칸에 있는 사진을 고르면 두 칸을 맞바꾼다", () => {
  assert.deepEqual(placePick(["a", "b", "c", "d"], 0, "c"), ["c", "b", "a", "d"]);
  assert.deepEqual(placePick(["a", "b", "c", "d"], 2, "c"), ["a", "b", "c", "d"]);
});

test("슬롯: 같은 사진이 두 칸에 겹치지 않는다", () => {
  const p = placePick(["a", "b", "c"], 1, "c");
  assert.deepEqual(p, ["a", "c", "b"]);
  assert.equal(new Set(p).size, p.length);
});

test("슬롯: 범위 밖·빈 id 는 무시", () => {
  const p = ["a", "b"];
  assert.equal(placePick(p, 4, "c"), p);
  assert.equal(placePick(p, -1, "c"), p);
  assert.equal(placePick(p, 1, ""), p);
});

test("슬롯 비우기: 뒤 사진이 앞으로 당겨온다(합성 결과와 같은 순서)", () => {
  assert.deepEqual(clearPick(["a", "b", "c", "d"], 1), ["a", "c", "d"]);
  assert.deepEqual(clearPick([], 0), []);
});
