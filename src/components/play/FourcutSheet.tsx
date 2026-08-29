"use client";
/* eslint-disable @next/next/no-img-element */

/**
 * F5 네컷 타임 — 게스트 폰의 촬영 시트.
 *
 * 진행은 서버에 묻지 않고 startedAt 에서 계산한다(폰·TV 가 같은 값을 본다).
 * 컷마다 7초라 카메라를 다녀오면 이미 다음 컷일 수 있어서, 제출 컷 번호는
 * "찍기를 누른 순간"의 컷으로 고정한다.
 */

import { useEffect, useRef, useState } from "react";
import {
  CUT_COUNT,
  cutProgress,
  type FourcutSession,
} from "@/lib/fourcut";
import { getSessionToken } from "@/lib/session";
import { fileToJpegDataUrl } from "./image";

export default function FourcutSheet({
  code,
  session,
  onClose,
}: {
  code: string;
  session: FourcutSession;
  onClose: () => void;
}) {
  const [now, setNow] = useState(() => Date.now());
  const [shots, setShots] = useState<Record<number, string>>({});
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  /** 카메라를 열 때의 컷 번호. 돌아왔을 때 이미 다음 컷이어도 이걸로 보낸다. */
  const aimed = useRef(0);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, []);

  const progress = cutProgress(session, new Date(now));
  const done = progress.phase === "done";

  async function shoot(file: File) {
    const cutIndex = aimed.current;
    setBusy(true);
    setMessage("");
    try {
      const preview = await fileToJpegDataUrl(file, 1024);
      setShots((s) => ({ ...s, [cutIndex]: preview }));
      const res = await fetch("/api/fourcut/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          roomCode: code,
          sessionToken: getSessionToken(),
          cutIndex,
          imageBase64: preview,
        }),
      });
      const json = (await res.json().catch(() => ({}))) as {
        late?: boolean;
        error?: string;
      };
      if (!res.ok) throw new Error(json.error ?? "사진을 올리지 못했어요. 다시 찍어 주세요.");
      setMessage(
        json.late
          ? `${cutIndex + 1}컷은 마감 뒤라 프레임엔 못 들어가지만 앨범엔 담겼어요.`
          : `${cutIndex + 1}컷 올렸어요!`,
      );
    } catch (error) {
      setShots((s) => {
        const next = { ...s };
        delete next[cutIndex];
        return next;
      });
      setMessage(
        error instanceof Error ? error.message : "사진을 올리지 못했어요. 다시 찍어 주세요.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-stage px-5 pt-6 pb-[max(1.25rem,env(safe-area-inset-bottom))] text-stage-ink">
      <div className="flex items-baseline justify-between">
        <h2 className="text-lg font-black">네컷 타임 📸</h2>
        <button
          type="button"
          onClick={onClose}
          className="min-h-11 rounded-full px-4 text-sm font-semibold text-stage-ink-muted"
        >
          닫기
        </button>
      </div>

      <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
        {progress.phase === "countdown" ? (
          <>
            <p className="text-sm text-stage-ink-muted">다 같이 준비!</p>
            <p className="text-7xl font-black tabular-nums" aria-live="polite">
              {progress.secondsLeft}
            </p>
            <p className="text-base font-bold">첫 포즈 · {progress.mission}</p>
          </>
        ) : done ? (
          <>
            <p className="text-2xl font-black">네컷 타임 끝! 🎉</p>
            <p className="text-sm text-stage-ink-muted">
              찍은 컷은 앨범에 담겼어요. 네 명이 한 판을 채운 합동 네컷은 TV 화면에서 공개돼요.
            </p>
          </>
        ) : (
          <>
            <p className="text-sm font-semibold text-stage-ink-muted">
              {progress.cutIndex + 1}컷 / {CUT_COUNT}
            </p>
            <p className="text-2xl leading-snug font-black" aria-live="polite">
              {progress.mission}
            </p>
            <p className="text-5xl font-black tabular-nums">{progress.secondsLeft}</p>
          </>
        )}

        <ul className="flex gap-2" aria-label="지금까지 찍은 컷">
          {Array.from({ length: CUT_COUNT }, (_, i) => (
            <li
              key={i}
              className={`size-16 overflow-hidden rounded-xl bg-stage-card ${
                !done && i === progress.cutIndex ? "ring-2 ring-brand-pink-hot" : ""
              }`}
            >
              {shots[i] ? (
                <img src={shots[i]} alt={`${i + 1}컷`} className="size-full object-cover" />
              ) : (
                <span className="flex size-full items-center justify-center text-sm font-bold text-stage-ink-muted">
                  {i + 1}
                </span>
              )}
            </li>
          ))}
        </ul>
      </div>

      {message && (
        <p role="status" className="mb-3 text-center text-sm font-semibold">
          {message}
        </p>
      )}

      {done ? (
        <button
          type="button"
          onClick={onClose}
          className="min-h-14 w-full rounded-full bg-primary text-base font-bold text-on-primary"
        >
          앨범으로 돌아가기
        </button>
      ) : (
        <label
          onClick={() => {
            aimed.current = progress.phase === "countdown" ? 0 : progress.cutIndex;
          }}
          className={`flex min-h-14 w-full cursor-pointer items-center justify-center rounded-full bg-brand-pink-hot text-base font-bold text-ink ${
            busy ? "opacity-50" : ""
          }`}
        >
          {busy ? "올리는 중이에요…" : `${(progress.cutIndex ?? 0) + 1}컷 찍기 📸`}
          <input
            type="file"
            accept="image/*"
            capture
            disabled={busy}
            className="sr-only"
            data-testid="fourcut-shoot"
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              if (file) void shoot(file);
            }}
          />
        </label>
      )}
    </div>
  );
}
