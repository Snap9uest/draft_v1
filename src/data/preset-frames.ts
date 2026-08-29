import { TicketFrame } from '../types/ticket';

export const PRESET_FRAMES: TicketFrame[] = [
  {
    id: 'receipt-classic',
    name: '🧾 클래식 영수증 (Receipt)',
    theme: 'receipt',
    bgColor: '#FAF8F5',
    textColor: '#1E1E1E',
    accentColor: '#4F46E5',
    isLocked: false,
  },
  {
    id: 'neon-night',
    name: '✨ 네온 파티 (Neon Party)',
    theme: 'neon',
    bgColor: '#0F172A',
    textColor: '#F8FAFC',
    accentColor: '#EC4899',
    isLocked: false,
  },
  {
    id: 'retro-film',
    name: '🎞️ 레트로 롤필름 (Vintage Film)',
    theme: 'retro',
    bgColor: '#18181B',
    textColor: '#FEF08A',
    accentColor: '#EAB308',
    isLocked: false,
  },
  {
    id: 'gold-trophy',
    name: '🏆 골드 챔피언 (Gold VIP)',
    theme: 'gold',
    bgColor: '#1C1917',
    textColor: '#FDE047',
    accentColor: '#F59E0B',
    isLocked: false,
  },
];
