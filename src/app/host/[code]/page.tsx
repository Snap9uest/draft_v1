"use client";

import Link from "next/link";
import QRCode from "qrcode";
import { use, useEffect, useState, useSyncExternalStore } from "react";
import { browserDb } from "@/lib/db/client";
import { getRoomPhotos, getRoomWithParticipants } from "@/lib/db/queries";
import type { Participant, Photo, Room, RoomStatus } from "@/lib/db/types";
import { getHostToken, setHostToken } from "@/lib/session";

const TONES = ["친목", "동아리", "워크샵", "파티"];

const NO_SUBSCRIBE = () => () => {};

const STATUS_LABEL: Record<RoomStatus, string> = {
  lobby: "입장 받는 중",
  live: "파티 진행 중",
  award: "칭호 발표 중",
  ended: "파티 끝남",
};

async function post(url: string, body: unknown) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error ?? "잠깐 연결이 끊겼어요. 다시 눌러 주세요.");
  return json;
}

async function patch(url: string, body: unknown) {
  const res = await fetch(url, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error ?? "잠깐 연결이 끊겼어요. 다시 눌러 주세요.");
  return json;
}

export default function HostPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const code = use(params).code.toUpperCase();

  const [room, setRoom] = useState<Room | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [pastedToken, setPastedToken] = useState<string | null>(null);
  const [qr, setQr] = useState("");
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [confirmEnd, setConfirmEnd] = useState(false);

  // localStorage·location 은 서버 렌더에 없다 — 수화 전에는 읽지 않는다.
  const hydrated = useSyncExternalStore(
    NO_SUBSCRIBE,
    () => true,
    () => false,
  );
  const hostToken = hydrated ? (pastedToken ?? getHostToken(code)) : null;
  const joinUrl = hydrated ? `${window.location.origin}/play/${code}` : "";

  useEffect(() => {
    if (!joinUrl) return;
    QRCode.toDataURL(joinUrl, { width: 512, margin: 1 })
      .then(setQr)
      .catch(() => setQr(""));
  }, [joinUrl]);

  const [tick, setTick] = useState(0);
  const refresh = () => setTick((t) => t + 1);

  useEffect(() => {
    let alive = true;
    void (async () => {
      const found = await getRoomWithParticipants(code);
      if (!alive) return;
      setLoaded(true);
      if (!found) return;
      setRoom(found.room);
      setParticipants(found.participants);
      // 호스트만 숨긴 사진까지 본다(복구용).
      const list = await getRoomPhotos(found.room.id, true);
      if (alive) setPhotos(list);
    })();
    return () => {
      alive = false;
    };
  }, [code, tick]);

  const roomId = room?.id;
  useEffect(() => {
    if (!roomId) return;
    let channel: ReturnType<ReturnType<typeof browserDb>["channel"]> | null = null;
    const reload = () => setTick((t) => t + 1);
    const subscribe = () => {
      try {
        channel = browserDb()
          .channel(`host:${roomId}:${Date.now()}`)
          .on(
            "postgres_changes",
            { event: "*", schema: "public", table: "photos", filter: `room_id=eq.${roomId}` },
            reload,
          )
          .on(
            "postgres_changes",
            { event: "*", schema: "public", table: "participants", filter: `room_id=eq.${roomId}` },
            reload,
          )
          .on(
            "postgres_changes",
            { event: "*", schema: "public", table: "rooms", filter: `id=eq.${roomId}` },
            reload,
          )
          .subscribe();
      } catch {
        // realtime 이 막혀도 버튼 조작 후 재조회로 진행된다
      }
    };
    subscribe();
    const onVisible = () => {
      if (document.visibilityState !== "visible") return;
      if (channel) void browserDb().removeChannel(channel);
      subscribe();
      reload();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      if (channel) void browserDb().removeChannel(channel);
    };
  }, [roomId]);

  const run = async (key: string, fn: () => Promise<void>) => {
    setBusy(key);
    setError("");
    setNotice("");
    try {
      await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : "잠깐 연결이 끊겼어요. 다시 눌러 주세요.");
    } finally {
      setBusy("");
    }
  };

  const patchRoom = (body: Record<string, unknown>) =>
    run(JSON.stringify(body), async () => {
      const { room: next } = await patch(`/api/room/${code}`, { hostToken, ...body });
      setRoom(next as Room);
    });

  const toggleHidden = (photo: Photo) =>
    run(`photo:${photo.id}`, async () => {
      const hidden = !photo.hidden;
      setPhotos((prev) =>
        prev.map((p) => (p.id === photo.id ? { ...p, hidden } : p)),
      );
      try {
        await patch(`/api/photo/${photo.id}`, { hostToken, hidden });
      } catch (e) {
        refresh();
        throw e;
      }
    });

  if (!loaded) {
    return <main className="p-6 text-sm text-neutral-400">호스트 화면 여는 중이에요…</main>;
  }

  if (!room) {
    return (
      <main className="mx-auto max-w-md p-6">
        <h1 className="text-xl font-bold">방을 찾을 수 없어요</h1>
        <p className="mt-2 text-sm text-neutral-400">
          방 코드 <span className="font-mono">{code}</span> 로 열린 파티가 없어요. 코드를 다시
          확인해 주세요.
        </p>
        <Link href="/" className="mt-6 inline-block underline">
          홈으로 가기
        </Link>
      </main>
    );
  }

  const verified = photos.filter(
    (p) => p.verify_status !== "pending" && !p.hidden,
  ).length;

  return (
    <main className="mx-auto flex w-full max-w-md flex-col gap-6 p-4 pb-24">
      <header className="flex items-baseline justify-between">
        <h1 className="text-lg font-bold">파티 진행하기</h1>
        <span className="rounded-full bg-neutral-800 px-3 py-1 text-xs text-neutral-200">
          {STATUS_LABEL[room.status]}
        </span>
      </header>

      <section className="rounded-2xl bg-neutral-900 p-5 text-center text-white">
        <p className="text-xs text-neutral-400">방 코드</p>
        <p className="font-mono text-5xl font-bold tracking-[0.2em]">{room.code}</p>
        {qr ? (
          <img
            src={qr}
            alt={`${room.code} 방 입장 QR 코드 — 폰 카메라로 찍으면 바로 입장해요`}
            className="mx-auto mt-4 h-56 w-56 rounded-xl bg-white p-2"
          />
        ) : (
          <p className="mt-4 text-sm text-neutral-400">
            QR이 안 만들어졌어요. 아래 주소를 대신 알려주세요.
          </p>
        )}
        <p className="mt-3 break-all text-xs text-neutral-400">{joinUrl}</p>
        <button
          type="button"
          className="mt-3 min-h-11 w-full rounded-xl bg-neutral-800 px-4 text-sm"
          onClick={() => {
            navigator.clipboard
              ?.writeText(joinUrl)
              .then(() => setNotice("입장 링크를 복사했어요. 붙여넣어 보내 주세요."))
              .catch(() => setNotice("복사가 안 됐어요. 위 주소를 직접 알려주세요."));
          }}
        >
          입장 링크 복사하기
        </button>
      </section>

      <section className="flex gap-3 text-center">
        <div className="flex-1 rounded-xl bg-neutral-100 p-3 dark:bg-neutral-900">
          <p className="text-2xl font-bold">{participants.length}</p>
          <p className="text-xs text-neutral-500">참가자</p>
        </div>
        <div className="flex-1 rounded-xl bg-neutral-100 p-3 dark:bg-neutral-900">
          <p className="text-2xl font-bold">{verified}</p>
          <p className="text-xs text-neutral-500">인증된 미션 사진</p>
        </div>
      </section>

      {!hostToken && (
        <section className="rounded-xl border border-amber-500/60 bg-amber-500/10 p-4 text-sm">
          <p className="font-semibold">지금은 보기만 할 수 있어요</p>
          <p className="mt-1 text-neutral-500">
            방을 만든 기기에서 이 주소를 열면 바로 진행할 수 있어요. 진행을 넘겨받는
            거라면, 그 기기에서 받은 진행 코드를 아래에 붙여넣어 주세요.
          </p>
          <form
            className="mt-3 flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              const input = new FormData(e.currentTarget).get("token");
              const value = typeof input === "string" ? input.trim() : "";
              if (!value) return;
              setHostToken(code, value);
              setPastedToken(value);
            }}
          >
            <label className="sr-only" htmlFor="host-token">
              진행 코드
            </label>
            <input
              id="host-token"
              name="token"
              className="min-h-11 flex-1 rounded-lg border border-neutral-300 px-3 text-sm dark:border-neutral-700 dark:bg-neutral-900"
              placeholder="넘겨받은 진행 코드"
            />
            <button type="submit" className="min-h-11 rounded-lg bg-neutral-900 px-4 text-sm text-white dark:bg-white dark:text-neutral-900">
              이 기기로 진행하기
            </button>
          </form>
        </section>
      )}

      {error && (
        <p role="alert" className="rounded-xl bg-red-500/10 p-3 text-sm text-red-500">
          {error}
        </p>
      )}
      {notice && (
        <p role="status" className="text-sm text-neutral-500">
          {notice}
        </p>
      )}

      <fieldset disabled={!hostToken || busy !== ""} className="contents">
        <section>
          <h2 className="mb-2 text-sm font-semibold">미션 분위기</h2>
          <div className="grid grid-cols-4 gap-2">
            {TONES.map((tone) => (
              <button
                key={tone}
                type="button"
                aria-label={`미션 분위기 고르기 — ${tone}`}
                aria-pressed={room.tone_preset === tone}
                className={`min-h-12 rounded-xl text-sm ${
                  room.tone_preset === tone
                    ? "bg-neutral-900 text-white dark:bg-white dark:text-neutral-900"
                    : "bg-neutral-100 dark:bg-neutral-900"
                } disabled:opacity-40`}
                onClick={() => patchRoom({ tonePreset: tone })}
              >
                {tone}
              </button>
            ))}
          </div>
          <p className="mt-2 text-xs text-neutral-500">
            지금 고른 분위기로 AI가 미션을 골라요. 이미 들어온 사람의 빙고판은 그대로예요.
          </p>
        </section>

        <section className="flex items-center justify-between rounded-xl bg-neutral-100 p-4 dark:bg-neutral-900">
          <label htmlFor="reward" className="text-sm">
            <span className="font-semibold">현장 리워드</span>
            <span className="block text-xs text-neutral-500">
              오늘 상품이 걸려 있으면 켜 두세요.
            </span>
          </label>
          <input
            id="reward"
            type="checkbox"
            className="h-7 w-7 shrink-0 accent-neutral-900 disabled:opacity-40 dark:accent-white"
            checked={room.reward_on}
            onChange={() => patchRoom({ rewardOn: !room.reward_on })}
          />
        </section>

        <section className="flex flex-col gap-2">
          <h2 className="text-sm font-semibold">파티 진행</h2>
          {room.status === "lobby" && (
            <button
              type="button"
              className="min-h-12 rounded-xl bg-neutral-900 text-white disabled:opacity-40 dark:bg-white dark:text-neutral-900"
              onClick={() => patchRoom({ status: "live" })}
            >
              파티 시작하기
            </button>
          )}
          <button
            type="button"
            className="min-h-12 rounded-xl bg-neutral-100 disabled:opacity-40 dark:bg-neutral-900"
            onClick={() =>
              run("bots", async () => {
                const { added } = await post(`/api/room/${code}/bots`, { hostToken });
                setNotice(
                  added
                    ? `봇 참가자 ${added}명이 들어왔어요.`
                    : "봇 참가자는 이미 다 들어와 있어요.",
                );
                refresh();
              })
            }
          >
            {busy === "bots" ? "봇 참가자 부르는 중이에요…" : "봇 참가자 부르기"}
          </button>
          <button
            type="button"
            className="min-h-12 rounded-xl bg-neutral-100 disabled:opacity-40 dark:bg-neutral-900"
            onClick={() =>
              run("award", async () => {
                await post(`/api/room/${code}/award`, { hostToken });
                setNotice("칭호를 발표했어요. TV 화면을 봐 주세요.");
                refresh();
              })
            }
          >
            {busy === "award" ? "AI가 칭호를 고르는 중이에요…" : "TV에 칭호 발표하기"}
          </button>
          {confirmEnd ? (
            <div className="rounded-xl border border-red-500/60 p-3">
              <p className="text-sm">
                파티를 끝낼까요? 한 번 끝내면 되돌릴 수 없어요. 새로 들어오거나 사진을
                올리는 건 막히고, 앨범과 네컷 티켓은 그대로 남아요.
              </p>
              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  className="min-h-12 flex-1 rounded-xl bg-neutral-100 disabled:opacity-40 dark:bg-neutral-800"
                  onClick={() => setConfirmEnd(false)}
                >
                  계속 진행하기
                </button>
                <button
                  type="button"
                  className="min-h-12 flex-1 rounded-xl bg-red-600 text-white disabled:opacity-40"
                  onClick={async () => {
                    await patchRoom({ status: "ended" });
                    setConfirmEnd(false);
                  }}
                >
                  네, 파티 끝낼게요
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              className="min-h-12 rounded-xl border border-red-500/60 text-red-500 disabled:opacity-40"
              onClick={() => setConfirmEnd(true)}
            >
              파티 끝내기
            </button>
          )}
        </section>

        <section>
          <h2 className="mb-2 text-sm font-semibold">올라온 사진 {photos.length}장</h2>
          {photos.length === 0 ? (
            <p className="text-sm text-neutral-500">아직 첫 사진을 기다리는 중이에요 📸</p>
          ) : (
            <>
            <p className="mb-2 text-xs text-neutral-500">
              큰 화면에 띄우고 싶지 않은 사진은 TV에서 내려 주세요. 내려도 사진이 지워지지는
              않고, 언제든 다시 띄울 수 있어요.
            </p>
            <ul className="grid grid-cols-2 gap-3">
              {photos.map((photo) => {
                const owner = participants.find((p) => p.id === photo.owner_id);
                return (
                  <li key={photo.id} className="overflow-hidden rounded-xl bg-neutral-100 dark:bg-neutral-900">
                    <img
                      src={photo.url}
                      alt={photo.caption || `${owner?.nickname ?? "누군가"}님이 올린 사진`}
                      className={`aspect-square w-full object-cover ${photo.hidden ? "opacity-30" : ""}`}
                    />
                    <div className="p-2">
                      <p className="truncate text-xs text-neutral-500">
                        {owner?.nickname ?? "누군가"}
                      </p>
                      <button
                        type="button"
                        aria-label={`${owner?.nickname ?? "누군가"}님의 사진 ${
                          photo.hidden ? "TV에 다시 띄우기" : "TV에서 내리기"
                        }`}
                        className="mt-1 min-h-11 w-full rounded-lg bg-neutral-200 text-xs disabled:opacity-40 dark:bg-neutral-800"
                        onClick={() => toggleHidden(photo)}
                      >
                        {photo.hidden ? "TV에 다시 띄우기" : "TV에서 내리기"}
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
            </>
          )}
        </section>
      </fieldset>

      <Link href={`/tv/${code}`} className="text-center text-sm underline">
        TV 화면 열기
      </Link>
    </main>
  );
}
