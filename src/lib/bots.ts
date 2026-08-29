/* 봇 참가자 프로필과 시드 콘텐츠. 네트워크 의존 0 — 이미지는 전부 SVG data URI.
 * 데모 방 API(src/app/api/room/[code]/bots)의 FALLBACK_BOTS 와 같은 형태를 유지한다. */

import type { Photo } from "./db/types";

export interface BotProfile {
  nickname: string;
  intro: string;
  emoji: string;
}

export const BOTS: BotProfile[] = [
  { nickname: "카메라요정", intro: "사진 찍는 게 취미. 오늘 100장 목표.", emoji: "📸" },
  { nickname: "리액션장인", intro: "웃음 담당. 아무 말에나 크게 웃어준다.", emoji: "😂" },
  { nickname: "먹보곰", intro: "음식 앞에서 제일 신남. 디저트는 배가 따로 있다.", emoji: "🐻" },
  { nickname: "댄스머신", intro: "노래만 나오면 몸이 먼저 움직인다.", emoji: "🕺" },
  { nickname: "조용한관찰자", intro: "말은 적지만 다 보고 있다.", emoji: "🦉" },
  { nickname: "인싸토끼", intro: "처음 본 사람과 3분이면 친구가 된다.", emoji: "🐰" },
];

function hash(seed: string): number {
  let h = 0;
  for (const ch of seed) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return h;
}

const dataUri = (svg: string) => `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;

/** src/lib/db/server.ts 의 presetAvatar 와 같은 알고리즘 — 봇 아바타가 DB 값과 어긋나면 안 된다.
 *  server.ts 는 service-role 경로라 클라이언트에서 import 할 수 없어 여기 복제한다. */
export function emojiAvatar(seed: string, emoji: string): string {
  const h = hash(seed);
  return dataUri(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100">` +
      `<rect width="100" height="100" rx="22" fill="hsl(${h % 360} 72% 86%)"/>` +
      `<text x="50" y="54" font-size="52" text-anchor="middle" dominant-baseline="central">${emoji}</text>` +
      `</svg>`,
  );
}

/** 시드 사진용 플레이스홀더. 실제 사진 대신 그라디언트 + 이모지. */
export function placeholderPhoto(seed: string, emoji: string): string {
  const h = hash(seed);
  const a = h % 360;
  const b = (a + 48) % 360;
  return dataUri(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300" width="400" height="300">` +
      `<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">` +
      `<stop offset="0" stop-color="hsl(${a} 78% 62%)"/>` +
      `<stop offset="1" stop-color="hsl(${b} 82% 44%)"/>` +
      `</linearGradient></defs>` +
      `<rect width="400" height="300" fill="url(#g)"/>` +
      `<circle cx="${60 + (h % 120)}" cy="${40 + (h % 60)}" r="90" fill="#fff" opacity="0.14"/>` +
      `<text x="200" y="160" font-size="112" text-anchor="middle" dominant-baseline="central">${emoji}</text>` +
      `</svg>`,
  );
}

/** 시드 캡션 — AI 캡션이 아직 없을 때 포토월·앨범이 비지 않게 한다. */
export const SEED_CAPTIONS: string[] = [
  "처음 만난 사이 맞나요? 하이파이브 완벽 합",
  "건배 타이밍까지 딱 맞은 한 잔",
  "이 표정 하나로 파티 분위기 정리 완료",
  "노래 나오자마자 몸이 먼저 움직인 순간",
  "조용히 있다가 제일 잘 나온 사람",
  "3분 만에 친구 된 두 사람의 증거 사진",
  "점프 타이밍 맞추느라 다섯 번 찍었다",
  "디저트 앞에서만 나오는 표정",
];

const SEED_SHOTS: { bot: string; cellIndex: number | null; caption: string }[] = [
  { bot: "카메라요정", cellIndex: 0, caption: SEED_CAPTIONS[0] },
  { bot: "먹보곰", cellIndex: 3, caption: SEED_CAPTIONS[1] },
  { bot: "리액션장인", cellIndex: 1, caption: SEED_CAPTIONS[2] },
  { bot: "댄스머신", cellIndex: 4, caption: SEED_CAPTIONS[3] },
  { bot: "조용한관찰자", cellIndex: null, caption: SEED_CAPTIONS[4] },
  { bot: "인싸토끼", cellIndex: 2, caption: SEED_CAPTIONS[5] },
  { bot: "카메라요정", cellIndex: 5, caption: SEED_CAPTIONS[6] },
  { bot: "먹보곰", cellIndex: null, caption: SEED_CAPTIONS[7] },
];

/** 화면이 photos 를 그리는 코드를 그대로 쓸 수 있게 owner 정보를 붙여준다. */
export type SeedPhoto = Photo & { ownerNickname: string; ownerAvatar: string };

/**
 * 사진이 한 장도 없을 때 포토월·앨범을 채우는 가짜 사진.
 * DB 에 넣지 않는 표시 전용 데이터라 id 는 `seed:` 로 시작한다 — 투표·숨김 대상에서 빼려면 이걸로 거른다.
 */
export function seedPhotos(roomId = "demo"): SeedPhoto[] {
  const base = Date.parse("2026-08-29T20:00:00Z");
  return SEED_SHOTS.map((shot, i) => {
    const bot = BOTS.find((b) => b.nickname === shot.bot) ?? BOTS[0];
    return {
      id: `seed:${i}`,
      room_id: roomId,
      owner_id: `seed:${bot.nickname}`,
      cell_index: shot.cellIndex,
      url: placeholderPhoto(`${bot.nickname}${i}`, bot.emoji),
      caption: shot.caption,
      mc_reaction: null,
      verify_status: "ai_pass",
      hidden: false,
      created_at: new Date(base + i * 90_000).toISOString(),
      ownerNickname: bot.nickname,
      ownerAvatar: emojiAvatar(bot.nickname, bot.emoji),
    };
  });
}

export const isSeedId = (id: string) => id.startsWith("seed:");
