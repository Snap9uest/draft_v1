/* eslint-disable @next/next/no-img-element */
"use client";

/* 빔프로젝터 표시 전용. 조작 요소를 절대 넣지 않는다. */

import { useCallback, useEffect, useRef, useState } from "react";
import { browserDb } from "@/lib/db/client";
import { getRoomPhotos, getRoomWithParticipants } from "@/lib/db/queries";
import type { BoardCell, Participant, Photo, Room } from "@/lib/db/types";

type Data = {
  room: Room;
  participants: Participant[];
  photos: Photo[];
  votes: Record<string, number>;
};

const MC_INTROS = [
  "{n}님 등장! 오늘 판이 좀 커지는데요 ✨",
  "{n}님 어서 오세요. 빙고판은 벌써 깔아뒀어요 🎯",
  "{n}님 합류! 반가운 얼굴이 하나 늘었어요 🎉",
  "{n}님, 카메라부터 켜 두세요 📸",
  "{n}님 들어오니까 분위기가 확 사네요 🔥",
  "{n}님은 어떤 미션을 받았을까요? 👀",
  "{n}님 도착. 이제 진짜 시작이에요 🚀",
  "{n}님, 오늘 주인공 자리 노려볼까요? 🏆",
];

const MC_REACTIONS = [
  "{n}님, 한 칸 채웠어요 🎯",
  "와 {n}님, 이건 좀 잘 찍었는데요 📸",
  "{n}님 미션 성공! 다음 칸도 가볼까요 🔥",
  "{n}님 사진 올라왔어요. 다들 보세요 👀",
  "오늘의 베스트샷 후보, {n}님 🏆",
  "{n}님 이 표정은 반칙이죠 😂",
  "{n}님 손 빠르네요. 벌써 한 장 ⚡",
  "{n}님 사진은 앨범에도 바로 담겼어요 🖼️",
];

/** 사진이 아직 없을 때 돌려 쓰는 초대 멘트. */
const WALL_NUDGES = [
  "첫 사진 올리는 사람이 오늘의 시작이에요 📸",
  "지금 올리면 이 화면 제일 큰 자리를 차지해요 ✨",
  "미션은 사람마다 달라요. 내 폰부터 확인해 보세요 🎯",
  "제일 쉬워 보이는 미션 하나부터 찍어볼까요 👀",
];

/** 참가자가 0명일 때 로비/포토월을 채우는 예시 미션. */
const SAMPLE_MISSIONS = [
  "처음 만난 사람과 하이파이브 샷 ✋",
  "음식을 들고 건배 포즈 🥂",
  "단체로 점프하는 에너지 샷 🦘",
  "어깨동무 우정 샷 🤝",
  "가장 신난 표정 대결 🤪",
  "다같이 하트 포즈 ❤️",
];

function hash(s: string): number {
  let h = 0;
  for (const ch of s) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return h;
}

const pick = (list: string[], seed: string, nickname: string) =>
  list[hash(seed) % list.length].replace("{n}", nickname);

async function getVotes(roomId: string): Promise<Record<string, number>> {
  try {
    const { data } = await browserDb()
      .from("votes")
      .select("photo_id")
      .eq("room_id", roomId);
    const tally: Record<string, number> = {};
    for (const v of data ?? []) {
      const id = v.photo_id as string;
      tally[id] = (tally[id] ?? 0) + 1;
    }
    return tally;
  } catch {
    return {};
  }
}

/** 연출용 카운터. 4초마다 1씩. */
function useTick(ms: number): number {
  const [n, setN] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setN((v) => v + 1), ms);
    return () => clearInterval(t);
  }, [ms]);
  return n;
}

export default function TvScreen({ code }: { code: string }) {
  const [data, setData] = useState<Data | null>(null);
  const [missing, setMissing] = useState(false);
  const [fresh, setFresh] = useState<string[]>([]);
  const seen = useRef<Set<string> | null>(null);
  const freshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const loaded = useRef(false);
  const tick = useTick(5000);

  const load = useCallback(async () => {
    const res = await getRoomWithParticipants(code);
    // 조회 실패(네트워크 끊김 포함)면 마지막 화면을 그대로 둔다.
    if (!res) {
      if (!loaded.current) setMissing(true);
      return;
    }
    const [photos, votes] = await Promise.all([
      getRoomPhotos(res.room.id),
      getVotes(res.room.id),
    ]);

    const ids = photos.map((p) => p.id);
    if (seen.current) {
      const added = ids.filter((id) => !seen.current?.has(id));
      if (added.length) {
        setFresh(added);
        if (freshTimer.current) clearTimeout(freshTimer.current);
        freshTimer.current = setTimeout(() => setFresh([]), 12_000);
      }
    }
    seen.current = new Set(ids);
    loaded.current = true;

    setMissing(false);
    setData({ room: res.room, participants: res.participants, photos, votes });
  }, [code]);

  useEffect(() => {
    void load();
  }, [load]);

  const roomId = data?.room.id;
  useEffect(() => {
    if (!roomId) return;
    const refresh = () => void load();
    const db = browserDb();
    const room = `id=eq.${roomId}`;
    const mine = `room_id=eq.${roomId}`;
    const ch = db
      .channel(`tv:${roomId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "rooms", filter: room }, refresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "participants", filter: mine }, refresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "photos", filter: mine }, refresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "votes", filter: mine }, refresh)
      .subscribe();

    // 빔에 몇 시간씩 떠 있는 화면이라 소켓이 조용히 끊겨도 복구돼야 한다.
    const onVisible = () => {
      if (document.visibilityState === "visible") refresh();
    };
    document.addEventListener("visibilitychange", onVisible);
    const poll = setInterval(refresh, 20_000);

    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      clearInterval(poll);
      void db.removeChannel(ch);
    };
  }, [roomId, load]);

  useEffect(() => () => {
    if (freshTimer.current) clearTimeout(freshTimer.current);
  }, []);

  if (!data) {
    return (
      <Shell code={code}>
        <Center>
          <p className="text-[clamp(1.5rem,3vw,3rem)] text-white/70">
            {missing ? `${code} 방을 찾을 수 없어요` : "파티 여는 중이에요…"}
          </p>
        </Center>
      </Shell>
    );
  }

  const { room, participants, photos, votes } = data;
  const view =
    room.status === "lobby" ? (
      <Lobby participants={participants} tick={tick} />
    ) : room.status === "live" ? (
      <PhotoWall participants={participants} photos={photos} fresh={fresh} tick={tick} />
    ) : (
      <Award
        participants={participants}
        photos={photos}
        votes={votes}
        tick={tick}
        ended={room.status === "ended"}
      />
    );

  return (
    <Shell code={room.code} count={participants.length} photos={photos.length}>
      {view}
    </Shell>
  );
}

/* ── 공통 껍데기 ─────────────────────────────────────────── */

function Shell({
  code,
  count,
  photos,
  children,
}: {
  code: string;
  count?: number;
  photos?: number;
  children: React.ReactNode;
}) {
  return (
    <main className="flex min-h-screen flex-col bg-[#0b0a14] text-white">
      <style>{`
        @keyframes sq-pop { from { transform: scale(.86); opacity: 0 } to { transform: none; opacity: 1 } }
        @keyframes sq-glow { 0%, 100% { box-shadow: 0 0 0 0 rgba(250,204,21,0) } 50% { box-shadow: 0 0 0 14px rgba(250,204,21,.35) } }
        @keyframes sq-fade { from { opacity: 0; transform: translateY(14px) } to { opacity: 1; transform: none } }
        @keyframes sq-breathe { 0%, 100% { opacity: .3 } 50% { opacity: .8 } }
        .sq-pop { animation: sq-pop .5s ease-out both }
        .sq-new { animation: sq-pop .5s ease-out both, sq-glow 1.8s ease-in-out 3 }
        .sq-fade { animation: sq-fade .6s ease-out both }
        .sq-breathe { animation: sq-breathe 2.4s ease-in-out infinite }
        @media (prefers-reduced-motion: reduce) { .sq-pop, .sq-new, .sq-fade, .sq-breathe { animation: none } }
      `}</style>

      <header className="flex items-baseline justify-between gap-6 px-[3vw] pt-[2.5vh] pb-[1.5vh]">
        <div className="flex items-baseline gap-[1.5vw]">
          <span className="text-[clamp(1rem,1.4vw,1.75rem)] font-semibold tracking-[0.35em] text-fuchsia-300">
            SNAPQUEST
          </span>
          <span className="text-[clamp(2.5rem,5vw,6rem)] font-black leading-none tracking-[0.1em] tabular-nums">
            {code}
          </span>
        </div>
        <p className="text-[clamp(1rem,1.6vw,2rem)] text-white/60">
          {count !== undefined ? `참가자 ${count}명` : ""}
          {photos !== undefined ? ` · 사진 ${photos}장` : ""}
        </p>
      </header>

      <div className="flex min-h-0 flex-1 flex-col px-[3vw] pb-[3vh]">{children}</div>
    </main>
  );
}

function Center({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-[3vh] text-center">
      {children}
    </div>
  );
}

function Avatar({ p, size }: { p: Participant; size: string }) {
  const label = `${p.nickname}님의 캐릭터`;
  return p.avatar_url ? (
    <img
      src={p.avatar_url}
      alt={label}
      className={`${size} rounded-[22%] bg-white/10 object-cover`}
    />
  ) : (
    <div
      role="img"
      aria-label={label}
      className={`${size} flex items-center justify-center rounded-[22%] bg-white/10 text-[2vw] font-bold`}
    >
      {p.nickname.slice(0, 1)}
    </div>
  );
}

/** 사회자 멘트 배너. 화면 하단 고정. */
function McBanner({ text }: { text: string }) {
  return (
    <p
      key={text}
      className="sq-fade mt-[2vh] rounded-3xl bg-gradient-to-r from-fuchsia-600/80 to-violet-600/80 px-[2.5vw] py-[2vh] text-center text-[clamp(1.5rem,2.6vw,3.25rem)] font-bold leading-snug"
      aria-live="polite"
    >
      {text}
    </p>
  );
}

/* ── 로비 ────────────────────────────────────────────────── */

function Lobby({ participants, tick }: { participants: Participant[]; tick: number }) {
  if (!participants.length) {
    return (
      <>
        <Center>
          <p className="text-[clamp(2rem,4vw,4.5rem)] font-black">
            제일 먼저 들어올 사람?
          </p>
          <div className="flex gap-[2vw]">
            {SAMPLE_MISSIONS.slice(0, 5).map((m, i) => (
              <div
                key={m}
                className="sq-breathe size-[7vw] rounded-[22%] bg-white/10"
                style={{ animationDelay: `${i * 0.25}s` }}
              />
            ))}
          </div>
          <p className="text-[clamp(1.25rem,2vw,2.5rem)] text-white/60">
            호스트 폰의 QR을 찍거나, 위에 뜬 코드 여섯 자를 넣으면 끝 — 설치도 로그인도 없어요
          </p>
        </Center>
        <McBanner text="폰 열고 QR 한 번이면 바로 파티예요 🎉" />
      </>
    );
  }

  const spotlight = participants[tick % participants.length];
  const intro = spotlight.intro
    ? `${spotlight.nickname} — “${spotlight.intro}”`
    : pick(MC_INTROS, spotlight.id, spotlight.nickname);
  // 아직 서넛뿐이면 한 번 걸러 한 번은 "더 들어오세요"를 띄운다.
  const line =
    participants.length < 3 && tick % 2
      ? "아직 자리 넉넉해요. QR 찍고 들어오세요 🎉"
      : intro;

  return (
    <>
      <div className="grid flex-1 content-start grid-cols-[repeat(auto-fill,minmax(clamp(140px,12vw,260px),1fr))] gap-[2vw]">
        {participants.map((p) => (
          <div
            key={p.id}
            className={`sq-pop flex flex-col items-center gap-[1vh] rounded-3xl p-[1vw] text-center ${
              p.id === spotlight.id ? "bg-white/10 ring-4 ring-fuchsia-400" : ""
            }`}
          >
            <Avatar p={p} size="size-[clamp(80px,9vw,190px)]" />
            <p className="text-[clamp(1rem,1.5vw,1.9rem)] font-bold">{p.nickname}</p>
            {p.is_bot && (
              <span className="text-[clamp(.7rem,.9vw,1.1rem)] text-white/40">봇 참가자</span>
            )}
          </div>
        ))}
      </div>
      <McBanner text={line} />
    </>
  );
}

/* ── 포토월 ──────────────────────────────────────────────── */

function PhotoWall({
  participants,
  photos,
  fresh,
  tick,
}: {
  participants: Participant[];
  photos: Photo[];
  fresh: string[];
  tick: number;
}) {
  const nameOf = (id: string) =>
    participants.find((p) => p.id === id)?.nickname ?? "누군가";

  if (!photos.length) return <WaitingWall participants={participants} tick={tick} />;

  const shown = photos.slice(0, 12);
  const newest = shown.find((p) => fresh.includes(p.id));
  const banner = newest ?? shown[tick % shown.length];
  const bannerText =
    banner.mc_reaction ?? pick(MC_REACTIONS, banner.id, nameOf(banner.owner_id));

  return (
    <>
      <div className="grid flex-1 auto-rows-[minmax(0,1fr)] grid-cols-4 content-start gap-[1.5vw]">
        {shown.map((photo) => {
          const isNew = fresh.includes(photo.id);
          return (
            <figure
              key={photo.id}
              className={`relative overflow-hidden rounded-3xl bg-white/5 ${
                isNew ? "sq-new" : "sq-pop"
              } ${photo.id === newest?.id ? "col-span-2 row-span-2" : ""}`}
            >
              <img
                src={photo.url}
                alt={photo.caption || `${nameOf(photo.owner_id)}님의 인증 사진`}
                className="size-full object-cover"
              />
              <figcaption className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 to-transparent px-[1.2vw] pt-[6vh] pb-[1.2vh]">
                <p className="text-[clamp(.9rem,1.3vw,1.8rem)] font-bold leading-snug">
                  {photo.caption || "멋진 순간 📸"}
                </p>
                <p className="text-[clamp(.75rem,1vw,1.3rem)] text-white/70">
                  {nameOf(photo.owner_id)}
                </p>
              </figcaption>
              {isNew && (
                <span className="absolute left-[1vw] top-[1vh] rounded-full bg-yellow-400 px-[1vw] py-[0.6vh] text-[clamp(.75rem,1vw,1.3rem)] font-black text-black">
                  방금 도착
                </span>
              )}
            </figure>
          );
        })}
      </div>
      <McBanner text={bannerText} />
    </>
  );
}

function WaitingWall({
  participants,
  tick,
}: {
  participants: Participant[];
  tick: number;
}) {
  return (
    <>
      <Center>
        <div className="flex max-w-2xl flex-col items-center gap-6 rounded-3xl border border-white/10 bg-white/5 p-8 text-center">
          <span className="text-6xl animate-bounce">📸</span>
          <h2 className="text-3xl font-extrabold text-white">
            먼저 올린 사진이 여기 제일 크게 떠요
          </h2>
          <p className="text-xl leading-relaxed text-white/70">
            폰에 깔린 3×3 미션 중에 제일 쉬운 걸로 하나 찍어보세요.
            <br />
            올리자마자 이 화면에 떠요 ✨
          </p>
        </div>
      </Center>
      <McBanner text={WALL_NUDGES[tick % WALL_NUDGES.length]} />
    </>
  );
}

/* ── 시상 ────────────────────────────────────────────────── */

function Award({
  participants,
  photos,
  votes,
  tick,
  ended,
}: {
  participants: Participant[];
  photos: Photo[];
  votes: Record<string, number>;
  tick: number;
  ended: boolean;
}) {
  const titled = participants.filter((p) => p.title);
  const nameOf = (id: string) =>
    participants.find((p) => p.id === id)?.nickname ?? "누군가";

  const candidates = [...photos]
    .sort((a, b) => (votes[b.id] ?? 0) - (votes[a.id] ?? 0))
    .slice(0, 5);
  const top = Math.max(1, ...candidates.map((p) => votes[p.id] ?? 0));

  if (!titled.length) {
    return (
      <>
        <Center>
          <p className="sq-breathe text-[clamp(2rem,4.5vw,5rem)] font-black">
            {ended ? "파티가 끝났어요 🎊" : "AI가 오늘의 칭호를 고르는 중이에요"}
          </p>
          <p className="text-[clamp(1.25rem,2vw,2.5rem)] text-white/60">
            오늘 올라온 사진을 전부 다시 보고, 한 명씩 칭호를 붙이는 중이에요
          </p>
        </Center>
        <McBanner text="두구두구두구… 🥁" />
      </>
    );
  }

  const star = titled[tick % titled.length];

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-[2vh]">
      <section
        key={star.id}
        className="sq-fade flex items-center gap-[3vw] rounded-[2.5rem] bg-gradient-to-r from-amber-500/25 to-fuchsia-600/25 p-[2vw]"
        aria-live="polite"
      >
        <Avatar p={star} size="size-[clamp(120px,14vw,280px)]" />
        <div className="min-w-0">
          <p className="text-[clamp(1.1rem,1.8vw,2.2rem)] text-white/60">
            {ended ? "오늘의 칭호" : "방금 정해진 칭호 🥁"}
          </p>
          <p className="text-[clamp(2.2rem,5vw,6rem)] font-black leading-tight text-amber-300">
            {star.title}
          </p>
          <p className="text-[clamp(1.4rem,2.4vw,3rem)] font-bold">{star.nickname}</p>
          {star.title_basis && (
            <p className="text-[clamp(1rem,1.6vw,2rem)] text-white/70">{star.title_basis}</p>
          )}
        </div>
      </section>

      <div className="grid min-h-0 flex-1 grid-cols-[1fr_1.1fr] gap-[2vw]">
        <section className="min-h-0 overflow-hidden">
          <h2 className="mb-[1vh] text-[clamp(1.1rem,1.6vw,2rem)] text-white/50">
            모두의 칭호
          </h2>
          <ul className="grid grid-cols-2 gap-[1vw]">
            {titled.slice(0, 10).map((p) => (
              <li
                key={p.id}
                className={`flex items-center gap-[1vw] rounded-2xl px-[1vw] py-[1vh] ${
                  p.id === star.id ? "bg-white/10" : ""
                }`}
              >
                <Avatar p={p} size="size-[clamp(44px,4vw,84px)]" />
                <div className="min-w-0">
                  <p className="truncate text-[clamp(.95rem,1.3vw,1.7rem)] font-bold text-amber-200">
                    {p.title}
                  </p>
                  <p className="truncate text-[clamp(.8rem,1.1vw,1.4rem)] text-white/60">
                    {p.nickname}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </section>

        <section className="min-h-0">
          <h2 className="mb-[1vh] text-[clamp(1.1rem,1.6vw,2rem)] text-white/50">
            베스트샷 투표 · 폰에서 함께 투표해요
          </h2>
          {candidates.length ? (
            <ul className="flex flex-col gap-[1.2vh]">
              {candidates.map((photo) => {
                const n = votes[photo.id] ?? 0;
                return (
                  <li key={photo.id} className="flex items-center gap-[1.2vw]">
                    <img
                      src={photo.url}
                      alt={photo.caption || `${nameOf(photo.owner_id)}님의 사진`}
                      className="size-[clamp(56px,6vw,120px)] shrink-0 rounded-2xl object-cover"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[clamp(.95rem,1.4vw,1.8rem)] font-bold">
                        {photo.caption || nameOf(photo.owner_id)}
                      </p>
                      <div className="mt-[0.6vh] h-[1.6vh] overflow-hidden rounded-full bg-white/10">
                        <div
                          className="h-full rounded-full bg-amber-400 transition-[width] duration-700"
                          style={{ width: `${Math.round((n / top) * 100)}%` }}
                        />
                      </div>
                    </div>
                    <span className="w-[6vw] shrink-0 text-right text-[clamp(1.1rem,2vw,2.6rem)] font-black tabular-nums">
                      {n}표
                    </span>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="sq-breathe text-[clamp(1.1rem,1.8vw,2.2rem)] text-white/60">
              후보 사진을 모으는 중…
            </p>
          )}
        </section>
      </div>
    </div>
  );
}
