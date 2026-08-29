/* ─────────────────────────────────────────────
 * SnapQuest AI Fallbacks — 오프라인/에러 완벽 방어 데이터
 *
 * 모든 AI 호출 실패 시 이 데이터로 무중단 플로우를 보장한다.
 * ───────────────────────────────────────────── */

// ── F1: 프리셋 아바타 & 기본 소개 문구 ──

/** 프리셋 아바타 이미지 URL (로컬 public 에셋) */
export const PRESET_AVATARS = [
  "/avatars/preset-1.svg",
  "/avatars/preset-2.svg",
  "/avatars/preset-3.svg",
  "/avatars/preset-4.svg",
  "/avatars/preset-5.svg",
  "/avatars/preset-6.svg",
];

export function getRandomPresetAvatar(): string {
  return PRESET_AVATARS[Math.floor(Math.random() * PRESET_AVATARS.length)];
}

export function getDefaultIntroMessage(nickname: string): string {
  const templates = [
    `${nickname}님이 파티에 합류했어요! 🎉`,
    `어서오세요, ${nickname}님! 오늘 파티의 주인공이 될 수도?! ✨`,
    `${nickname}님 등장! 파티가 더 뜨거워질 예감 🔥`,
    `반가워요, ${nickname}님! 빙고판 준비 완료 🎯`,
    `${nickname}님, 환영합니다! 카메라 준비되셨나요? 📸`,
  ];
  return templates[Math.floor(Math.random() * templates.length)];
}

// ── F2: 프리셋 미션 풀 ──

const PRESET_MISSIONS_POOL: Record<string, string[]> = {
  친목: [
    "처음 만난 사람과 하이파이브 샷 ✋",
    "같은 색 옷을 입은 사람과 패션 쌍둥이 샷 👯",
    "가장 밝은 미소를 가진 사람과 스마일 샷 😁",
    "음식을 들고 건배 포즈 🥂",
    "단체로 점프하는 에너지 샷 🦘",
    "오늘 처음 본 사람과 셀카 📸",
    "가위바위보 승부 장면 ✌️",
    "어깨동무 우정 샷 🤝",
    "함께 하트 포즈 ❤️",
    "뒤돌아서 돌아보는 뒤태 샷 🔄",
    "손가락으로 V 포즈 듀오 ✌️",
    "엄지척 최고 포즈 👍",
    "찡긋 표정 배틀 😜",
    "볼 하트 듀오 샷 💕",
    "눈 감고 선 포즈 🧘",
  ],
  동아리: [
    "선배와 후배의 케미 샷 🎓",
    "동아리 로고나 굿즈와 함께 📛",
    "함께 공부하는 척 포즈 📚",
    "가장 오래된 동아리원과 인증 🏆",
    "신입 환영 하이파이브 ✋",
    "동아리방 인증 샷 🏠",
    "다같이 파이팅 포즈 💪",
    "가장 조용한 사람과 함께 📷",
    "동기끼리 우정 샷 🤗",
    "선후배 어깨동무 🤝",
    "모두 같은 포즈 통일 샷 🪞",
    "동아리 활동 재현 샷 🎭",
  ],
  워크샵: [
    "팀원과 목표 선언 포즈 🎯",
    "화이트보드 앞에서 브레인스토밍 샷 💡",
    "팀 단체 파이팅 📢",
    "발표 중인 모습 캡처 🎤",
    "메모하는 진지 모드 샷 📝",
    "커피 타임 건배 ☕",
    "팀원과 악수 샷 🤝",
    "점심 함께 먹는 장면 🍽️",
    "마무리 박수 치는 장면 👏",
    "팀 로고 만들기 샷 🎨",
  ],
  파티: [
    "DJ 포즈 흉내 🎧",
    "댄스 배틀 장면 💃",
    "풍선이나 장식과 함께 🎈",
    "음료 건배 포즈 🍻",
    "파티 왕관을 쓴 사람과 📸",
    "가장 신난 표정 대결 🤪",
    "함께 노래 부르는 포즈 🎤",
    "컨페티/소품과 함께 샷 🎊",
    "가장 멋진 포즈 대결 💫",
    "셀카봉 없이 단체 셀카 도전 🤳",
    "뒷모습 인생 샷 🌅",
    "2인 쌍둥이 포즈 👯‍♂️",
  ],
};

/**
 * 프리셋 미션 풀에서 9개를 뽑되, 특정 닉네임을 치환해 개인화를 흉내낸다.
 */
export function getFallbackMissions(
  tone: string,
  otherNicknames: string[]
): string[] {
  const pool = PRESET_MISSIONS_POOL[tone] ?? PRESET_MISSIONS_POOL["친목"];
  const shuffled = [...pool].sort(() => Math.random() - 0.5);
  const selected = shuffled.slice(0, 9);

  // 일부 미션에 다른 참가자 닉네임을 삽입
  return selected.map((m, i) => {
    if (otherNicknames.length > 0 && i < 3) {
      const nick = otherNicknames[i % otherNicknames.length];
      return m.replace("사람", `${nick}님`);
    }
    return m;
  });
}

// ── F3: 비전 판정 폴백 ──

export function getFallbackCaption(): string {
  const captions = [
    "📸 멋진 순간 포착!",
    "이 순간을 기억하세요 ✨",
    "파티의 한 장면 🎉",
    "최고의 미션 인증 👍",
    "함께라서 더 빛나는 순간 💫",
  ];
  return captions[Math.floor(Math.random() * captions.length)];
}

// ── F4: 프리셋 사회자 리액션 ──

export function getFallbackReaction(nickname: string): string {
  const reactions = [
    `${nickname}님의 미션 인증! 대단해요! 🔥`,
    `와! ${nickname}님 역시 센스쟁이! 👏`,
    `${nickname}님이 빙고판을 채워가고 있어요! 🎯`,
    `${nickname}님, 이 사진 진짜 좋은데요?! 📸`,
    `오늘의 MVP 후보, ${nickname}님! 🏆`,
    `${nickname}님의 포토 센스, 인정! ✨`,
    `${nickname}님, 완벽한 미션 클리어! 💯`,
  ];
  return reactions[Math.floor(Math.random() * reactions.length)];
}

// ── F6: 규칙 기반 칭호 ──

interface ParticipantData {
  id: string;
  nickname: string;
  completedMissions: string[];
  captions: string[];
}

export function getFallbackTitles(
  participants: ParticipantData[]
): { participantId: string; nickname: string; title: string; basis: string }[] {
  // 완료 미션 수 기준 정렬
  const sorted = [...participants].sort(
    (a, b) => b.completedMissions.length - a.completedMissions.length
  );

  const titlePool = [
    { title: "🏆 미션 마스터", basis: "가장 많은 미션을 완료" },
    { title: "⚡ 스피드스타", basis: "빠르게 미션을 클리어" },
    { title: "📸 포토 센스왕", basis: "멋진 사진을 많이 남김" },
    { title: "🤝 K-케미장인", basis: "함께 찍기 미션을 많이 수행" },
    { title: "🔥 파티의 불꽃", basis: "파티를 뜨겁게 달군 에너지" },
    { title: "🎯 빙고 헌터", basis: "빙고 라인 완성에 기여" },
    { title: "✨ 분위기 메이커", basis: "파티 분위기를 이끈 존재" },
    { title: "🦘 액션 히어로", basis: "역동적인 사진을 남김" },
    { title: "💫 포즈 자판기", basis: "다양한 포즈를 선보임" },
    { title: "🎉 파티 동물", basis: "파티를 끝까지 즐긴 참가자" },
  ];

  return sorted.map((p, i) => {
    const t = titlePool[i % titlePool.length];
    return {
      participantId: p.id,
      nickname: p.nickname,
      title: t.title,
      basis: t.basis,
    };
  });
}
