/**
 * node --test src/lib/fourcut.test.mjs
 *
 * 순수 계산만 검증한다: 컷 진행 시각, 결정적 셔플, 인원 부족 프레임 폴백.
 * fourcut.ts 는 relative import 가 없어 node 가 단독으로 로드할 수 있다.
 */

import assert from "node:assert/strict";
import test from "node:test";

import {
  buildFrame,
  COUNTDOWN_MS,
  CUT_COUNT,
  CUT_MS,
  cutCaption,
  cutIndexFromCaption,
  cutProgress,
  pickCutMissions,
  readFourcut,
  shuffleSeeded,
  startSession,
} from "./fourcut.ts";

const T0 = new Date("2026-08-29T12:00:00.000Z");
const at = (ms) => new Date(T0.getTime() + ms);
const session = startSession("room-1", T0);

test("세션은 컷 4개와 마감을 갖는다", () => {
  assert.equal(session.cutMissions.length, CUT_COUNT);
  assert.equal(new Set(session.cutMissions).size, CUT_COUNT); // 중복 포즈 없음
  assert.deepEqual(readFourcut({ fourcut: session }), session);
  assert.equal(readFourcut({ fourcut: { startedAt: "언제" } }), null);
  assert.equal(readFourcut({}), null);
  assert.equal(readFourcut(null), null);
});

test("진행 상황은 startedAt 하나에서 나온다", () => {
  assert.deepEqual(cutProgress(session, T0), {
    phase: "countdown",
    cutIndex: 0,
    mission: session.cutMissions[0],
    secondsLeft: COUNTDOWN_MS / 1000,
  });
  assert.equal(cutProgress(session, at(COUNTDOWN_MS)).phase, "shooting");
  assert.equal(cutProgress(session, at(COUNTDOWN_MS)).cutIndex, 0);
  assert.equal(cutProgress(session, at(COUNTDOWN_MS + CUT_MS)).cutIndex, 1);
  assert.equal(cutProgress(session, at(COUNTDOWN_MS + 3 * CUT_MS)).cutIndex, 3);
  const done = cutProgress(session, at(COUNTDOWN_MS + CUT_COUNT * CUT_MS));
  assert.equal(done.phase, "done");
  assert.equal(done.secondsLeft, 0);
});

test("같은 시드면 같은 결과", () => {
  assert.deepEqual(pickCutMissions("seed"), pickCutMissions("seed"));
  assert.notDeepEqual(pickCutMissions("seed"), pickCutMissions("다른 시드"));
  const ids = ["a", "b", "c", "d", "e"];
  assert.deepEqual(shuffleSeeded(ids, "x"), shuffleSeeded(ids, "x"));
  assert.deepEqual([...shuffleSeeded(ids, "x")].sort(), ids); // 원소 보존
});

test("캡션에 컷 번호가 왕복한다", () => {
  const caption = cutCaption(2, "손가락 하트를 카메라에 바짝 붙여요");
  assert.equal(cutIndexFromCaption(caption), 2);
  assert.equal(cutIndexFromCaption("그냥 자유 사진"), null);
  assert.equal(cutIndexFromCaption(null), null);
});

test("인원이 모자라도 프레임은 나온다", () => {
  const full = ["p1", "p2", "p3", "p4"].flatMap((ownerId, i) =>
    Array.from({ length: CUT_COUNT }, (_, cutIndex) => ({
      ownerId,
      cutIndex,
      url: `u${i}-${cutIndex}`,
    })),
  );
  const frame = buildFrame(full, "s");
  assert.equal(frame.length, CUT_COUNT);
  assert.equal(new Set(frame.map((f) => f.ownerId)).size, 4); // 4명이면 4명 다 다르다
  assert.deepEqual(frame, buildFrame(full, "s")); // 폴링해도 안 바뀐다

  // 1명 + 2컷만 → 같은 사람의 다른 컷으로 네 칸을 채운다
  const thin = buildFrame(
    [
      { ownerId: "solo", cutIndex: 0, url: "a" },
      { ownerId: "solo", cutIndex: 1, url: "b" },
    ],
    "s",
  );
  assert.equal(thin.length, CUT_COUNT);
  assert.ok(thin.every((slot) => slot.url));

  // 아무도 안 찍었으면 빈 칸(화면이 캐릭터 카드로 채운다)
  assert.deepEqual(
    buildFrame([], "s").map((slot) => slot.url),
    [null, null, null, null],
  );
});
