'use client';

import { useState } from 'react';
import { Room, RoomStatus, TonePreset } from '../../types/room';
import { Users, Play, Trophy, Power, Settings } from 'lucide-react';
import { useSearchParams } from 'next/navigation';

import { useRoomSession } from '../../hooks/useRoomSession';

interface HostControlPanelProps {
  initialRoom: Room;
}

export function HostControlPanel({ initialRoom }: HostControlPanelProps) {
  const searchParams = useSearchParams();
  const token = searchParams.get('token');
  
  const { room, changeStatus, updateTonePreset, toggleReward } = useRoomSession(initialRoom);

  // token verification
  if (room.hostToken !== token) {
    return (
      <div className="flex flex-col items-center justify-center p-8 bg-gray-900 text-white min-h-[50vh]">
        <h2 className="text-xl font-bold text-red-500 mb-2">권한 없음</h2>
        <p className="text-gray-400">호스트 권한이 유효하지 않습니다.</p>
      </div>
    );
  }

  const handleStatusChange = (newStatus: RoomStatus) => {
    if (newStatus === 'ended') {
      if (!confirm('정말로 파티를 종료하시겠습니까?')) return;
    }
    changeStatus(newStatus);
  };

  const handlePresetChange = (preset: TonePreset) => {
    updateTonePreset(preset);
  };

  // derived state
  const statusBadgeColor = {
    lobby: 'bg-blue-500/20 text-blue-400',
    live: 'bg-green-500/20 text-green-400',
    award: 'bg-purple-500/20 text-purple-400',
    ended: 'bg-red-500/20 text-red-400',
  }[room.status];

  const statusText = {
    lobby: '대기 중 (Lobby)',
    live: '진행 중 (Live)',
    award: '시상식 (Award)',
    ended: '종료됨 (Ended)',
  }[room.status];

  return (
    <div className="flex flex-col min-h-screen bg-gray-900 text-gray-100 max-w-md mx-auto relative shadow-xl overflow-hidden">
      {/* Header */}
      <header className="p-4 border-b border-gray-800 bg-gray-900/80 backdrop-blur sticky top-0 z-10 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold">호스트 컨트롤</h1>
          <div className="text-sm text-gray-400">방 코드: <span className="text-white font-mono">{room.code}</span></div>
        </div>
        <div className="flex flex-col items-end gap-1">
          <span className={`text-xs px-2 py-1 rounded-full font-medium ${statusBadgeColor}`}>
            {statusText}
          </span>
          <div className="flex items-center text-xs text-gray-400">
            <Users className="w-3 h-3 mr-1" />
            <span>참가자 0명</span>
          </div>
        </div>
      </header>

      {/* Body */}
      <div className="p-4 flex-1 space-y-6">
        
        {/* 생애주기 컨트롤 */}
        <section className="bg-gray-800 rounded-xl p-4 space-y-3 shadow-lg">
          <h2 className="text-sm font-semibold text-gray-400 mb-2 flex items-center"><Settings className="w-4 h-4 mr-1"/> 파티 진행 컨트롤</h2>
          
          <button 
            onClick={() => handleStatusChange('live')}
            disabled={room.status !== 'lobby'}
            className="w-full py-3 rounded-lg flex items-center justify-center gap-2 font-bold transition-all disabled:opacity-50 disabled:bg-gray-700 disabled:text-gray-500 bg-blue-600 hover:bg-blue-500 text-white"
          >
            <Play className="w-5 h-5" />
            [파티 시작]
          </button>

          <button 
            onClick={() => handleStatusChange('award')}
            disabled={room.status !== 'live'}
            className="w-full py-3 rounded-lg flex items-center justify-center gap-2 font-bold transition-all disabled:opacity-50 disabled:bg-gray-700 disabled:text-gray-500 bg-purple-600 hover:bg-purple-500 text-white"
          >
            <Trophy className="w-5 h-5" />
            [시상식 시작]
          </button>

          <button 
            onClick={() => handleStatusChange('ended')}
            disabled={room.status === 'ended'}
            className="w-full py-3 rounded-lg flex items-center justify-center gap-2 font-bold transition-all disabled:opacity-50 disabled:bg-gray-700 disabled:text-gray-500 bg-red-600 hover:bg-red-500 text-white mt-4"
          >
            <Power className="w-5 h-5" />
            [파티 종료]
          </button>
        </section>

        {/* 부가 설정 */}
        <section className="bg-gray-800 rounded-xl p-4 space-y-4 shadow-lg">
          <h2 className="text-sm font-semibold text-gray-400 mb-2">부가 설정</h2>
          
          <div className="flex flex-col gap-2">
            <label className="text-sm text-gray-300">미션 톤 프리셋</label>
            <select 
              value={room.tonePreset}
              onChange={(e) => handlePresetChange(e.target.value as TonePreset)}
              className="bg-gray-900 border border-gray-700 rounded-lg p-2 text-white outline-none focus:border-blue-500"
            >
              <option value="icebreaking">아이스브레이킹 (Icebreaking)</option>
              <option value="casual">캐주얼 (Casual)</option>
              <option value="drinking">술자리 (Drinking)</option>
              <option value="workshop">워크샵 (Workshop)</option>
            </select>
          </div>

          <div className="flex items-center justify-between pt-2">
            <label className="text-sm text-gray-300 flex flex-col">
              <span>현장 리워드 (음료 교환권 등)</span>
              <span className="text-xs text-gray-500">활성화 시 게스트에게 노출됩니다.</span>
            </label>
            <button 
              onClick={toggleReward}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${room.rewardToggle ? 'bg-blue-600' : 'bg-gray-600'}`}
            >
              <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${room.rewardToggle ? 'translate-x-6' : 'translate-x-1'}`} />
            </button>
          </div>
        </section>

      </div>
    </div>
  );
}
