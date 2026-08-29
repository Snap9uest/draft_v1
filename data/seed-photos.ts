import { PhotoItem } from '../types/photowall';

export const seedPhotos: PhotoItem[] = [
  {
    id: "seed-1",
    roomId: "seed-room",
    photoUrl: "https://images.unsplash.com/photo-1511895426328-dc8714191300?q=80&w=600&auto=format&fit=crop",
    caption: "파티 준비 끝! 다들 빨리 와요~ 🎈",
    participantName: "파티요정",
    missionTitle: "첫 인증샷",
    timestamp: Date.now() - 1000 * 60 * 30, // 30분 전
    isHidden: false,
  },
  {
    id: "seed-2",
    roomId: "seed-room",
    photoUrl: "https://images.unsplash.com/photo-1492684223066-81342ee5ff30?q=80&w=600&auto=format&fit=crop",
    caption: "오늘 드레스코드 완벽! 블랙&화이트 🖤🤍",
    participantName: "멋쟁이",
    participantAvatar: "https://i.pravatar.cc/150?u=멋쟁이",
    missionTitle: "드레스코드 뽐내기",
    timestamp: Date.now() - 1000 * 60 * 25,
    isHidden: false,
  },
  {
    id: "seed-3",
    roomId: "seed-room",
    photoUrl: "https://images.unsplash.com/photo-1520854221256-17451cc331bf?q=80&w=600&auto=format&fit=crop",
    caption: "우정 포에버! 짠~ 🥂",
    participantName: "베프모임",
    timestamp: Date.now() - 1000 * 60 * 20,
    isHidden: false,
  },
  {
    id: "seed-4",
    roomId: "seed-room",
    photoUrl: "https://images.unsplash.com/photo-1541532713592-79a0317b6b77?q=80&w=600&auto=format&fit=crop",
    caption: "흥이 난다 흥이 나~ 무대 장악 완료 🕺",
    participantName: "댄싱머신",
    missionTitle: "최고의 댄서",
    timestamp: Date.now() - 1000 * 60 * 15,
    isHidden: false,
  },
  {
    id: "seed-5",
    roomId: "seed-room",
    photoUrl: "https://images.unsplash.com/photo-1533174000273-e1f4096d5bb9?q=80&w=600&auto=format&fit=crop",
    caption: "음식 진짜 맛있어요! 순삭 🍽️",
    participantName: "푸드파이터",
    participantAvatar: "https://i.pravatar.cc/150?u=푸드파이터",
    timestamp: Date.now() - 1000 * 60 * 10,
    isHidden: false,
  },
  {
    id: "seed-6",
    roomId: "seed-room",
    photoUrl: "https://images.unsplash.com/photo-1527529482837-4698179dc6ce?q=80&w=600&auto=format&fit=crop",
    caption: "다 같이 V 브이~ 남는 건 사진뿐! ✌️",
    participantName: "스마일",
    missionTitle: "단체 사진",
    timestamp: Date.now() - 1000 * 60 * 5,
    isHidden: false,
  }
];
