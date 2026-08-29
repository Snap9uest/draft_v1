"use client";
/* eslint-disable @next/next/no-img-element */

import { useState } from "react";
import type { Participant, Photo } from "@/lib/db/types";

export default function Album({
  code,
  photos,
  participants,
  me,
  daysLeft,
  onOpen,
}: {
  code: string;
  photos: Photo[];
  participants: Participant[];
  me: Participant | null;
  daysLeft: number;
  onOpen: (photo: Photo) => void;
}) {
  const [scope, setScope] = useState<"all" | "mine">("all");
  const [copied, setCopied] = useState(false);

  const mine = me ? photos.filter((p) => p.owner_id === me.id) : [];
  const shown = scope === "all" ? photos : mine;

  async function share() {
    const url = `${location.origin}/play/${code}${me ? `?invite=${me.id}` : ""}`;
    try {
      if (navigator.share) {
        await navigator.share({
          title: "SnapQuest 앨범",
          text: "우리 파티 사진, 여기 다 있어요.",
          url,
        });
        return;
      }
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // 사용자가 공유 시트를 닫은 경우 — 조용히 넘어간다
    }
  }

  return (
    <div className="space-y-4 px-4 pb-4">
      <div className="flex items-center gap-2">
        <div className="flex flex-1 rounded-full bg-white/10 p-1" role="tablist">
          {(["all", "mine"] as const).map((s) => (
            <button
              key={s}
              role="tab"
              aria-selected={scope === s}
              onClick={() => setScope(s)}
              className={`min-h-11 flex-1 rounded-full px-3 text-sm font-semibold transition ${
                scope === s ? "bg-accent text-black" : "text-white/70"
              }`}
            >
              {s === "all" ? `공동 롤필름 ${photos.length}` : `내 아카이브 ${mine.length}`}
            </button>
          ))}
        </div>
        <button
          onClick={share}
          className="min-h-11 min-w-11 rounded-full bg-white/10 px-4 text-sm font-semibold"
        >
          {copied ? "복사됨" : "공유"}
        </button>
      </div>

      <p className="rounded-xl bg-white/5 px-3 py-2 text-xs leading-relaxed text-white/60">
        사진을 <b className="text-white/90">길게 눌러</b> 폰에 저장하세요. 무료 보관은{" "}
        {daysLeft > 0 ? `D-${daysLeft}` : "오늘까지"}예요.
      </p>

      {scope === "mine" && me && <MyCard me={me} />}

      {shown.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-white/15 px-4 py-10 text-center text-sm text-white/50">
          {scope === "mine"
            ? "아직 올린 사진이 없어요. 빙고 탭에서 첫 미션을 찍어보세요."
            : "아직 올라온 사진이 없어요. 첫 사진의 주인공이 되어 보세요."}
        </p>
      ) : (
        <ul className="grid grid-cols-2 gap-2">
          {shown.map((photo) => (
            <li key={photo.id}>
              <button
                onClick={() => onOpen(photo)}
                className="block w-full overflow-hidden rounded-xl bg-white/10 text-left"
              >
                <img
                  src={photo.url}
                  alt={photo.caption || "파티 사진"}
                  loading="lazy"
                  className="aspect-square w-full object-cover"
                />
                <span className="block px-2 py-2 text-[11px] leading-snug text-white/70">
                  <b className="text-white/90">
                    {participants.find((p) => p.id === photo.owner_id)?.nickname ?? "익명"}
                  </b>
                  {photo.caption ? ` · ${photo.caption}` : ""}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function MyCard({ me }: { me: Participant }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl bg-gradient-to-br from-pop/25 to-accent/15 p-4">
      {me.avatar_url ? (
        <img
          src={me.avatar_url}
          alt={`${me.nickname}의 캐릭터`}
          className="size-16 shrink-0 rounded-full bg-white/10 object-cover"
        />
      ) : (
        <div className="size-16 shrink-0 rounded-full bg-white/10" aria-hidden />
      )}
      <div className="min-w-0">
        <p className="truncate text-base font-bold">{me.nickname}</p>
        {me.title ? (
          <>
            <p className="mt-0.5 text-sm font-semibold text-accent">🏆 {me.title}</p>
            {me.title_basis && (
              <p className="mt-0.5 text-xs text-white/60">{me.title_basis}</p>
            )}
          </>
        ) : (
          <p className="mt-0.5 text-xs text-white/60">칭호는 시상식에서 공개돼요.</p>
        )}
      </div>
    </div>
  );
}
