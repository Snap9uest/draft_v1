import { TicketFrame } from '../types/ticket';

export const PRESET_FRAMES: TicketFrame[] = [
  {
    id: 'frame-classic-receipt',
    name: '클래식 영수증',
    theme: 'classic',
    backgroundColor: '#F9F9F9',
    borderColor: '#333333',
    isLocked: false,
  },
  {
    id: 'frame-neon-party',
    name: '네온 파티',
    theme: 'neon',
    backgroundColor: '#0A0A0A',
    borderColor: '#FF00FF',
    isLocked: false,
  },
  {
    id: 'frame-retro-film',
    name: '레트로 롤필름',
    theme: 'retro',
    backgroundColor: '#1E1E1E',
    borderColor: '#D4AF37',
    isLocked: false,
  },
  {
    id: 'frame-gold-trophy',
    name: '골드 트로피',
    theme: 'gold',
    backgroundColor: '#FFF8E7',
    borderColor: '#FFD700',
    isLocked: true,
    unlockCondition: 'MVP 칭호 획득 시 해금',
  },
  {
    id: 'frame-cyberpunk',
    name: '사이버펑크',
    theme: 'cyber',
    backgroundColor: '#0F0F1A',
    borderColor: '#00FFFF',
    isLocked: true,
    unlockCondition: '베스트샷 투표 1위 시 해금',
  }
];
