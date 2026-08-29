'use client';

import { useEffect, useState } from 'react';
import { useSearchParams, useParams } from 'next/navigation';
import { Room } from '../../../types/room';
import { TvLobbyView } from '../../../components/room/TvLobbyView';
import { HostControlPanel } from '../../../components/host/HostControlPanel';

export default function RoomPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const roomId = params.id as string;
  const role = searchParams.get('role');
  
  const [room, setRoom] = useState<Room | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const storedRooms = localStorage.getItem('snapquest_rooms');
    let foundRoom: Room | null = null;
    
    if (storedRooms) {
      try {
        const rooms = JSON.parse(storedRooms) as Room[];
        foundRoom = rooms.find(r => r.id === roomId) || null;
      } catch (e) {
        // ignore
      }
    }
    
    // Test dummy fallback if no room found
    if (!foundRoom) {
      foundRoom = {
        id: roomId,
        code: 'A1B2C3',
        hostToken: 'dummy-token',
        tonePreset: 'casual',
        rewardToggle: false,
        status: 'lobby',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
    }
    
    setRoom(foundRoom);
    setLoading(false);
  }, [roomId]);

  if (loading) {
    return <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center">Loading...</div>;
  }

  if (!room) {
    return <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center">방을 찾을 수 없습니다.</div>;
  }

  if (role === 'tv') {
    return <TvLobbyView room={room} />;
  }

  if (role === 'host') {
    return <HostControlPanel initialRoom={room} />;
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center">
      <h1>게스트 화면 (구현 예정)</h1>
    </div>
  );
}
