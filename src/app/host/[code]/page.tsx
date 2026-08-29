"use client";

import Link from "next/link";
import QRCode from "qrcode";
import { use, useEffect, useState, useSyncExternalStore } from "react";
import { Button, Card } from "@/components/ui";
import { browserDb } from "@/lib/db/client";
import { getRoomPhotos, getRoomWithParticipants } from "@/lib/db/queries";
import type { Participant, Photo, Room, RoomStatus } from "@/lib/db/types";
import { getHostToken, setHostToken } from "@/lib/session";

const TONES = ["친목", "동아리", "워크샵", "파티"];

/**
 * ui/index.tsx 의 Button 과 같은 알약 규격.
 * Button 으로 감쌀 수 없는 자리(next/link, error 색 위험 동작)에만 쓴다.
 * Button 에 className 으로 색을 덮어쓰면 Tailwind 유틸 순서에 따라
 * 이기고 지는 게 갈리므로 덮어쓰지 않고 여기서 처음부터 조립한다.
 */
const PILL =
  "inline-flex min-h-12 items-center justify-center rounded-full px-6 text-base font-semibold " +
  "transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40 " +
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink";

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
    return <main className="p-6 text-sm text-ink-muted">호스트 화면 여는 중이에요…</main>;
  }

  if (!room) {
    return (
      <main className="mx-auto max-w-md p-6">
        <h1 className="text-xl font-bold text-ink">방을 찾을 수 없어요</h1>
        <p className="mt-2 text-sm text-ink-body">
          방 코드 <span className="font-mono font-semibold text-ink">{code}</span> 로 열린
          파티가 없어요. 코드를 다시 확인해 주세요.
        </p>
        <Link href="/" className={`${PILL} mt-6 bg-primary text-on-primary`}>
          홈으로 가기
        </Link>
      </main>
    );
  }

  const verified = photos.filter(
    (p) => p.verify_status !== "pending" && !p.hidden,
  ).length;

  return (
    <main className="mx-auto flex w-full max-w-md flex-col gap-5 p-4 pb-24">
      <header className="flex items-baseline justify-between gap-3">
        <h1 className="text-lg font-bold text-ink">파티 진행하기</h1>
        <span className="shrink-0 rounded-full bg-surface-variant px-3 py-1.5 text-xs font-semibold text-ink">
          {STATUS_LABEL[room.status]}
        </span>
      </header>

      {/*
       * QR 카드만 크림이 아니라 순백이다 — 카메라가 QR 을 잡으려면
       * 흰 바탕 위 검정 모듈이라는 대비가 필요하다. 멋보다 스캔이 우선.
       */}
      <section className="rounded-3xl bg-card-plain p-5 text-center shadow-clay">
        <p className="text-xs font-semibold tracking-[0.2em] text-ink-muted">방 코드</p>
        {/* 방 코드는 영숫자라 픽셀 폰트를 써도 안전하다(한글은 금지). */}
        <p className="mt-2 font-pixel text-4xl text-ink" translate="no">
          {room.code}
        </p>
        {qr ? (
          <img
            src={qr}
            alt={`${room.code} 방 입장 QR 코드. 폰 카메라로 찍으면 바로 입장해요`}
            className="mx-auto mt-5 h-56 w-56 rounded-2xl border border-hairline bg-white p-2"
          />
        ) : (
          <p className="mt-5 text-sm text-ink-body">
            QR이 안 만들어졌어요. 아래 주소를 대신 알려주세요.
          </p>
        )}
        <p className="mt-4 break-all text-xs text-ink-muted">{joinUrl}</p>
        <Button
          type="button"
          variant="ghost"
          className="mt-4 w-full"
          onClick={() => {
            navigator.clipboard
              ?.writeText(joinUrl)
              .then(() => setNotice("입장 링크를 복사했어요. 붙여넣어 보내 주세요."))
              .catch(() => setNotice("복사가 안 됐어요. 위 주소를 직접 알려주세요."));
          }}
        >
          입장 링크 복사하기
        </Button>
      </section>

      {/* 큰 화면은 이 링크 하나로만 열린다 — 호스트 폰과 빔은 다른 탭이어야 한다. */}
      <section className="rounded-3xl bg-card p-4 shadow-clay">
        <a
          href={`/tv/${code}`}
          target="_blank"
          rel="noreferrer"
          className={`${PILL} w-full bg-primary text-on-primary`}
        >
          TV 화면 열기 ↗
        </a>
        <p className="mt-2 text-center text-xs text-ink-muted">
          새 탭으로 열려요. 빔프로젝터나 큰 화면에 그 탭을 띄워 두세요. 진행 버튼은
          거기에 안 보여요.
        </p>
      </section>

      <section className="grid grid-cols-2 gap-3 text-center">
        <div className="rounded-3xl bg-card p-4 shadow-clay">
          <p className="text-3xl font-bold text-ink">{participants.length}</p>
          <p className="mt-1 text-xs text-ink-muted">참가자</p>
        </div>
        <div className="rounded-3xl bg-card p-4 shadow-clay">
          <p className="text-3xl font-bold text-ink">{verified}</p>
          <p className="mt-1 text-xs text-ink-muted">인증된 미션 사진</p>
        </div>
      </section>

      {!hostToken && (
        <Card accentColor="var(--color-brand-ochre)" className="text-sm">
          <p className="font-bold text-ink">지금은 보기만 할 수 있어요</p>
          <p className="mt-1 text-ink-body">
            방을 만든 기기에서 이 주소를 열면 바로 진행할 수 있어요. 진행을 넘겨받는
            거라면, 그 기기에서 받은 진행 코드를 아래에 붙여넣어 주세요.
          </p>
          <form
            className="mt-4 flex flex-col gap-2"
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
              className="min-h-12 w-full rounded-full border border-hairline bg-card-plain px-4 text-sm text-ink placeholder:text-ink-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
              placeholder="넘겨받은 진행 코드"
            />
            <button
              type="submit"
              className={`${PILL} w-full bg-primary text-on-primary`}
            >
              이 기기로 진행하기
            </button>
          </form>
        </Card>
      )}

      {error && (
        <p
          role="alert"
          className="rounded-2xl bg-error/10 px-4 py-3 text-sm font-medium text-error"
        >
          {error}
        </p>
      )}
      {notice && (
        <p role="status" className="text-sm text-ink-body">
          {notice}
        </p>
      )}

      <fieldset disabled={!hostToken || busy !== ""} className="contents">
        <section>
          <h2 className="mb-2 text-sm font-bold text-ink">미션 분위기</h2>
          <div className="grid grid-cols-4 gap-2">
            {TONES.map((tone) => (
              <button
                key={tone}
                type="button"
                aria-label={`미션 분위기 고르기, ${tone}`}
                aria-pressed={room.tone_preset === tone}
                className={`min-h-12 rounded-full text-sm font-semibold transition active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink ${
                  room.tone_preset === tone
                    ? "bg-primary text-on-primary"
                    : "bg-surface-variant text-ink hover:bg-surface-dim"
                } disabled:opacity-40`}
                onClick={() => patchRoom({ tonePreset: tone })}
              >
                {tone}
              </button>
            ))}
          </div>
          <p className="mt-2 text-xs text-ink-muted">
            지금 고른 분위기로 AI가 미션을 골라요. 이미 들어온 사람의 빙고판은 그대로예요.
          </p>
        </section>

        {/* 행 전체가 label — 체크박스(28px)만으로는 터치 타깃 44px 을 못 채운다. */}
        <label
          htmlFor="reward"
          className="flex min-h-16 cursor-pointer items-center justify-between gap-4 rounded-3xl bg-card p-4 shadow-clay"
        >
          <span className="text-sm">
            <span className="block font-bold text-ink">현장 리워드</span>
            <span className="block text-xs text-ink-muted">
              오늘 상품이 걸려 있으면 켜 두세요.
            </span>
          </span>
          <input
            id="reward"
            type="checkbox"
            className="h-7 w-7 shrink-0 accent-primary disabled:opacity-40"
            checked={room.reward_on}
            onChange={() => patchRoom({ rewardOn: !room.reward_on })}
          />
        </label>

        <section className="flex flex-col gap-2">
          <h2 className="text-sm font-bold text-ink">파티 진행</h2>
          {room.status === "lobby" && (
            <Button
              type="button"
              className="w-full"
              onClick={() => patchRoom({ status: "live" })}
            >
              파티 시작하기
            </Button>
          )}
          <Button
            type="button"
            variant="ghost"
            className="w-full"
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
          </Button>
          <Button
            type="button"
            variant="ghost"
            className="w-full"
            onClick={() =>
              run("fourcut", async () => {
                const { alreadyRunning } = await post("/api/fourcut/start", {
                  roomCode: code,
                  hostToken,
                });
                setNotice(
                  alreadyRunning
                    ? "네컷 타임이 이미 돌고 있어요. TV 화면을 봐 주세요."
                    : "네컷 타임을 시작했어요! 5초 세고 나서 컷마다 7초씩, 다 같이 네 장을 찍어요.",
                );
                refresh();
              })
            }
          >
            {busy === "fourcut" ? "네컷 타임 여는 중이에요…" : "네컷 타임 시작하기 📸"}
          </Button>
          <Button
            type="button"
            variant="ghost"
            className="w-full"
            onClick={() =>
              run("award", async () => {
                await post(`/api/room/${code}/award`, { hostToken });
                setNotice("칭호를 발표했어요. TV 화면을 봐 주세요.");
                refresh();
              })
            }
          >
            {busy === "award" ? "AI가 칭호를 고르는 중이에요…" : "TV에 칭호 발표하기"}
          </Button>
          {/* error 색은 이 화면에서 여기에만 쓴다 — 되돌릴 수 없는 유일한 동작. */}
          {confirmEnd ? (
            <div className="rounded-3xl border border-error/40 bg-error/5 p-4">
              <p className="text-sm text-ink-body">
                파티를 끝낼까요? 한 번 끝내면 되돌릴 수 없어요. 새로 들어오거나 사진을
                올리는 건 막히고, 앨범과 네컷 티켓은 그대로 남아요.
              </p>
              {/* 나란히 두면 360px 폭에서 두 라벨이 다 줄바꿈된다 — 세로로 쌓는다. */}
              <div className="mt-4 flex flex-col gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  className="w-full"
                  onClick={() => setConfirmEnd(false)}
                >
                  계속 진행하기
                </Button>
                <button
                  type="button"
                  className={`${PILL} w-full bg-error text-on-error`}
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
              className={`${PILL} w-full border border-error text-error hover:bg-error/10`}
              onClick={() => setConfirmEnd(true)}
            >
              파티 끝내기
            </button>
          )}
        </section>

        <section>
          <h2 className="mb-2 text-sm font-bold text-ink">올라온 사진 {photos.length}장</h2>
          {photos.length === 0 ? (
            <p className="text-sm text-ink-muted">아직 첫 사진을 기다리는 중이에요 📸</p>
          ) : (
            <>
            <p className="mb-3 text-xs text-ink-muted">
              큰 화면에 띄우고 싶지 않은 사진은 TV에서 내려 주세요. 내려도 사진이 지워지지는
              않고, 언제든 다시 띄울 수 있어요.
            </p>
            <ul className="grid grid-cols-2 gap-3">
              {photos.map((photo) => {
                const owner = participants.find((p) => p.id === photo.owner_id);
                return (
                  <li
                    key={photo.id}
                    className="overflow-hidden rounded-2xl bg-card shadow-clay"
                  >
                    <img
                      src={photo.url}
                      alt={photo.caption || `${owner?.nickname ?? "누군가"}님이 올린 사진`}
                      className={`aspect-square w-full bg-surface-dim object-cover ${photo.hidden ? "opacity-40" : ""}`}
                    />
                    <div className="p-2">
                      <p className="truncate text-xs text-ink-muted">
                        {owner?.nickname ?? "누군가"}
                      </p>
                      <button
                        type="button"
                        aria-label={`${owner?.nickname ?? "누군가"}님의 사진 ${
                          photo.hidden ? "TV에 다시 띄우기" : "TV에서 내리기"
                        }`}
                        className="mt-1.5 min-h-11 w-full rounded-full bg-surface-variant text-xs font-semibold text-ink transition hover:bg-surface-dim active:scale-[0.98] disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
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

      {/* 쪽지 내리기는 게스트 화면의 방명록 탭에서 한다 — 이 기기엔 진행 코드가 있다. */}
      <Link
        href={`/play/${code}?tab=notes`}
        className={`${PILL} w-full border border-hairline text-ink hover:bg-surface-soft`}
      >
        방명록 보기 · 쪽지 내리기
      </Link>
    </main>
  );
}
