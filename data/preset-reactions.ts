import { ReactionMessage } from '../types/photowall';

export const presetReactions: Omit<ReactionMessage, 'id' | 'createdAt'>[] = [
  // 텐션업
  { text: "소리 질러~! 오늘 파티 분위기 찢었다! 🔥", type: "tension" },
  { text: "다들 텐션 미쳤네요! 더 높이 가봅시다! 🚀", type: "tension" },
  { text: "와우, 이 열기 뭐죠? 화면을 뚫고 나오네요! 😆", type: "tension" },
  
  // 감탄
  { text: "헐, 방금 올라온 사진 완전 화보 아니에요? 📸", type: "wow" },
  { text: "이 구도, 이 색감... 당장 인스타 업로드 각! ✨", type: "wow" },
  { text: "우와~ 포즈 진짜 자연스럽다! 모델인 줄 알았어요. 👏", type: "wow" },
  
  // 케미칭찬
  { text: "두 분 케미 무엇? 완전 베프 재질! 👯‍♀️", type: "chemistry" },
  { text: "다 같이 모인 모습 보기 너무 좋아요~ 훈훈합니다! 🥰", type: "chemistry" },
  { text: "이 조합 찬성! 찰떡궁합 인증샷이네요. 🤝", type: "chemistry" },
  
  // 유머/재미
  { text: "ㅋㅋ 방금 사진 표정 압권! 짤로 만들어야 할 듯! 🤣", type: "funny" },
  { text: "이런 사진은 대체 어떻게 찍는 거에요? 센스 만점! 💯", type: "funny" },
  { text: "진짜 제대로 망가졌네요! 즐기는 모습 최고! 👍", type: "funny" },
  
  // 기본/기타
  { text: "계속해서 멋진 사진들 올려주세요! 찰칵찰칵! 📷", type: "default" },
  { text: "오늘의 베스트 포토는 과연 누구일까요? 👀", type: "default" },
  { text: "남는 건 사진뿐! 지금 이 순간을 맘껏 즐기세요! 🎉", type: "default" }
];

// 헬퍼 함수
export const getRandomReaction = (): ReactionMessage => {
  const randomPreset = presetReactions[Math.floor(Math.random() * presetReactions.length)];
  return {
    ...randomPreset,
    id: crypto.randomUUID(),
    createdAt: Date.now(),
  };
};
