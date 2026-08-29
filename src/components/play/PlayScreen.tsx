"use client";
/* eslint-disable @next/next/no-img-element */

import { useCallback, useEffect, useState } from "react";
import { browserDb } from "@/lib/db/client";
import {
  getMyParticipant,
  getRoomPhotos,
  getRoomWithParticipants,
} from "@/lib/db/queries";
import { completedLines } from "@/lib/db/types";
import type { BoardCell, Participant, Photo, Room } from "@/lib/db/types";
import { getSessionToken } from "@/lib/session";
import Album from "./Album";
import { fileToJpegDataUrl } from "./image";

const BTN = "min-h-11 rounded-full px-5 font-semibold disabled:opacity-50";
const err = (e: unknown) => (e instanceof Error ? e.message : "잠깐 문제가 생겼어요. 다시 해볼까요?");

async function api<T>(url: string, body: unknown, method = "POST"): Promise<T> {
  const res = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) throw new Error(json.error ?? "연결이 잠깐 끊겼어요. 다시 해볼까요?");
  return json;
}

/** 업로드 한 건의 생애: 판정 대기 → 결과 시트. */
type Pending = {
  cellIndex: number | null;
  preview: string;
  phase: "judging" | "result" | "error";
  verified?: boolean;
  caption?: string;
  photoId?: string;
  message?: string;
};

export default function PlayScreen({
  code,
  invitedBy,
  initialTab,
}: {
  code: string;
  invitedBy?: string;
  initialTab?: "board" | "album";
}) {
  const [room, setRoom] = useState<Room | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [me, setMe] = useState<Participant | null>(null);
  const [loading, setLoading] = useState(true);
  const [fatal, setFatal] = useState<string | null>(null);

  const [tab, setTab] = useState<"board" | "album">(initialTab ?? "board");
  const [sheetCell, setSheetCell] = useState<number | null>(null);
  const [pending, setPending] = useState<Pending | null>(null);
  const [busy, setBusy] = useState(false);
  const [viewing, setViewing] = useState<Photo | null>(null);
  const [votedId, setVotedId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [albumOnly, setAlbumOnly] = useState(false);

  const roomId = room?.id;
  // 보관 D-day 기준 시각. 렌더 중 Date.now() 를 읽으면 SSR/CSR 이 어긋난다.
  const [now, setNow] = useState(() => Date.now());

  const load = useCallback(async () => {
    const data = await getRoomWithParticipants(code);
    if (!data) {
      setFatal("방을 찾을 수 없어요. 방 코드를 다시 확인해 주세요.");
      setLoading(false);
      return;
    }
    setFatal(null);
    setRoom(data.room);
    setParticipants(data.participants);
    const [mine, list] = await Promise.all([
      getMyParticipant(code, getSessionToken()),
      getRoomPhotos(data.room.id),
    ]);
    // 방금 join 응답으로 채운 me 를 조회 실패로 지워버리지 않는다.
    setMe((prev) => mine ?? prev);
    setPhotos(list);
    setNow(Date.now());
    setLoading(false);
  }, [code]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 마운트 시 최초 데이터 로드
    void load();
  }, [load]);

  // 실시간: 내 참가자(아바타·빙고판·칭호)·방 상태·사진. 이벤트마다 전체 재조회.
  useEffect(() => {
    if (!roomId) return;
    let channel: ReturnType<ReturnType<typeof browserDb>["channel"]> | null = null;

    const subscribe = () => {
      try {
        const db = browserDb();
        channel = db.channel(`play-${roomId}-${Date.now()}`);
        for (const table of ["rooms", "participants", "photos"] as const) {
          channel.on(
            "postgres_changes",
            {
              event: "*",
              schema: "public",
              table,
              filter: table === "rooms" ? `id=eq.${roomId}` : `room_id=eq.${roomId}`,
            },
            () => void load(),
          );
        }
        channel.subscribe();
      } catch {
        // 실시간이 막혀도 화면은 돈다 — 포그라운드 복귀 때 재조회로 따라잡는다.
      }
    };

    const teardown = () => {
      if (!channel) return;
      try {
        browserDb().removeChannel(channel);
      } catch {
        /* 이미 끊긴 채널 */
      }
      channel = null;
    };

    const onVisible = () => {
      if (document.visibilityState !== "visible") return;
      teardown();
      subscribe();
      void load();
    };

    subscribe();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      teardown();
    };
  }, [roomId, load]);

  // 파티가 끝나면 남는 화면은 빙고판이 아니라 앨범이다. 탭은 계속 눌러 되돌릴 수 있다.
  const ended = room?.status === "ended";
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 종료 전환 1회
    if (ended) setTab("album");
  }, [ended]);

  async function upload(file: File, cellIndex: number | null) {
    setSheetCell(null);
    let preview = "";
    try {
      preview = await fileToJpegDataUrl(file);
    } catch (e) {
      setPending({ cellIndex, preview: "", phase: "error", message: err(e) });
      return;
    }
    setPending({ cellIndex, preview, phase: "judging" });
    try {
      const res = await api<{ photo: Photo; verified: boolean; caption: string }>(
        "/api/photo",
        {
          roomCode: code,
          sessionToken: getSessionToken(),
          cellIndex,
          imageBase64: preview,
        },
      );
      setPending({
        cellIndex,
        preview,
        phase: "result",
        verified: res.verified,
        caption: res.caption,
        photoId: res.photo.id,
      });
      await load();
    } catch (e) {
      setPending({ cellIndex, preview, phase: "error", message: err(e) });
    }
  }

  async function selfCheck() {
    if (!pending?.photoId) return;
    setBusy(true);
    try {
      await api(`/api/photo/${pending.photoId}`, { sessionToken: getSessionToken() }, "PATCH");
      setPending(null);
      setToast("칸을 채웠어요. 다음 미션도 가볼까요?");
      await load();
    } catch (e) {
      setPending({ ...pending, phase: "error", message: err(e) });
    } finally {
      setBusy(false);
    }
  }

  async function vote(photoId: string) {
    setBusy(true);
    try {
      await api("/api/vote", { roomCode: code, sessionToken: getSessionToken(), photoId });
      setVotedId(photoId);
      setToast("베스트샷에 투표했어요.");
    } catch (e) {
      setToast(err(e));
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2600);
    return () => clearTimeout(t);
  }, [toast]);

  if (loading) {
    return (
      <main className="flex flex-1 items-center justify-center p-6">
        <p className="animate-pulse text-sm text-white/60">파티 여는 중이에요…</p>
      </main>
    );
  }

  if (fatal || !room) {
    return (
      <main className="flex flex-1 flex-col items-center justify-center gap-4 p-6 text-center">
        <p className="text-sm text-white/80">
          {fatal ?? "파티를 불러오지 못했어요. 다시 눌러 주세요."}
        </p>
        <button
          onClick={() => {
            setLoading(true);
            void load();
          }}
          className={`${BTN} bg-accent text-black`}
        >
          다시 불러오기
        </button>
      </main>
    );
  }

  // 세션이 없거나 다른 브라우저로 열었을 때: 입장하거나, 공동 앨범만 열람한다.
  if (!me && !albumOnly) {
    return (
      <JoinForm
        code={code}
        room={room}
        invitedBy={invitedBy}
        onJoined={setMe}
        onAlbumOnly={() => {
          setAlbumOnly(true);
          setTab("album");
        }}
      />
    );
  }

  const board: BoardCell[] = me && Array.isArray(me.board) ? me.board : [];
  const lines = completedLines(board);
  const doneCount = board.filter((c) => c.status === "done").length;
  const daysLeft = Math.ceil((new Date(room.expires_at).getTime() - now) / 86_400_000);
  const photoById = (id?: string) => photos.find((p) => p.id === id);

  return (
    <main className="flex flex-1 flex-col pb-28">
      <header className="sticky top-0 z-20 bg-background/95 px-4 pt-3 pb-2 backdrop-blur">
        <div className="flex items-center gap-3">
          {me?.avatar_url ? (
            <img
              src={me.avatar_url}
              alt={`${me.nickname}의 캐릭터`}
              className="size-11 shrink-0 rounded-full bg-white/10 object-cover"
            />
          ) : (
            <div
              className={`size-11 shrink-0 rounded-full bg-white/10 ${me ? "animate-pulse" : ""}`}
              aria-hidden
            />
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-bold">{me?.nickname ?? "게스트"}</p>
            <p className="text-xs text-white/55">
              {me ? `${code} · 미션 ${doneCount}/9 · 빙고 ${lines}줄` : `${code} · 앨범만 보는 중`}
            </p>
          </div>
          <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-white/70">
            {daysLeft > 0 ? `보관 D-${daysLeft}` : "보관 만료"}
          </span>
        </div>
        {daysLeft <= 3 && (
          <p className="mt-2 rounded-xl bg-pop/20 px-3 py-2 text-xs leading-relaxed text-pop">
            {daysLeft > 0
              ? `무료 보관이 D-${daysLeft} 남았어요. 사진을 길게 눌러 저장해 두세요.`
              : "무료 보관 기간이 끝났어요. 남은 사진을 지금 저장해 주세요."}
          </p>
        )}
      </header>

      {(room.status === "award" || room.status === "ended") && me?.title && (
        <section className="mx-4 mb-3 rounded-2xl bg-gradient-to-br from-pop/30 to-accent/20 p-4 text-center">
          <p className="text-xs text-white/70">나의 칭호</p>
          <p className="mt-1 text-xl font-black text-accent">🏆 {me.title}</p>
          {me.title_basis && <p className="mt-1 text-xs text-white/70">{me.title_basis}</p>}
        </section>
      )}

      {room.status === "award" && me && (
        <section className="mb-3 px-4">
          <h2 className="mb-2 text-sm font-bold">베스트샷 투표 {votedId && "· 투표했어요"}</h2>
          {photos.length === 0 ? (
            <p className="rounded-xl border border-dashed border-white/15 px-4 py-6 text-center text-xs text-white/50">
              아직 후보 사진이 없어요. 곧 올라올 거예요 📸
            </p>
          ) : (
            <ul className="flex gap-2 overflow-x-auto pb-1">
              {photos.slice(0, 24).map((photo) => (
                <li key={photo.id} className="shrink-0">
                  <button
                    disabled={busy}
                    onClick={() => void vote(photo.id)}
                    aria-label={`${
                      participants.find((p) => p.id === photo.owner_id)?.nickname ?? "누군가"
                    }님의 사진에 투표하기`}
                    className={`block w-28 overflow-hidden rounded-xl border-2 ${
                      votedId === photo.id ? "border-accent" : "border-transparent"
                    }`}
                  >
                    <img
                      src={photo.url}
                      alt={photo.caption || "투표 후보로 올라온 파티 사진"}
                      className="aspect-square w-full object-cover"
                    />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {tab === "board" && me ? (
        <section className="px-4">
          <ul className="grid grid-cols-3 gap-2">
            {Array.from({ length: 9 }, (_, i) => {
              const cell = board[i];
              const judging = pending?.cellIndex === i && pending.phase === "judging";
              const photo = photoById(cell?.photoId);
              const done = cell?.status === "done";
              return (
                <li key={i}>
                  <button
                    onClick={() => {
                      if (judging) return;
                      if (done && photo) setViewing(photo);
                      else setSheetCell(i);
                    }}
                    aria-label={`${i + 1}번 미션 ${cell?.mission ?? "준비 중"}. ${
                      done ? "인증 완료, 사진 보기" : "사진 올리기"
                    }`}
                    className={`relative flex aspect-square w-full flex-col items-center justify-center overflow-hidden rounded-xl p-1.5 text-center text-[11px] leading-tight ${
                      done
                        ? "bg-accent/20 ring-2 ring-accent"
                        : judging
                          ? "bg-white/10 ring-2 ring-pop"
                          : "bg-white/8 ring-1 ring-white/10"
                    }`}
                  >
                    {(done && photo) || judging ? (
                      <img
                        src={judging ? pending.preview : photo!.url}
                        alt=""
                        aria-hidden
                        className={`absolute inset-0 size-full object-cover ${
                          judging ? "opacity-35" : "opacity-70"
                        }`}
                      />
                    ) : null}
                    <span className="relative z-10 line-clamp-4 font-medium text-white drop-shadow">
                      {cell?.mission ?? "미션 준비 중…"}
                    </span>
                    {done && (
                      <span className="absolute top-1 right-1 z-10 rounded-full bg-accent px-1.5 text-[10px] font-black text-black">
                        ✓
                      </span>
                    )}
                    {judging && (
                      <span className="absolute bottom-1 z-10 animate-pulse rounded-full bg-pop px-2 py-0.5 text-[10px] font-bold text-white">
                        인증 중
                      </span>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
          {board.length === 0 && (
            <p className="mt-3 text-center text-xs text-white/50">
              AI가 나만의 미션을 고르는 중이에요
            </p>
          )}
          {lines > 0 && (
            <p className="mt-3 rounded-xl bg-accent/15 px-3 py-2 text-center text-sm font-bold text-accent">
              🎉 {lines}줄 빙고 달성!
            </p>
          )}
        </section>
      ) : (
        <Album
          code={code}
          photos={photos}
          participants={participants}
          me={me}
          daysLeft={daysLeft}
          onOpen={setViewing}
        />
      )}

      <nav className="fixed inset-x-0 bottom-0 z-30 flex items-center gap-2 border-t border-white/10 bg-background/95 px-4 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] backdrop-blur">
        {me && (
          <>
            <button
              onClick={() => setTab("board")}
              aria-current={tab === "board" ? "page" : undefined}
              className={`${BTN} flex-1 ${tab === "board" ? "bg-white/15" : "text-white/60"}`}
            >
              내 빙고판
            </button>
            <label className="flex min-h-14 min-w-14 cursor-pointer items-center justify-center rounded-full bg-accent text-2xl text-black">
              <span className="sr-only">미션 없이 사진 찍기</span>
              <span aria-hidden>📷</span>
              <input
                type="file"
                accept="image/*"
                capture="environment"
                className="sr-only"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  e.target.value = "";
                  if (file) void upload(file, null);
                }}
              />
            </label>
          </>
        )}
        <button
          onClick={() => setTab("album")}
          aria-current={tab === "album" ? "page" : undefined}
          className={`${BTN} flex-1 ${tab === "album" ? "bg-white/15" : "text-white/60"}`}
        >
          앨범
        </button>
        {!me && (
          <button
            onClick={() => setAlbumOnly(false)}
            className={`${BTN} flex-1 bg-accent text-black`}
          >
            입장하기
          </button>
        )}
      </nav>

      {sheetCell !== null && (
        <Sheet onClose={() => setSheetCell(null)} title={board[sheetCell]?.mission ?? "미션 없이 한 장"}>
          <p className="text-xs text-white/60">
            찍으면 AI가 알아서 인증하고 캡션을 달아줘요. 타이핑은 없어요.
          </p>
          <PickButton
            label="지금 찍기 📸"
            capture
            primary
            onPick={(f) => void upload(f, sheetCell)}
          />
          <PickButton label="앨범에서 고르기 🖼️" onPick={(f) => void upload(f, sheetCell)} />
        </Sheet>
      )}

      {pending && pending.phase !== "judging" && (
        <Sheet
          onClose={() => setPending(null)}
          title={
            pending.phase === "error"
              ? "사진이 안 올라갔어요"
              : pending.verified
                ? "인증 완료!"
                : "한 번만 확인해 주세요"
          }
        >
          {pending.preview && (
            <img
              src={pending.preview}
              alt="방금 올린 사진"
              className="max-h-56 w-full rounded-xl object-contain"
            />
          )}
          {pending.phase === "error" ? (
            <>
              <p className="text-sm text-pop">{pending.message}</p>
              <PickButton
                label="다시 찍기"
                capture
                primary
                onPick={(f) => void upload(f, pending.cellIndex)}
              />
            </>
          ) : (
            <>
              <p className="text-sm text-white/80">{pending.caption}</p>
              {pending.verified ? (
                <button
                  onClick={() => setPending(null)}
                  className={`${BTN} w-full bg-accent text-black`}
                >
                  빙고판으로 돌아가기
                </button>
              ) : (
                <>
                  <p className="text-xs text-white/60">
                    사진은 잘 올라갔어요. 직접 인증하면 칸이 바로 채워져요.
                  </p>
                  <button
                    disabled={busy}
                    onClick={() => void selfCheck()}
                    className={`${BTN} w-full bg-accent text-black`}
                  >
                    이 사진으로 인증하기
                  </button>
                  <PickButton
                    label="다시 찍기"
                    capture
                    onPick={(f) => void upload(f, pending.cellIndex)}
                  />
                </>
              )}
            </>
          )}
        </Sheet>
      )}

      {pending?.phase === "judging" && pending.cellIndex === null && (
        <p className="fixed bottom-24 left-1/2 z-40 -translate-x-1/2 animate-pulse rounded-full bg-pop px-4 py-2 text-xs font-bold text-white">
          사진 올리는 중이에요…
        </p>
      )}

      {viewing && (
        <div
          className="fixed inset-0 z-50 flex flex-col justify-center gap-3 bg-black/95 p-4"
          onClick={() => setViewing(null)}
        >
          <img
            src={viewing.url}
            alt={viewing.caption || "파티에서 찍은 사진"}
            className="max-h-[70vh] w-full rounded-2xl object-contain"
            onClick={(e) => e.stopPropagation()}
          />
          <p className="text-center text-sm text-white/85">{viewing.caption}</p>
          {viewing.mc_reaction && (
            <p className="text-center text-xs text-accent">🎤 {viewing.mc_reaction}</p>
          )}
          <p className="text-center text-xs text-white/50">
            사진을 길게 누르면 폰에 저장돼요.
          </p>
          <button onClick={() => setViewing(null)} className={`${BTN} mx-auto bg-white/15`}>
            닫기
          </button>
        </div>
      )}

      {toast && (
        <p
          role="status"
          className="fixed bottom-24 left-1/2 z-40 -translate-x-1/2 rounded-full bg-white/20 px-4 py-2 text-xs font-semibold backdrop-blur"
        >
          {toast}
        </p>
      )}
    </main>
  );
}

function Sheet({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-40 flex items-end bg-black/70" onClick={onClose}>
      <div
        className="w-full space-y-3 rounded-t-3xl bg-[#16141f] p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-base font-bold">{title}</h2>
        {children}
        <button onClick={onClose} className={`${BTN} w-full bg-white/10`}>
          닫기
        </button>
      </div>
    </div>
  );
}

function PickButton({
  label,
  capture,
  primary,
  onPick,
}: {
  label: string;
  capture?: boolean;
  primary?: boolean;
  onPick: (file: File) => void;
}) {
  return (
    <label
      className={`flex min-h-12 w-full cursor-pointer items-center justify-center rounded-full px-5 font-semibold ${
        primary ? "bg-accent text-black" : "bg-white/10"
      }`}
    >
      {label}
      <input
        type="file"
        accept="image/*"
        {...(capture ? { capture: "environment" as const } : {})}
        className="sr-only"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (file) onPick(file);
        }}
      />
    </label>
  );
}

function JoinForm({
  code,
  room,
  invitedBy,
  onJoined,
  onAlbumOnly,
}: {
  code: string;
  room: Room;
  invitedBy?: string;
  onJoined: (p: Participant) => void;
  onAlbumOnly: () => void;
}) {
  const [nickname, setNickname] = useState("");
  const [intro, setIntro] = useState("");
  const [selfie, setSelfie] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const ended = room.status === "ended";

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const name = nickname.trim();
    if (!name) return setMessage("TV에 뜰 이름을 정해 주세요.");
    if (!selfie && !intro.trim()) {
      return setMessage("셀카 1장 또는 자기소개를 넣어야 캐릭터를 만들 수 있어요.");
    }
    setMessage(null);
    setBusy(true);
    try {
      const res = await api<{ participant: Participant }>(`/api/room/${code}/join`, {
        nickname: name,
        intro: intro.trim(),
        selfieBase64: selfie ?? undefined,
        sessionToken: getSessionToken(),
        invitedBy,
      });
      onJoined(res.participant);
    } catch (e2) {
      setMessage(err(e2));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="flex flex-1 flex-col justify-center gap-5 p-6">
      <div>
        <p className="text-xs font-semibold tracking-widest text-accent">방 {code}</p>
        <h1 className="mt-1 text-2xl font-black">파티에 입장하기</h1>
        <p className="mt-1 text-sm text-white/60">
          이름과 셀카(또는 자기소개) 하나면 끝이에요. 캐릭터와 빙고판은 들어가면 AI가 만들어 줘요.
        </p>
      </div>

      {ended && (
        <p className="rounded-xl bg-white/10 px-3 py-2 text-xs text-white/70">
          이미 끝난 파티예요. 대신 앨범에서 그날 사진은 볼 수 있어요.
        </p>
      )}

      <form onSubmit={submit} className="space-y-4">
        <div>
          <label htmlFor="nickname" className="mb-1 block text-sm font-semibold">
            닉네임
          </label>
          <input
            id="nickname"
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            maxLength={20}
            autoComplete="nickname"
            placeholder="TV에 뜰 이름"
            className="min-h-12 w-full rounded-xl bg-white/10 px-4 text-base outline-none focus:ring-2 focus:ring-accent"
          />
        </div>

        <div>
          <span className="mb-1 block text-sm font-semibold">셀카 (선택)</span>
          <div className="flex items-center gap-3">
            {selfie ? (
              <img
                src={selfie}
                alt="선택한 셀카 미리보기"
                className="size-16 rounded-full object-cover"
              />
            ) : (
              <div className="size-16 rounded-full bg-white/10" aria-hidden />
            )}
            <PickButton
              label={selfie ? "다시 찍기" : "셀카 찍기"}
              capture
              onPick={async (file) => {
                try {
                  setSelfie(await fileToJpegDataUrl(file, 768));
                  setMessage(null);
                } catch (e3) {
                  setMessage(err(e3));
                }
              }}
            />
          </div>
        </div>

        <div>
          <label htmlFor="intro" className="mb-1 block text-sm font-semibold">
            자기소개 3줄 (셀카 대신 가능)
          </label>
          <textarea
            id="intro"
            value={intro}
            onChange={(e) => setIntro(e.target.value)}
            rows={3}
            maxLength={300}
            placeholder={"예) 사진 찍는 거 좋아함\n맥주보다 하이볼\n오늘 처음 온 사람"}
            className="w-full rounded-xl bg-white/10 px-4 py-3 text-base outline-none focus:ring-2 focus:ring-accent"
          />
        </div>

        {message && (
          <p role="alert" className="text-sm text-pop">
            {message}
          </p>
        )}

        <button
          type="submit"
          disabled={busy || ended}
          className={`${BTN} w-full bg-accent text-lg text-black`}
        >
          {busy ? "입장하는 중이에요…" : "파티 입장하기"}
        </button>
        <button type="button" onClick={onAlbumOnly} className={`${BTN} w-full bg-white/10`}>
          앨범만 둘러보기
        </button>
      </form>
    </main>
  );
}
