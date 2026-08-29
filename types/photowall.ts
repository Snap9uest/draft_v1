export interface PhotoItem {
  id: string;
  roomId: string;
  photoUrl: string;
  caption: string;
  participantName: string;
  participantAvatar?: string;
  missionTitle?: string;
  timestamp: number;
  isHidden: boolean;
}

export interface ReactionMessage {
  id: string;
  text: string;
  type: 'tension' | 'wow' | 'chemistry' | 'funny' | 'default';
  createdAt: number;
}
