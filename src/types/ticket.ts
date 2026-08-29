export interface TicketFrame {
  id: string;
  name: string;
  theme: string;
  backgroundColor: string;
  borderColor: string;
  isLocked: boolean;
  unlockCondition?: string;
}

export interface TicketComposition {
  roomId: string;
  participantId: string;
  participantName: string;
  titleText: string;
  avatarUrl?: string;
  photoUrls: [string, string, string, string]; // exactly 4 photos
  frameId: string;
  composedImageUrl: string;
  createdAt: number;
}
