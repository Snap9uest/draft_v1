"use client";
/* eslint-disable @next/next/no-img-element */

import { useState } from "react";
import type { Participant, Photo } from "@/lib/db/types";
import { Card } from "@/components/ui";

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
    <div className="space-y-4 px-4 pt-3 pb-4">
      <div className="flex items-center gap-2">
        <div className="flex flex-1 rounded-full bg-surface-variant p-1">
          {(["all", "mine"] as const).map((s) => (
            <button
              key={s}
              aria-pressed={scope === s}
              data-testid={`album-${s}`}
              onClick={() => setScope(s)}
              className={`min-h-11 flex-1 rounded-full px-3 text-sm font-semibold transition ${
                scope === s ? "bg-primary text-on-primary shadow-clay" : "text-ink-muted"
              }`}
            >
              {s === "all" ? `모두의 사진 ${photos.length}` : `내 사진 ${mine.length}`}
            </button>
          ))}
        </div>
        <button
          onClick={share}
          className="min-h-11 min-w-11 rounded-full border border-hairline bg-card-plain px-4 text-sm font-semibold text-ink transition active:scale-[0.98]"
        >
          {copied ? "복사했어요" : "공유하기"}
        </button>
      </div>

      <p className="rounded-2xl bg-surface-soft px-3 py-2.5 text-xs leading-relaxed text-ink-muted">
        사진을 <b className="text-ink">길게 누르면</b> 폰에 저장돼요. 앨범은{" "}
        {daysLeft > 0 ? `${daysLeft}일 뒤에` : "오늘"} 문을 닫으니, 마음에 드는 건 미리 챙겨 두세요.
      </p>

      {scope === "mine" && me && <MyCard me={me} />}

      {shown.length === 0 ? (
        <p className="rounded-3xl border border-dashed border-hairline bg-surface-soft px-4 py-10 text-center text-sm leading-relaxed text-ink-muted">
          {scope === "mine"
            ? "아직 올린 사진이 없어요. 내 빙고판에서 첫 미션을 찍어볼까요?"
            : "아직 올라온 사진이 없어요. 첫 사진의 주인공이 되어 보세요."}
        </p>
      ) : (
        /* 롤필름 트레이 — 크림 톤 프레임 안에 사진이 한 장씩 물려 있는 모양. */
        <div className="rounded-3xl bg-surface-variant p-3 shadow-clay">
          <ul className="grid grid-cols-2 gap-2.5">
            {shown.map((photo) => (
              <li key={photo.id} data-testid="album-item">
                <button
                  onClick={() => onOpen(photo)}
                  className="block w-full overflow-hidden rounded-2xl bg-card-plain p-1.5 text-left shadow-clay transition active:scale-[0.98]"
                >
                  <img
                    src={photo.url}
                    alt={photo.caption || "파티에서 찍은 사진"}
                    loading="lazy"
                    className="aspect-square w-full rounded-xl bg-surface-soft object-cover"
                  />
                  <span className="block px-1 pt-1.5 pb-0.5 text-[11px] leading-snug text-ink-muted">
                    <b className="text-ink">
                      {participants.find((p) => p.id === photo.owner_id)?.nickname ?? "누군가"}
                    </b>
                    {photo.caption ? ` · ${photo.caption}` : ""}
                  </span>
                </button>
              </li>
            ))}
          </ul>
          {/* 필름 하단 각인. 픽셀 폰트는 영문 전용이라 여기까지만. */}
          <span
            aria-hidden
            className="mt-3 block text-center font-pixel text-[9px] tracking-[0.35em] text-ink-muted"
          >
            SNAPQUEST
          </span>
        </div>
      )}
    </div>
  );
}

function MyCard({ me }: { me: Participant }) {
  return (
    <Card accentColor="var(--color-brand-lavender)" className="flex items-center gap-4">
      {me.avatar_url ? (
        <img
          src={me.avatar_url}
          alt={`${me.nickname}의 캐릭터`}
          className="size-16 shrink-0 rounded-full bg-surface-variant object-cover ring-2 ring-card-plain"
        />
      ) : (
        <div
          className="size-16 shrink-0 rounded-full bg-surface-variant ring-2 ring-card-plain"
          aria-hidden
        />
      )}
      <div className="min-w-0">
        <p className="truncate text-base font-bold text-ink">{me.nickname}</p>
        {me.title ? (
          <>
            <p className="mt-0.5 text-sm font-semibold text-brand-pink">🏆 {me.title}</p>
            {me.title_basis && (
              <p className="mt-0.5 text-xs leading-relaxed text-ink-muted">{me.title_basis}</p>
            )}
          </>
        ) : (
          <p className="mt-0.5 text-xs text-ink-muted">칭호는 시상식에서 공개돼요.</p>
        )}
      </div>
    </Card>
  );
}
