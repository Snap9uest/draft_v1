export interface PhotoItem {
  id: string;
  photoUrl: string;
  caption: string;
  participantName: string;
  participantAvatar?: string;
  missionTitle: string;
  timestamp: number;
  isHidden: boolean;
}

export type ReactionType = 'tension_up' | 'admiration' | 'chemistry' | 'humor' | 'general';

export interface ReactionMessage {
  id: string;
  text: string;
  type: ReactionType;
  createdAt: number;
}
