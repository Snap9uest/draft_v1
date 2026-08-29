export interface TicketFrame {
  id: string;
  name: string;
  theme: 'receipt' | 'neon' | 'retro' | 'gold';
  bgColor: string;
  textColor: string;
  accentColor: string;
  isLocked?: boolean;
}

export interface TicketCompositionData {
  roomId: string;
  roomCode: string;
  participantName: string;
  titleText: string;
  avatarEmoji?: string;
  photoUrls: string[];
  frameId: string;
  dateStr: string;
}
