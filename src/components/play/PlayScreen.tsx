"use client";
/* eslint-disable @next/next/no-img-element */

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import Guestbook from "@/components/notes/Guestbook";
import { readFourcut } from "@/lib/fourcut";
import { browserDb } from "@/lib/db/client";
import {
  getMyParticipant,
  getRoomPhotos,
  getRoomWithParticipants,
} from "@/lib/db/queries";
import { completedLines } from "@/lib/db/types";
import type { BoardCell, Participant, Photo, Room } from "@/lib/db/types";
import { getSessionToken } from "@/lib/session";
import { Button, Card, Logo } from "@/components/ui";
import Album from "./Album";
import FourcutSheet from "./FourcutSheet";
import { fileToJpegDataUrl } from "./image";

type Tab = "board" | "album" | "notes";

/** <label> 로 감싼 파일 피커용. ui/Button 의 BASE 와 같은 모양·같은 터치 타깃(48px). */
const PILL =
  "inline-flex min-h-12 w-full cursor-pointer items-center justify-center gap-2 rounded-full " +
  "px-6 text-base font-semibold transition active:scale-[0.98]";
/** 하단 탭. 활성 알약은 brand-pink-hot + 검정 글자(흰 글자는 3.2:1 로 불합격). */
// px-2: 탭 3개 + 카메라 버튼이 360px 폭에 함께 들어가야 한다. 높이 48px 로 터치 타깃은 유지.
const TAB = "min-h-12 flex-1 rounded-full px-2 text-sm font-semibold transition active:scale-[0.98]";
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
  initialTab?: Tab;
}) {
  const [room, setRoom] = useState<Room | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [me, setMe] = useState<Participant | null>(null);
  const [loading, setLoading] = useState(true);
  const [fatal, setFatal] = useState<string | null>(null);

  const [tab, setTab] = useState<Tab>(initialTab ?? "board");
  /** 닫아버린 네컷 세션의 startedAt — 같은 판을 다시 밀어올리지 않는다. */
  const [dismissedCut, setDismissedCut] = useState<string | null>(null);
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
        <p className="animate-pulse text-sm text-ink-muted">파티 여는 중이에요…</p>
      </main>
    );
  }

  if (fatal || !room) {
    return (
      <main className="flex flex-1 flex-col items-center justify-center gap-4 p-6 text-center">
        <p className="text-sm text-ink-body">
          {fatal ?? "파티를 불러오지 못했어요. 다시 눌러 주세요."}
        </p>
        <Button
          onClick={() => {
            setLoading(true);
            void load();
          }}
        >
          다시 불러오기
        </Button>
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

  // 네컷 타임. 진행은 startedAt 에서 계산하므로 방 행만 있으면 폰·TV 가 같은 값을 본다.
  const fourcut = readFourcut(room.state);
  const fourcutLive = fourcut ? now < Date.parse(fourcut.deadline) : false;

  return (
    <main className="flex flex-1 flex-col pb-28">
      <header className="sticky top-0 z-20 border-b border-hairline bg-surface/95 px-4 pt-3 pb-2.5 backdrop-blur">
        <div className="flex items-center gap-3">
          {me?.avatar_url ? (
            <img
              src={me.avatar_url}
              alt={`${me.nickname}의 캐릭터`}
              className="size-11 shrink-0 rounded-full bg-surface-variant object-cover ring-2 ring-card-plain"
            />
          ) : (
            <div
              className={`size-11 shrink-0 rounded-full bg-surface-variant ring-2 ring-card-plain ${me ? "animate-pulse" : ""}`}
              aria-hidden
            />
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-bold text-ink">{me?.nickname ?? "게스트"}</p>
            <p className="text-xs text-ink-muted">
              {me ? `${code} · 미션 ${doneCount}/9 · 빙고 ${lines}줄` : `${code} · 앨범만 보는 중`}
            </p>
          </div>
          <span className="rounded-full bg-surface-variant px-3 py-1 text-xs font-semibold text-ink-body">
            {daysLeft > 0 ? `앨범 D-${daysLeft}` : "앨범 마감"}
          </span>
        </div>
        {daysLeft <= 3 && (
          <p className="mt-2.5 rounded-2xl bg-brand-blush/45 px-3 py-2 text-xs leading-relaxed text-ink-body">
            {daysLeft > 0
              ? `앨범은 ${daysLeft}일 뒤에 문을 닫아요. 마음에 드는 사진은 길게 눌러 저장해 두세요.`
              : "앨범은 오늘 문을 닫아요. 남은 사진은 지금 길게 눌러 저장해 두세요."}
          </p>
        )}
      </header>

      {/* 파티가 끝나면 갈 곳은 하나 — 엔딩 티켓. 여기가 유일한 입구다. */}
      {ended && me && (
        <Card accentColor="var(--color-brand-pink-hot)" className="mx-4 mt-3 text-center">
          <p className="text-sm font-bold text-ink">파티가 끝났어요 🎊</p>
          <p className="mt-1 text-xs leading-relaxed text-ink-muted">
            오늘 찍은 사진으로 나만의 네컷 티켓을 만들어 가져가세요.
          </p>
          <Link
            href={`/ticket/${code}`}
            data-testid="make-ticket"
            className="mt-3 inline-flex min-h-14 w-full items-center justify-center rounded-full bg-primary px-6 text-base font-bold text-on-primary transition active:scale-[0.98]"
          >
            내 네컷 티켓 만들기 →
          </Link>
        </Card>
      )}

      {(room.status === "award" || room.status === "ended") && me?.title && (
        <Card accentColor="var(--color-brand-ochre)" className="mx-4 mt-3 mb-3 text-center">
          <p className="text-xs text-ink-muted">나의 칭호</p>
          <p className="mt-1 text-xl font-black tracking-tight text-ink">🏆 {me.title}</p>
          {me.title_basis && <p className="mt-1 text-xs text-ink-muted">{me.title_basis}</p>}
        </Card>
      )}

      {room.status === "award" && me && (
        <section className="mt-3 mb-3 px-4">
          <h2 className="mb-2 text-sm font-bold text-ink">
            베스트샷 투표 {votedId && "· 투표했어요"}
          </h2>
          {photos.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-hairline bg-surface-soft px-4 py-6 text-center text-xs text-ink-muted">
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
                    className={`block w-28 overflow-hidden rounded-2xl border-2 bg-card-plain shadow-clay transition active:scale-[0.98] ${
                      votedId === photo.id ? "border-primary" : "border-transparent"
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

      {tab === "notes" ? (
        <Guestbook
          roomId={room.id}
          roomCode={code}
          participants={participants}
          me={me}
        />
      ) : tab === "board" && me ? (
        <section className="px-4 pt-3">
          <ul className="grid grid-cols-3 gap-2.5">
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
                    data-testid={`cell-${i}`}
                    data-status={done ? "done" : judging ? "judging" : "todo"}
                    className={`relative flex aspect-square w-full flex-col overflow-hidden rounded-2xl p-2 text-center text-[11px] leading-tight shadow-clay transition active:scale-[0.97] ${
                      done
                        ? "justify-end bg-card"
                        : judging
                          ? "items-center justify-center bg-surface-soft ring-2 ring-brand-ochre"
                          : "items-center justify-center bg-surface-variant"
                    }`}
                  >
                    {(done && photo) || judging ? (
                      <img
                        src={judging ? pending.preview : photo!.url}
                        alt=""
                        aria-hidden
                        className={`absolute inset-0 size-full object-cover ${
                          judging ? "opacity-30" : ""
                        }`}
                      />
                    ) : null}
                    {/* 완료 칸은 사진이 꽉 찬다 — 미션 문구가 어떤 사진 위에서도 읽히도록 아래쪽만 어둡게 깐다. */}
                    {done && photo && (
                      <span
                        aria-hidden
                        className="absolute inset-0 bg-gradient-to-t from-ink/85 via-ink/35 to-transparent"
                      />
                    )}
                    <span
                      className={`relative z-10 line-clamp-4 font-medium ${
                        done && photo ? "text-white" : "text-ink"
                      }`}
                    >
                      {cell?.mission ?? "미션 준비 중…"}
                    </span>
                    {done && (
                      <span className="absolute top-1.5 right-1.5 z-10 grid size-6 place-items-center rounded-full bg-brand-peach text-[11px] font-black text-ink shadow-clay">
                        ✓
                      </span>
                    )}
                    {judging && (
                      <span className="absolute bottom-1.5 z-10 animate-pulse rounded-full bg-brand-ochre px-2 py-0.5 text-[10px] font-bold text-ink">
                        AI가 보는 중
                      </span>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
          {board.length === 0 && (
            <p className="mt-3 text-center text-xs text-ink-muted">
              AI가 나만의 미션을 고르는 중이에요
            </p>
          )}
          {lines > 0 && (
            <p
              role="status"
              className="mt-3 rounded-2xl bg-brand-ochre/30 px-3 py-2.5 text-center text-sm font-bold text-ink"
            >
              {lines === 1
                ? "빙고 한 줄 완성! 이 기세로 한 줄 더 가볼까요 🎉"
                : `빙고 ${lines}줄 완성! 오늘 제일 잘 노는 사람 🎉`}
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

      <nav className="fixed inset-x-0 bottom-0 z-30 flex items-center gap-2 rounded-t-3xl bg-surface-variant px-4 pt-2.5 pb-[max(0.625rem,env(safe-area-inset-bottom))] shadow-clay-lg">
        {me && (
          <>
            <button
              onClick={() => setTab("board")}
              aria-current={tab === "board" ? "page" : undefined}
              className={`${TAB} ${tab === "board" ? "bg-brand-pink-hot text-ink" : "text-ink-muted"}`}
            >
              빙고판
            </button>
            <label className="flex min-h-14 min-w-14 cursor-pointer items-center justify-center rounded-full bg-primary text-2xl text-on-primary shadow-clay transition active:scale-95">
              <span className="sr-only">미션 없이 사진 찍기</span>
              <span aria-hidden>📷</span>
              <input
                type="file"
                accept="image/*"
                capture
                className="sr-only"
                data-testid="free-photo"
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
          data-testid="go-album"
          className={`${TAB} ${tab === "album" ? "bg-brand-pink-hot text-ink" : "text-ink-muted"}`}
        >
          앨범
        </button>
        <button
          onClick={() => setTab("notes")}
          aria-current={tab === "notes" ? "page" : undefined}
          data-testid="go-notes"
          className={`${TAB} ${tab === "notes" ? "bg-brand-pink-hot text-ink" : "text-ink-muted"}`}
        >
          방명록
        </button>
        {!me && (
          <Button onClick={() => setAlbumOnly(false)} className="flex-1">
            입장하기
          </Button>
        )}
      </nav>

      {sheetCell !== null && (
        <Sheet onClose={() => setSheetCell(null)} title={board[sheetCell]?.mission ?? "미션 없이 한 장"}>
          <p className="text-xs leading-relaxed text-ink-muted">
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
                ? pending.cellIndex === null
                  ? "앨범에 올렸어요!"
                  : "인증 통과! 칸 채웠어요"
                : "한 번만 확인해 주세요"
          }
        >
          {pending.preview && (
            <img
              src={pending.preview}
              alt="방금 올린 사진"
              className="max-h-56 w-full rounded-2xl bg-card object-contain"
            />
          )}
          {pending.phase === "error" ? (
            <>
              <p className="text-sm text-error">{pending.message}</p>
              <PickButton
                label="다시 찍기"
                capture
                primary
                onPick={(f) => void upload(f, pending.cellIndex)}
              />
            </>
          ) : (
            <>
              <p className="text-sm leading-relaxed text-ink-body">{pending.caption}</p>
              {pending.verified ? (
                <Button onClick={() => setPending(null)} className="w-full">
                  빙고판으로 돌아가기
                </Button>
              ) : (
                <>
                  <p className="text-xs leading-relaxed text-ink-muted">
                    사진은 잘 올라갔어요. 지금 다들 올리는 중이라 AI가 좀 바빠요. 직접 누르면 칸이 바로
                    채워져요.
                  </p>
                  <Button disabled={busy} onClick={() => void selfCheck()} className="w-full">
                    이 사진으로 인증하기
                  </Button>
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

      {/* 네컷 타임: 호스트가 시작하면 폰에 그냥 뜬다. 닫으면 다시 열 버튼만 남는다. */}
      {me && fourcut && fourcutLive && dismissedCut !== fourcut.startedAt && (
        <FourcutSheet
          code={code}
          session={fourcut}
          onClose={() => setDismissedCut(fourcut.startedAt)}
        />
      )}

      {me && fourcut && fourcutLive && dismissedCut === fourcut.startedAt && (
        <button
          onClick={() => setDismissedCut(null)}
          className="fixed bottom-24 left-1/2 z-40 min-h-12 -translate-x-1/2 rounded-full bg-brand-pink-hot px-5 text-sm font-bold text-ink shadow-clay-lg"
        >
          네컷 타임 다시 열기 📸
        </button>
      )}

      {pending?.phase === "judging" && pending.cellIndex === null && (
        <p className="fixed bottom-24 left-1/2 z-40 -translate-x-1/2 animate-pulse rounded-full bg-brand-ochre px-4 py-2 text-xs font-bold text-ink shadow-clay-lg">
          AI가 사진 보는 중이에요…
        </p>
      )}

      {viewing && (
        <div
          className="fixed inset-0 z-50 flex flex-col justify-center gap-3 bg-ink/95 p-4"
          onClick={() => setViewing(null)}
        >
          <img
            src={viewing.url}
            alt={viewing.caption || "파티에서 찍은 사진"}
            className="max-h-[70vh] w-full rounded-3xl object-contain"
            onClick={(e) => e.stopPropagation()}
          />
          <p className="text-center text-sm text-white/90">{viewing.caption}</p>
          {viewing.mc_reaction && (
            <p className="text-center text-xs text-brand-peach">🎤 {viewing.mc_reaction}</p>
          )}
          <p className="text-center text-xs text-stage-ink-muted">
            사진을 길게 누르면 폰에 저장돼요.
          </p>
          <button
            onClick={() => setViewing(null)}
            className="mx-auto min-h-12 rounded-full bg-card-plain px-8 text-base font-semibold text-ink transition active:scale-[0.98]"
          >
            닫기
          </button>
        </div>
      )}

      {toast && (
        <p
          role="status"
          className="fixed bottom-24 left-1/2 z-40 -translate-x-1/2 rounded-full bg-ink px-4 py-2 text-xs font-semibold text-surface shadow-clay-lg"
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
    <div className="fixed inset-0 z-40 flex items-end bg-ink/50 backdrop-blur-sm" onClick={onClose}>
      <div
        className="w-full space-y-3 rounded-t-3xl bg-surface p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-clay-lg"
        onClick={(e) => e.stopPropagation()}
        data-testid="sheet"
      >
        <span aria-hidden className="mx-auto block h-1.5 w-10 rounded-full bg-surface-variant" />
        <h2 className="text-base font-bold tracking-tight text-ink">{title}</h2>
        {children}
        <Button variant="ghost" onClick={onClose} className="w-full">
          닫기
        </Button>
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
      className={`${PILL} ${
        primary
          ? "bg-primary text-on-primary"
          : "border border-hairline bg-card-plain text-ink hover:bg-surface-soft"
      }`}
    >
      {label}
      {/* Bare `capture` opens the camera but leaves the front/back choice to
          the phone. "environment" pins it to the rear lens, which is wrong
          for the missions here — most of them are two people in one frame. */}
      <input
        type="file"
        accept="image/*"
        {...(capture ? { capture: true } : {})}
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
      return setMessage("셀카 한 장이나 자기소개, 둘 중 하나만 넣어 주세요. 그걸로 캐릭터를 만들어요.");
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
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-5 p-6">
      <div className="text-center">
        <Logo className="text-2xl" />
        <p className="mt-4 text-xs font-semibold tracking-widest text-brand-pink">방 {code}</p>
        <h1 className="mt-1 text-2xl font-black tracking-tight text-ink">파티에 입장하기</h1>
        <p className="mt-2 text-sm leading-relaxed text-ink-muted">
          이름 하나, 그리고 셀카나 자기소개 중 하나만 있으면 돼요. 그걸 보고 AI가 내 캐릭터랑 빙고판을
          만들어 줘요.
        </p>
      </div>

      {ended && (
        <p className="rounded-2xl bg-surface-variant px-4 py-3 text-xs leading-relaxed text-ink-body">
          이미 끝난 파티예요. 대신 앨범에서 그날 사진은 볼 수 있어요.
        </p>
      )}

      <Card accentColor="var(--color-brand-peach)">
        {/* 참고 화면 순서: 원형 아바타 → 라벨 + 입력 → 검정 알약. */}
        <form onSubmit={submit} className="space-y-5">
          <div className="flex flex-col items-center gap-3">
            {selfie ? (
              <img
                src={selfie}
                alt="선택한 셀카 미리보기"
                className="size-28 rounded-full bg-surface-variant object-cover shadow-clay ring-4 ring-card-plain"
              />
            ) : (
              <div
                className="size-28 rounded-full bg-surface-variant shadow-clay ring-4 ring-card-plain"
                aria-hidden
              />
            )}
            <span className="block text-center text-xs font-semibold tracking-wide text-ink-muted">
              셀카 한 장 · 이것만 해도 돼요
            </span>
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

          <div>
            <label
              htmlFor="nickname"
              className="mb-1.5 block text-xs font-semibold tracking-wide text-ink-muted"
            >
              TV에 뜰 이름
            </label>
            <input
              id="nickname"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              maxLength={20}
              autoComplete="nickname"
              placeholder="예) 소미, 3번 테이블 형"
              className="min-h-12 w-full rounded-2xl border border-hairline bg-card-plain px-4 text-base text-ink outline-none placeholder:text-ink-muted focus:border-ink"
            />
          </div>

          <div>
            <label
              htmlFor="intro"
              className="mb-1.5 block text-xs font-semibold tracking-wide text-ink-muted"
            >
              자기소개 세 줄 · 셀카 대신 이것만 해도 돼요
            </label>
            <textarea
              id="intro"
              value={intro}
              onChange={(e) => setIntro(e.target.value)}
              rows={3}
              maxLength={300}
              placeholder={"예) 사진 찍는 거 좋아함\n맥주보다 하이볼\n오늘 처음 온 사람"}
              className="w-full rounded-2xl border border-hairline bg-card-plain px-4 py-3 text-base text-ink outline-none placeholder:text-ink-muted focus:border-ink"
            />
          </div>

          {message && (
            <p role="alert" className="text-sm text-error">
              {message}
            </p>
          )}

          <Button type="submit" disabled={busy || ended} className="w-full text-lg">
            {busy ? "입장하는 중이에요…" : "파티 입장하기"}
          </Button>
          <Button type="button" variant="ghost" onClick={onAlbumOnly} className="w-full">
            앨범만 둘러보기
          </Button>
        </form>
      </Card>
    </main>
  );
}
