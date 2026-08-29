export type RoomStatus = 'lobby' | 'live' | 'award' | 'ended';
export type TonePreset = 'icebreaking' | 'casual' | 'drinking' | 'workshop';

export interface Room {
  id: string;
  code: string; // 6자리 영숫자
  hostToken: string; // UUID/랜덤키
  tonePreset: TonePreset;
  rewardToggle: boolean;
  status: RoomStatus;
  createdAt: string;
  updatedAt: string;
}
