"use client";

/**
 * 참가자 엔딩 티켓 (F7).
 *
 * 티어다운 ㉓ 선점 렌더링 — 진입하면 스피너가 아니라 **이미 합성된 티켓**이 등장한다.
 * 데이터가 오는 즉시 기본 프레임 + 추천 4장으로 합성을 시작하고, 프레임·사진을
 * 바꿀 때만 재합성한다.
 *
 * 추천 4장은 규칙 기반(생성형 호출 0): 베스트샷 득표 수 → 인증 시각 순. 이건
 * "AI 가 못 골라서"가 아니라 **"파티가 고른 4컷"** 이다(㉔).
 */

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  clearPick,
  DEFAULT_TICKET_FRAME,
  FRAME_LABEL,
  isLocked,
  placePick,
  TICKET_FRAMES,
  unlockState,
  type TicketFrame,
} from "@/app/api/ticket/frames";
import { H, LAYOUT, W } from "@/lib/canvas/constants";
import type { TicketResult } from "@/lib/canvas/ticket";
import { browserDb } from "@/lib/db/client";
import { getMyParticipant, getRoomPhotos, getRoomWithParticipants } from "@/lib/db/queries";
import type { Participant, Photo, Room } from "@/lib/db/types";
import { saveImage } from "@/lib/download";
import { RETENTION_NOTICE, retentionLabel } from "@/lib/retention";
import { getSessionToken } from "@/lib/session";
import { composeTicket } from "./gold";

interface Data {
  room: Room;
  me: Participant;
  participants: Participant[];
  myPhotos: Photo[];
}

type Phase = "loading" | "ready" | "no-room" | "no-join";

export default function TicketScreen({ code }: { code: string }) {
  const [phase, setPhase] = useState<Phase>("loading");
  const [data, setData] = useState<Data | null>(null);
  const [picks, setPicks] = useState<string[]>([]);
  const [frame, setFrame] = useState<TicketFrame>(DEFAULT_TICKET_FRAME);
  /** 합성 결과와 그 blob URL 은 항상 짝으로 교체된다 — 화면에 이전 픽셀이 남지 않게. */
  const [view, setView] = useState<{ result: TicketResult; url: string } | null>(null);
  const [reveal, setReveal] = useState(0);
  const [picking, setPicking] = useState<number | null>(null);
  const [showUnlock, setShowUnlock] = useState(false);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [notice, setNotice] = useState("");

  const token = useRef("");
  /** D-day 각인이 재합성마다 흔들리지 않도록 기준 시각을 한 번만 잡는다. */
  const [now] = useState(() => new Date());

  /* ── 로드: 방 · 나 · 내 사진 · 득표 ── */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      token.current = getSessionToken();
      const [rp, me] = await Promise.all([
        getRoomWithParticipants(code),
        getMyParticipant(code, token.current),
      ]);
      if (cancelled) return;
      if (!rp) return setPhase("no-room");
      if (!me) return setPhase("no-join");

      const [photos, votes] = await Promise.all([
        getRoomPhotos(rp.room.id),
        countVotes(rp.room.id),
      ]);
      if (cancelled) return;

      // 규칙 기반 추천: 득표 → 인증 시각. 내 사진만 쓴다(부족하면 카드로 채워진다).
      const mine = photos
        .filter((p) => p.owner_id === me.id)
        .sort(
          (a, b) =>
            (votes.get(b.id) ?? 0) - (votes.get(a.id) ?? 0) ||
            Date.parse(a.created_at) - Date.parse(b.created_at),
        );

      setData({ room: rp.room, me, participants: rp.participants, myPhotos: mine });
      setPicks(mine.slice(0, 4).map((p) => p.id));
      setPhase("ready");
    })().catch(() => !cancelled && setPhase("no-room"));
    return () => {
      cancelled = true;
    };
  }, [code]);

  /* ── 합성: 데이터가 오면 버튼을 기다리지 않고 바로 굽는다 ── */
  useEffect(() => {
    if (!data) return;
    let stale = false;
    const byId = new Map(data.myPhotos.map((p) => [p.id, p]));
    (async () => {
      try {
        const result = await composeTicket(frame, {
          roomName: `${data.room.tone_preset} 파티`,
          nickname: data.me.nickname,
          title: data.me.title,
          avatarUrl: data.me.avatar_url,
          photoUrls: picks.map((id) => byId.get(id)?.url),
          takenAt: new Date(data.room.ended_at ?? data.room.created_at),
          expiresAt: new Date(data.room.expires_at),
          now,
        });
        const url = URL.createObjectURL(result.blob);
        if (stale) URL.revokeObjectURL(url);
        else setView({ result, url });
      } catch (error) {
        if (!stale) {
          setNotice(
            error instanceof Error ? error.message : "티켓을 만들지 못했어요.",
          );
        }
      }
    })();
    return () => {
      stale = true;
    };
  }, [data, picks, frame, now]);

  /* 화면 표시는 blob → <img>. canvas 를 그대로 붙이면 iOS 에서 길게 눌러 저장이 안 된다. */
  useEffect(() => {
    const url = view?.url;
    if (!url) return;
    // 즉시 revoke 하면 교체 직후 한 프레임이 비어 보인다.
    return () => {
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    };
  }, [view]);

  /* 4컷 순차 리빌 — 우리 긴장의 축은 카운트다운이 아니라 선정의 불확실성이다. */
  useEffect(() => {
    if (!view || reveal >= 4) return;
    const t = setTimeout(() => setReveal((r) => r + 1), reveal === 0 ? 140 : 280);
    return () => clearTimeout(t);
  }, [view, reveal]);

  const unlock = useMemo(
    () =>
      data
        ? unlockState(
            data.me.board,
            data.participants.filter((p) => p.invited_by === data.me.id).length,
          )
        : null,
    [data],
  );

  const place = useCallback((slot: number, photoId: string) => {
    setPicks((cur) => placePick(cur, slot, photoId));
    setPicking(null);
  }, []);

  const pickFrame = useCallback(
    (f: TicketFrame) => {
      if (isLocked(f) && !unlock?.unlocked) {
        setShowUnlock(true);
        return;
      }
      setShowUnlock(false);
      setFrame(f);
    },
    [unlock],
  );

  const copyInvite = useCallback(async () => {
    if (!data) return;
    const url = `${location.origin}/play/${code}?invite=${data.me.id}`;
    try {
      await navigator.clipboard.writeText(url);
      setNotice("초대 링크를 복사했어요. 한 명만 들어와도 프레임이 열려요.");
    } catch {
      setNotice(url);
    }
  }, [code, data]);

  const onSave = useCallback(async () => {
    if (!view || !data) return;
    setBusy(true);
    setNotice("");
    try {
      // 저장 전에 서버가 해금을 다시 판정한다. 화면 계산은 안내용일 뿐이다.
      const gate = await record(code, token.current, frame, view.result.blob);
      if (gate === "locked") {
        setFrame(DEFAULT_TICKET_FRAME);
        setNotice("아직 잠긴 프레임이라 기본 프레임으로 되돌렸어요.");
        setShowUnlock(true);
        return;
      }
      const result = await saveImage(
        view.result.blob,
        `snapquest_${data.me.nickname}_${code}.jpg`,
      );
      if (result === "cancelled") {
        setNotice("저장을 취소했어요.");
      } else {
        setSaved(true);
        setNotice(result === "shared" ? "공유했어요!" : "사진에 저장했어요.");
      }
    } catch (error) {
      setNotice(
        error instanceof Error
          ? error.message
          : "저장에 실패했어요. 이미지를 길게 눌러 저장해 주세요.",
      );
    } finally {
      setBusy(false);
    }
  }, [code, data, frame, view]);

  if (phase === "no-room") return <Empty title="방을 찾을 수 없어요" href="/" cta="처음으로" />;
  if (phase === "no-join") {
    return (
      <Empty
        title="이 방에 입장한 기록이 없어요"
        desc="티켓은 참가자에게만 발급돼요."
        href={`/play/${code}`}
        cta="입장하기"
      />
    );
  }

  const dday = data ? retentionLabel(data.room.expires_at, now) : "";
  const albumHref = `/play/${code}?tab=album`;

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col gap-4 px-4 py-5">
      <header className="flex items-baseline justify-between gap-2">
        <h1 className="text-lg font-bold">내 엔딩 티켓</h1>
        <span className="text-xs text-white/50">{dday}</span>
      </header>

      {data && data.room.status !== "ended" && (
        <p className="rounded-xl bg-white/5 px-3 py-2 text-xs text-white/60">
          파티가 아직 진행 중이에요 — 지금까지 모인 사진으로 미리 만들어 뒀어요.
        </p>
      )}

      {/* 선점 렌더링: 스피너 대신 티켓이 등장하고, 4컷이 한 장씩 꽂힌다. */}
      <div
        className="relative w-full overflow-hidden rounded-2xl bg-[#0f0e18] shadow-2xl"
        style={{ aspectRatio: `${W} / ${H}` }}
      >
        {view && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={view.url}
            alt="내 엔딩 티켓"
            className="h-full w-full select-none object-contain"
            draggable={false}
          />
        )}
        {[0, 1, 2, 3].map((i) => (
          <div
            key={`veil-${i}`}
            aria-hidden
            className="pointer-events-none absolute rounded-lg bg-[#1a1830] transition-all duration-500"
            style={{
              ...cellBox(i),
              opacity: i < reveal ? 0 : 1,
              transform: i < reveal ? "scale(1)" : "scale(0.92)",
            }}
          />
        ))}
        {[0, 1, 2, 3].map((i) => (
          <button
            key={`slot-${i}`}
            type="button"
            onClick={() => setPicking(i)}
            aria-label={`${i + 1}번 컷 바꾸기`}
            className="absolute rounded-lg ring-inset ring-accent/0 transition active:ring-2 active:ring-accent/80"
            style={cellBox(i)}
          />
        ))}
      </div>

      <p className="text-center text-xs text-white/50">
        칸을 탭하면 그 컷만 바꿀 수 있어요 · 이미지를 길게 눌러 사진에 저장할 수도 있어요
      </p>

      {view && view.result.failedCells.length > 0 && (
        <p className="rounded-xl bg-pop/15 px-3 py-2 text-xs text-pop">
          {view.result.failedCells.map((i) => i + 1).join("·")}번 컷을 불러오지 못해 카드로
          채웠어요.
        </p>
      )}

      <section className="flex flex-wrap gap-2">
        {TICKET_FRAMES.map((f) => {
          const locked = isLocked(f) && !unlock?.unlocked;
          return (
            <button
              key={f}
              type="button"
              onClick={() => pickFrame(f)}
              className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                frame === f
                  ? "bg-accent text-black"
                  : locked
                    ? "bg-white/5 text-white/40"
                    : "bg-white/10 text-white"
              }`}
            >
              {locked ? "🔒 " : ""}
              {FRAME_LABEL[f]}
            </button>
          );
        })}
      </section>

      {showUnlock && unlock && !unlock.unlocked && (
        <section className="rounded-2xl bg-white/5 p-4 text-sm">
          <p className="font-semibold">골드 프레임 해금 조건 (둘 중 하나)</p>
          <ul className="mt-2 space-y-1 text-white/70">
            <li>{unlock.bingoLines >= 1 ? "✅" : "⬜"} 빙고 1줄 완성하기</li>
            <li>{unlock.invited >= 1 ? "✅" : "⬜"} 내 초대 링크로 1명 입장 (현재 {unlock.invited}명)</li>
          </ul>
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={copyInvite}
              className="flex-1 rounded-xl bg-white/10 px-3 py-2 font-semibold"
            >
              초대 링크 복사
            </button>
            <Link
              href={`/play/${code}`}
              className="flex-1 rounded-xl bg-white/10 px-3 py-2 text-center font-semibold"
            >
              빙고 이어서 하기
            </Link>
          </div>
        </section>
      )}

      <div className="flex gap-2">
        <button
          type="button"
          onClick={onSave}
          disabled={!view || busy}
          className="flex-1 rounded-2xl bg-accent px-4 py-3.5 text-base font-bold text-black disabled:opacity-50"
        >
          {busy ? "저장 중…" : "티켓 저장 · 공유"}
        </button>
        <Link
          href={albumHref}
          className="rounded-2xl bg-white/10 px-4 py-3.5 text-base font-semibold"
        >
          앨범
        </Link>
      </div>

      {notice && <p className="text-center text-sm text-white/70">{notice}</p>}

      {/* 저장·공유 후 dead-end 금지 — 앨범으로 귀결시킨다. */}
      {saved && (
        <Link
          href={albumHref}
          className="rounded-2xl bg-white/10 p-4 text-center text-sm font-semibold"
        >
          모두의 사진은 공동 앨범에 남아 있어요 → 앨범 보러 가기
        </Link>
      )}

      <p className="pb-6 text-center text-xs text-white/40">{RETENTION_NOTICE}</p>

      {picking !== null && data && (
        <PhotoSheet
          slot={picking}
          photos={data.myPhotos}
          picks={picks}
          onPick={place}
          onClear={() => {
            setPicks((cur) => clearPick(cur, picking));
            setPicking(null);
          }}
          onClose={() => setPicking(null)}
        />
      )}
    </main>
  );
}

/* ── 사진 선택 시트: 슬롯별 교체·스왑. slice(0,4) 로 잘라 넣지 않는다(P1). ── */

function PhotoSheet({
  slot,
  photos,
  picks,
  onPick,
  onClear,
  onClose,
}: {
  slot: number;
  photos: Photo[];
  picks: string[];
  onPick: (slot: number, photoId: string) => void;
  onClear: () => void;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-end bg-black/70" onClick={onClose}>
      <div
        className="max-h-[75dvh] w-full overflow-y-auto rounded-t-3xl bg-[#151322] p-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <p className="font-bold">{slot + 1}번 컷 바꾸기</p>
          <button type="button" onClick={onClose} className="text-sm text-white/60">
            닫기
          </button>
        </div>

        {photos.length === 0 ? (
          <p className="py-8 text-center text-sm text-white/60">
            아직 내 사진이 없어요. 빈 칸은 캐릭터·칭호 카드로 채워집니다.
          </p>
        ) : (
          <div className="grid grid-cols-3 gap-2">
            {photos.map((p) => {
              const at = picks.indexOf(p.id);
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => onPick(slot, p.id)}
                  className={`relative aspect-4/3 overflow-hidden rounded-xl ${
                    at >= 0 ? "ring-2 ring-accent" : ""
                  }`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={p.url}
                    alt={p.caption || "내 사진"}
                    className="h-full w-full object-cover"
                    loading="lazy"
                  />
                  {at >= 0 && (
                    <span className="absolute right-1 top-1 rounded-full bg-accent px-1.5 text-xs font-bold text-black">
                      {at + 1}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}

        {slot < picks.length && (
          <button
            type="button"
            onClick={onClear}
            className="mt-3 w-full rounded-xl bg-white/10 px-3 py-2.5 text-sm font-semibold"
          >
            이 칸 비우기 (캐릭터·칭호 카드로 채움)
          </button>
        )}
      </div>
    </div>
  );
}

function Empty({
  title,
  desc,
  href,
  cta,
}: {
  title: string;
  desc?: string;
  href: string;
  cta: string;
}) {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col items-center justify-center gap-4 px-6 text-center">
      <h1 className="text-xl font-bold">{title}</h1>
      {desc && <p className="text-sm text-white/60">{desc}</p>}
      <Link href={href} className="rounded-2xl bg-accent px-6 py-3 font-bold text-black">
        {cta}
      </Link>
    </main>
  );
}

/* ── 유틸 ── */

/** 캔버스 셀 좌표를 그대로 % 로 환산 — 미리보기와 출력이 같은 상수에서 나온다(P3). */
function cellBox(i: number): React.CSSProperties {
  const c = LAYOUT.cells[i];
  return {
    left: `${(c.x / W) * 100}%`,
    top: `${(c.y / H) * 100}%`,
    width: `${(c.w / W) * 100}%`,
    height: `${(c.h / H) * 100}%`,
  };
}

async function countVotes(roomId: string): Promise<Map<string, number>> {
  const tally = new Map<string, number>();
  try {
    const { data } = await browserDb()
      .from("votes")
      .select("photo_id")
      .eq("room_id", roomId);
    for (const v of (data ?? []) as { photo_id: string }[]) {
      tally.set(v.photo_id, (tally.get(v.photo_id) ?? 0) + 1);
    }
  } catch {
    // 득표를 못 읽으면 시각 순으로만 정렬된다. 티켓은 그대로 나온다.
  }
  return tally;
}

/** 서버가 해금을 재판정하고 ticket_url·ticket_frame 을 기록한다. */
async function record(
  code: string,
  sessionToken: string,
  frame: TicketFrame,
  blob: Blob,
): Promise<"ok" | "locked" | "offline"> {
  try {
    const res = await fetch("/api/ticket", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        roomCode: code,
        sessionToken,
        frame,
        imageBase64: await toDataUrl(blob),
      }),
    });
    return res.status === 403 ? "locked" : "ok";
  } catch {
    // 파티장 와이파이는 반드시 죽는다 — 기록 실패가 저장을 막지 않는다(⑧).
    return "offline";
  }
}

function toDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(String(fr.result));
    fr.onerror = () => reject(new Error("티켓 이미지를 읽지 못했어요."));
    fr.readAsDataURL(blob);
  });
}
