/* eslint-disable @next/next/no-img-element */
"use client";

/**
 * F5 네컷 타임 — TV 연출. 표시 전용(조작 요소 없음).
 *
 * 진행은 rooms.state 의 startedAt 에서 계산한다 — 폰과 같은 값이 나오므로
 * 카운트다운이 어긋나지 않는다. 합동 프레임 시드도 서버 라우트와 같은
 * `roomId:startedAt` 이라 어디서 계산해도 같은 조합이 나온다.
 */

import { useEffect, useState } from "react";
import {
  buildFrame,
  CUT_COUNT,
  cutIndexFromCaption,
  cutProgress,
  type FourcutEntry,
  type FourcutSession,
} from "@/lib/fourcut";
import type { Participant, Photo } from "@/lib/db/types";

export default function FourcutStage({
  session,
  roomId,
  photos,
  participants,
}: {
  session: FourcutSession;
  roomId: string;
  photos: Photo[];
  participants: Participant[];
}) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, []);

  const progress = cutProgress(session, new Date(now));
  const started = Date.parse(session.startedAt);
  const deadline = Date.parse(session.deadline);

  const entries: FourcutEntry[] = photos.flatMap((p) => {
    const cutIndex = cutIndexFromCaption(p.caption);
    const at = Date.parse(p.created_at);
    if (cutIndex === null || !(at >= started && at <= deadline)) return [];
    return [{ ownerId: p.owner_id, cutIndex, url: p.url }];
  });

  const nameOf = (id: string) =>
    participants.find((p) => p.id === id)?.nickname ?? "누군가";

  if (progress.phase === "countdown") {
    return (
      <Center>
        <p className="text-[clamp(1.5rem,3vw,3rem)] text-white/70">폰 들고 준비하세요!</p>
        <p className="text-[clamp(6rem,18vw,20rem)] font-black leading-none tabular-nums">
          {progress.secondsLeft}
        </p>
        <p className="text-[clamp(1.5rem,3vw,3.5rem)] font-bold text-fuchsia-300">
          첫 포즈 · {progress.mission}
        </p>
      </Center>
    );
  }

  if (progress.phase === "shooting") {
    const shot = entries.filter((e) => e.cutIndex === progress.cutIndex).length;
    return (
      <Center>
        <p className="text-[clamp(1.25rem,2.4vw,2.75rem)] text-white/60">
          {progress.cutIndex + 1}컷 / {CUT_COUNT}
        </p>
        <p className="text-[clamp(2.5rem,6vw,7rem)] leading-tight font-black">
          {progress.mission}
        </p>
        <p className="text-[clamp(4rem,12vw,14rem)] font-black leading-none tabular-nums text-amber-300">
          {progress.secondsLeft}
        </p>
        <p className="text-[clamp(1.25rem,2vw,2.5rem)] text-white/60">
          {shot ? `${shot}명이 이 컷을 찍었어요` : "제일 먼저 찍는 사람?"}
        </p>
      </Center>
    );
  }

  const frame = buildFrame(entries, `${roomId}:${session.startedAt}`);
  return (
    <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-[2vh]">
      <p className="text-[clamp(1.5rem,3vw,3.5rem)] font-black">
        오늘의 합동 네컷 🎞️
      </p>
      <div className="grid grid-cols-2 gap-[1.5vw]">
        {frame.map((slot) => (
          <figure
            key={slot.cutIndex}
            className="sq-pop relative size-[min(28vh,22vw)] overflow-hidden rounded-3xl bg-white/5"
          >
            {slot.url ? (
              <img
                src={slot.url}
                alt={`${nameOf(slot.ownerId)}님의 ${slot.cutIndex + 1}컷`}
                className="size-full object-cover"
              />
            ) : (
              <span className="flex size-full items-center justify-center text-[clamp(1rem,1.6vw,2rem)] text-white/50">
                {slot.cutIndex + 1}컷은 비었어요
              </span>
            )}
            <figcaption className="absolute inset-x-0 bottom-0 bg-black/60 px-[1vw] py-[0.8vh] text-[clamp(.9rem,1.3vw,1.8rem)] font-bold">
              {slot.url ? nameOf(slot.ownerId) : "다음 판에 채워요"}
            </figcaption>
          </figure>
        ))}
      </div>
      <p className="text-[clamp(1.1rem,1.8vw,2.2rem)] text-white/60">
        네 사람이 한 판을 채웠어요 · 각자 폰 앨범에도 담겼어요
      </p>
    </div>
  );
}

function Center({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-[2vh] text-center">
      {children}
    </div>
  );
}
