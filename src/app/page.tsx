"use client";

import { useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { Button, Card, LinkButton } from "@/components/ui";
import { BOTS, emojiAvatar } from "@/lib/bots";
import { setHostToken } from "@/lib/session";

const DEMO_KEY = "snapquest.demo";

const PITCH = [
  {
    n: "01",
    head: "내 폰에만 뜨는 미션 9칸",
    body: "AI가 참가자들을 서로 엮어서 나한테만 맞는 사진 미션을 깔아줘요. 옆 사람 판이랑 한 칸도 안 겹쳐요.",
  },
  {
    n: "02",
    head: "찍어서 올리면 그걸로 끝",
    body: "사진 한 장이면 AI가 알아서 칸을 채우고 캡션까지 붙여 큰 화면에 띄워요. 타이핑할 일은 없어요.",
  },
  {
    n: "03",
    head: "집에 갈 땐 네컷 한 장",
    body: "내 캐릭터랑 오늘 받은 칭호, 제일 잘 나온 사진이 네컷 티켓 한 장으로 남아요.",
  },
];

/** 서버에서는 알 수 없는 값이라 useSyncExternalStore 로 읽는다 — 하이드레이션 불일치 없이 클라이언트에서만 채워진다. */
const noSubscribe = () => () => {};
const readDemoCode = () => {
  try {
    return localStorage.getItem(DEMO_KEY) ?? "";
  } catch {
    return "";
  }
};

async function postJson(url: string, body: unknown) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    throw new Error(
      typeof data.error === "string" ? data.error : "잠깐 연결이 끊겼어요. 다시 눌러 주세요.",
    );
  }
  return data;
}

export default function Home() {
  const router = useRouter();
  const [busy, setBusy] = useState<"create" | "demo" | null>(null);
  const [error, setError] = useState("");
  const [code, setCode] = useState("");
  const [freshDemo, setFreshDemo] = useState("");
  const storedDemo = useSyncExternalStore(noSubscribe, readDemoCode, () => "");
  const demoCode = freshDemo || storedDemo;

  async function createRoom() {
    setBusy("create");
    setError("");
    try {
      const { room, hostToken } = (await postJson("/api/room", {})) as {
        room: { code: string };
        hostToken: string;
      };
      setHostToken(room.code, hostToken);
      router.push(`/host/${room.code}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "방을 만들지 못했어요. 잠시 뒤 다시 눌러 주세요.");
      setBusy(null);
    }
  }

  async function createDemo() {
    setBusy("demo");
    setError("");
    try {
      // 고정 코드의 방 하나를 재사용한다. 라우트가 없으면 만들고, 비었으면
      // 봇과 사진을 다시 채우므로, 앞사람이 어지럽힌 뒤에 들어와도 파티가
      // 진행 중인 상태로 열린다.
      const res = await fetch("/api/demo");
      const { code, hostToken } = (await res.json()) as {
        code?: string;
        hostToken?: string;
        error?: string;
      };
      if (!res.ok || !code) throw new Error("데모 방을 열지 못했어요. 다시 눌러 주세요.");
      if (hostToken) setHostToken(code, hostToken);
      try {
        localStorage.setItem(DEMO_KEY, code);
      } catch {
        // 저장 못 해도 이번 세션에서는 아래 링크로 들어갈 수 있다
      }
      setFreshDemo(code);
    } catch (e) {
      setError(e instanceof Error ? e.message : "데모 방을 열지 못했어요. 다시 눌러 주세요.");
    } finally {
      setBusy(null);
    }
  }

  function enterRoom(e: React.FormEvent) {
    e.preventDefault();
    if (code.length !== 6) {
      setError("방 코드 6자리를 다 넣어 주세요.");
      return;
    }
    router.push(`/play/${code}`);
  }

  return (
    <main className="relative flex flex-1 flex-col items-center overflow-hidden px-5 pb-16 pt-12">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-[420px] opacity-70 blur-3xl"
        style={{
          background:
            "radial-gradient(38% 60% at 22% 12%, #ff3d8b55, transparent 70%), " +
            "radial-gradient(42% 55% at 84% 0%, #7c5cff55, transparent 70%), " +
            "radial-gradient(30% 40% at 55% 28%, #c9ff4d22, transparent 70%)",
        }}
      />

      <div className="relative w-full max-w-md">
        <p className="inline-flex items-center gap-2 rounded-full border border-white/15 px-3 py-1 text-xs font-medium text-white/70">
          <span className="size-1.5 rounded-full bg-pop" />
          파티하는 동안 같이 노는 AI
        </p>

        <h1 className="mt-5 text-4xl font-extrabold leading-tight tracking-tight">
          Snap<span className="text-accent">Quest</span>
        </h1>
        <p className="mt-3 text-lg font-semibold leading-snug text-white/90">
          QR 한 번 찍으면 내 폰에 나만의 사진 미션 9칸이 뜨고,
          <br />
          파티가 끝나면 그 판이 네컷 사진 한 장으로 남아요.
        </p>

        <ol className="mt-7 space-y-3">
          {PITCH.map((p) => (
            <li key={p.n} className="flex gap-3">
              <span className="mt-0.5 shrink-0 font-mono text-sm font-bold text-accent">
                {p.n}
              </span>
              <span className="text-sm leading-relaxed text-white/70">
                <b className="font-semibold text-white">{p.head}</b> — {p.body}
              </span>
            </li>
          ))}
        </ol>

        <div className="mt-8 space-y-3">
          <Button
            className="w-full"
            onClick={createRoom}
            disabled={busy !== null}
          >
            {busy === "create" ? "파티 방 만드는 중이에요…" : "친구들과 할 파티 방 만들기"}
          </Button>

          <form onSubmit={enterRoom} className="flex gap-2">
            <label htmlFor="room-code" className="sr-only">
              방 코드 6자리
            </label>
            <input
              id="room-code"
              value={code}
              onChange={(e) =>
                setCode(e.target.value.replace(/[^A-Za-z0-9]/g, "").toUpperCase().slice(0, 6))
              }
              inputMode="text"
              autoCapitalize="characters"
              autoComplete="off"
              spellCheck={false}
              maxLength={6}
              placeholder="방 코드 6자리"
              className="min-h-12 w-full rounded-xl border border-white/15 bg-white/5 px-4 font-mono text-lg tracking-[0.2em] placeholder:font-sans placeholder:text-base placeholder:tracking-normal placeholder:text-white/35 focus:border-accent focus:outline-none"
            />
            <Button type="submit" variant="ghost" disabled={code.length !== 6}>
              입장하기
            </Button>
          </form>

          {error && (
            <p role="alert" className="text-sm text-pop">
              {error}
            </p>
          )}
        </div>

        <Card className="mt-8">
          <h2 className="text-sm font-bold text-white">심사관용 데모</h2>
          <p className="mt-1 text-sm leading-relaxed text-white/60">
            봇 참가자 6명이 이미 놀고 있는 방이에요. 혼자 열어도 파티가 돌아가요.
            실제 파티에서는 세 화면이 동시에 켜져 있어요 — TV는 빔에, 호스트는 진행자 폰에,
            게스트는 참가자 폰에. 아래 링크로 나란히 열어보세요.
          </p>

          <div aria-hidden className="mt-3 flex -space-x-2">
            {BOTS.map((b) => (
              // eslint-disable-next-line @next/next/no-img-element -- SVG data URI, 최적화할 원본이 없다
              <img
                key={b.nickname}
                src={emojiAvatar(b.nickname, b.emoji)}
                alt=""
                width={32}
                height={32}
                className="size-8 rounded-lg ring-2 ring-[#0a0910]"
              />
            ))}
          </div>

          <Button
            className="mt-4 w-full"
            variant={demoCode ? "ghost" : "primary"}
            onClick={createDemo}
            disabled={busy !== null}
          >
            {busy === "demo" ? "데모 방 여는 중이에요…" : "혼자 둘러보는 데모 방 열기"}
          </Button>

          {demoCode && (
            <div className="mt-4">
              <p className="text-sm text-white/60">
                방 코드{" "}
                <b className="font-mono tracking-[0.2em] text-accent">{demoCode}</b>
              </p>
              <div className="mt-2 grid grid-cols-3 gap-2">
                {[
                  { href: `/tv/${demoCode}`, label: "TV", hint: "빔에 띄우는 화면" },
                  { href: `/host/${demoCode}`, label: "호스트", hint: "진행자 폰" },
                  { href: `/play/${demoCode}`, label: "게스트", hint: "참가자 폰" },
                ].map((l) => (
                  <LinkButton
                    key={l.href}
                    href={l.href}
                    target="_blank"
                    rel="noreferrer"
                    aria-label={`${l.label} 화면 새 탭에서 열기 — ${l.hint}`}
                    className="flex-col gap-0 px-2 text-sm"
                  >
                    {l.label}
                    <span className="text-[11px] font-normal text-white/50">{l.hint}</span>
                  </LinkButton>
                ))}
              </div>
            </div>
          )}
        </Card>

        <p className="mt-6 text-center text-xs text-white/35">
          설치도 로그인도 없어요 · 사진은 7일 뒤 자동으로 지워져요
        </p>
      </div>
    </main>
  );
}
