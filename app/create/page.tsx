'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { TonePreset } from '../../types/room';
import { roomStorage } from '../../lib/room-storage';
import { PartyPopper, Coffee, Beer, Briefcase } from 'lucide-react';

const TONE_PRESETS: { value: TonePreset; label: string; icon: React.ReactNode; desc: string }[] = [
  { value: 'icebreaking', label: '아이스브레이킹', icon: <PartyPopper className="w-6 h-6" />, desc: '처음 만나는 자리' },
  { value: 'casual', label: '캐주얼', icon: <Coffee className="w-6 h-6" />, desc: '편안한 모임' },
  { value: 'drinking', label: '술자리', icon: <Beer className="w-6 h-6" />, desc: '회식이나 파티' },
  { value: 'workshop', label: '워크샵', icon: <Briefcase className="w-6 h-6" />, desc: '팀빌딩 활동' },
];

function generateRoomCode() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

export default function CreateRoomPage() {
  const router = useRouter();
  const [selectedTone, setSelectedTone] = useState<TonePreset>('icebreaking');
  const [isCreating, setIsCreating] = useState(false);

  const handleCreateRoom = () => {
    setIsCreating(true);
    
    const roomId = crypto.randomUUID();
    const roomCode = generateRoomCode();
    const hostToken = crypto.randomUUID();
    
    // Save token to local storage
    roomStorage.saveHostToken(roomId, hostToken);
    
    // Mock saving the room for frontend flow testing
    const newRoom = {
      id: roomId,
      code: roomCode,
      hostToken,
      tonePreset: selectedTone,
      rewardToggle: false,
      status: 'lobby',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    if (typeof window !== 'undefined') {
      const storedRooms = localStorage.getItem('snapquest_rooms') || '[]';
      const rooms = JSON.parse(storedRooms);
      rooms.push(newRoom);
      localStorage.setItem('snapquest_rooms', JSON.stringify(rooms));
    }
    
    router.push(`/room/${roomId}?role=host&token=${hostToken}`);
  };

  return (
    <main className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-6 md:p-8 space-y-8">
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">새 파티 시작하기</h1>
          <p className="text-gray-500">모임의 성격에 맞는 톤을 선택해주세요.</p>
        </div>

        <div className="grid grid-cols-2 gap-4">
          {TONE_PRESETS.map((preset) => (
            <button
              key={preset.value}
              onClick={() => setSelectedTone(preset.value)}
              className={`flex flex-col items-center justify-center p-4 rounded-xl border-2 transition-all ${
                selectedTone === preset.value
                  ? 'border-blue-500 bg-blue-50 text-blue-700'
                  : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50 text-gray-600'
              }`}
            >
              <div className="mb-3">{preset.icon}</div>
              <div className="font-semibold">{preset.label}</div>
              <div className="text-xs mt-1 opacity-80">{preset.desc}</div>
            </button>
          ))}
        </div>

        <button
          onClick={handleCreateRoom}
          disabled={isCreating}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-4 px-6 rounded-xl shadow-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
        >
          {isCreating ? '방 생성 중...' : '방 만들기'}
        </button>
      </div>
    </main>
  );
}
