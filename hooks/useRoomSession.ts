import { useState, useEffect, useCallback } from 'react';
import { Room, RoomStatus, TonePreset } from '../types/room';

export function useRoomSession(initialRoom: Room) {
  const [room, setRoom] = useState<Room>(initialRoom);

  // 로컬 스토리지에서 최신 상태 불러오기 (호스트 재접속 시 복원)
  useEffect(() => {
    const storedRooms = localStorage.getItem('snapquest_rooms');
    if (storedRooms) {
      try {
        const rooms: Room[] = JSON.parse(storedRooms);
        const found = rooms.find(r => r.id === initialRoom.id);
        if (found) {
          setRoom(found);
        }
      } catch (e) {
        // ignore
      }
    }
  }, [initialRoom.id]);

  // BroadcastChannel을 통한 실시간 동기화
  useEffect(() => {
    const channel = new BroadcastChannel(`room_${initialRoom.id}`);

    channel.onmessage = (event) => {
      if (event.data?.type === 'ROOM_UPDATE') {
        setRoom(event.data.payload);
      }
    };

    return () => {
      channel.close();
    };
  }, [initialRoom.id]);

  const updateRoomState = useCallback((newRoom: Room) => {
    setRoom(newRoom);
    
    // Save to localStorage
    const storedRooms = localStorage.getItem('snapquest_rooms');
    if (storedRooms) {
      try {
        const rooms: Room[] = JSON.parse(storedRooms);
        const updatedRooms = rooms.map(r => r.id === newRoom.id ? newRoom : r);
        localStorage.setItem('snapquest_rooms', JSON.stringify(updatedRooms));
      } catch (e) {}
    } else {
      localStorage.setItem('snapquest_rooms', JSON.stringify([newRoom]));
    }

    // Broadcast
    const channel = new BroadcastChannel(`room_${newRoom.id}`);
    channel.postMessage({ type: 'ROOM_UPDATE', payload: newRoom });
    channel.close();
  }, []);

  const changeStatus = useCallback((nextStatus: RoomStatus) => {
    updateRoomState({ ...room, status: nextStatus, updatedAt: new Date().toISOString() });
  }, [room, updateRoomState]);

  const updateTonePreset = useCallback((tone: TonePreset) => {
    updateRoomState({ ...room, tonePreset: tone, updatedAt: new Date().toISOString() });
  }, [room, updateRoomState]);

  const toggleReward = useCallback(() => {
    updateRoomState({ ...room, rewardToggle: !room.rewardToggle, updatedAt: new Date().toISOString() });
  }, [room, updateRoomState]);

  return {
    room,
    changeStatus,
    updateTonePreset,
    toggleReward
  };
}
