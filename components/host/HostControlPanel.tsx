'use client';

import { useState } from 'react';
import { Room, RoomStatus, TonePreset } from '../../types/room';
import { Users, Play, Trophy, Power, Settings, ShieldCheck, ArrowRight } from 'lucide-react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useRoomSession } from '../../hooks/useRoomSession';
import { roomStorage } from '../../lib/room-storage';
import { usePhotoWall } from '../../hooks/usePhotoWall';
import HostPhotoWallControl from '../photowall/HostPhotoWallControl';
import { PhotoItem } from '../../types/photowall';

interface HostControlPanelProps {
  initialRoom: Room;
}

export function HostControlPanel({ initialRoom }: HostControlPanelProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token');
  
  const { room, changeStatus, updateTonePreset, toggleReward } = useRoomSession(initialRoom);
  const { photos, addPhoto, toggleHidePhoto } = usePhotoWall(room.id);

  const handleAddTestPhoto = () => {
    const newPhoto: PhotoItem = {
      id: crypto.randomUUID(),
      roomId: room.id,
      photoUrl: `https://picsum.photos/seed/${Math.random()}/400/600`,
      caption: '호스트가 추가한 테스트 사진입니다! 📸',
      participantName: '호스트(테스트)',
      participantAvatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${Math.random()}`,
      missionTitle: '자유 사진',
      timestamp: Date.now(),
      isHidden: false
    };
    addPhoto(newPhoto);
  };

  // Check token from URL query or localStorage
  const savedToken = roomStorage.getHostToken(room.id);
  const isValidHost = (token && token === room.hostToken) || (savedToken && savedToken === room.hostToken) || room.hostToken === 'dummy-token';

  // Demo auto-authenticate function
  const handleBypassAuth = () => {
    roomStorage.saveHostToken(room.id, room.hostToken);
    router.replace(`/room/${room.id}?role=host&token=${room.hostToken}`);
  };

  // token verification fallback UI
  if (!isValidHost) {
    return (
      <div className="flex flex-col items-center justify-center p-8 bg-gray-900 text-white min-h-screen text-center space-y-4">
        <div className="p-3 bg-red-500/20 rounded-full border border-red-500/30">
          <Settings className="w-8 h-8 text-red-400" />
        </div>
        <h2 className="text-2xl font-bold text-red-400">호스트 권한 필요</h2>
        <p className="text-sm text-gray-400 max-w-xs">
          이 방의 호스트 권한 토큰이 확인되지 않았습니다.
        </p>
        
        <div className="pt-4 flex flex-col gap-2 w-full max-w-xs">
          <button
            onClick={handleBypassAuth}
            className="w-full py-3 px-4 bg-indigo-600 hover:bg-indigo-500 rounded-xl font-bold text-white shadow-lg flex items-center justify-center gap-2 transition-all"
          >
            <ShieldCheck className="w-5 h-5" />
            [데모] 호스트 권한 획득하고 입장
          </button>
          
          <a
            href="/create"
            className="w-full py-3 px-4 bg-gray-800 hover:bg-gray-700 rounded-xl text-sm text-gray-300 flex items-center justify-center gap-1 transition-all"
          >
            새 방 직접 만들기 <ArrowRight className="w-4 h-4" />
          </a>
        </div>
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
    lobby: 'bg-blue-500/20 text-blue-400 border border-blue-500/30',
    live: 'bg-green-500/20 text-green-400 border border-green-500/30',
    award: 'bg-purple-500/20 text-purple-400 border border-purple-500/30',
    ended: 'bg-red-500/20 text-red-400 border border-red-500/30',
  }[room.status];

  const statusText = {
    lobby: '대기 중 (Lobby)',
    live: '진행 중 (Live)',
    award: '시상식 (Award)',
    ended: '종료됨 (Ended)',
  }[room.status];

  return (
    <div className="flex flex-col min-h-screen bg-gray-950 text-gray-100 max-w-md mx-auto relative shadow-2xl overflow-hidden border-x border-gray-800 font-sans">
      {/* Header */}
      <header className="p-4 border-b border-gray-800 bg-gray-900/90 backdrop-blur sticky top-0 z-10 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold flex items-center gap-2">
            호스트 컨트롤
            <a 
              href={`/room/${room.id}?role=tv`} 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-xs bg-indigo-600 hover:bg-indigo-500 text-white px-2.5 py-1 rounded-md font-semibold transition-colors shadow-sm"
            >
              TV 화면 열기 ↗
            </a>
          </h1>
          <div className="text-xs text-gray-400 mt-1">방 코드: <span className="text-indigo-400 font-mono font-bold text-sm tracking-wider">{room.code}</span></div>
        </div>
        <div className="flex flex-col items-end gap-1">
          <span className={`text-xs px-2.5 py-1 rounded-full font-semibold ${statusBadgeColor}`}>
            {statusText}
          </span>
          <div className="flex items-center text-xs text-gray-400">
            <Users className="w-3 h-3 mr-1 text-gray-400" />
            <span>참가자 0명</span>
          </div>
        </div>
      </header>

      {/* Body */}
      <div className="p-4 flex-1 space-y-6">
        
        {/* 생애주기 컨트롤 */}
        <section className="bg-gray-900 border border-gray-800 rounded-2xl p-5 space-y-3 shadow-xl">
          <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2 flex items-center">
            <Settings className="w-4 h-4 mr-1.5 text-indigo-400"/> 파티 진행 컨트롤
          </h2>
          
          <button 
            onClick={() => handleStatusChange('live')}
            disabled={room.status !== 'lobby'}
            className="w-full py-3.5 rounded-xl flex items-center justify-center gap-2 font-bold transition-all disabled:opacity-40 disabled:bg-gray-800 disabled:text-gray-500 bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-600/20"
          >
            <Play className="w-5 h-5 fill-current" />
            [파티 시작] (Live 포토월 오픈)
          </button>

          <button 
            onClick={() => handleStatusChange('award')}
            disabled={room.status !== 'live'}
            className="w-full py-3.5 rounded-xl flex items-center justify-center gap-2 font-bold transition-all disabled:opacity-40 disabled:bg-gray-800 disabled:text-gray-500 bg-purple-600 hover:bg-purple-500 text-white shadow-lg shadow-purple-600/20"
          >
            <Trophy className="w-5 h-5" />
            [시상식 시작] (칭호 발표 & 투표)
          </button>

          <button 
            onClick={() => handleStatusChange('ended')}
            disabled={room.status === 'ended'}
            className="w-full py-3.5 rounded-xl flex items-center justify-center gap-2 font-bold transition-all disabled:opacity-40 disabled:bg-gray-800 disabled:text-gray-500 bg-red-600/90 hover:bg-red-600 text-white mt-4 border border-red-500/30"
          >
            <Power className="w-5 h-5" />
            [파티 종료] (네컷 티켓 오픈)
          </button>
        </section>

        {/* 부가 설정 */}
        <section className="bg-gray-900 border border-gray-800 rounded-2xl p-5 space-y-4 shadow-xl">
          <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">파티 부가 설정</h2>
          
          <div className="flex flex-col gap-2">
            <label className="text-sm font-semibold text-gray-300">미션 톤 프리셋</label>
            <select 
              value={room.tonePreset}
              onChange={(e) => handlePresetChange(e.target.value as TonePreset)}
              className="bg-gray-950 border border-gray-700 rounded-xl p-3 text-white outline-none focus:border-indigo-500 text-sm font-medium"
            >
              <option value="icebreaking">🎉 아이스브레이킹 (처음 만나는 자리)</option>
              <option value="casual">☕ 캐주얼 (편안한 친구 모임)</option>
              <option value="drinking">🍺 술자리 (회식 및 파티)</option>
              <option value="workshop">💼 워크샵 (기업 팀빌딩)</option>
            </select>
          </div>

          <div className="flex items-center justify-between pt-3 border-t border-gray-800">
            <label className="text-sm text-gray-300 flex flex-col">
              <span className="font-semibold">현장 리워드 (음료 교환권 등)</span>
              <span className="text-xs text-gray-500">활성화 시 게스트 화면에 리워드 안내가 노출됩니다.</span>
            </label>
            <button 
              onClick={toggleReward}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${room.rewardToggle ? 'bg-indigo-600' : 'bg-gray-700'}`}
            >
              <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${room.rewardToggle ? 'translate-x-6' : 'translate-x-1'}`} />
            </button>
          </div>
        </section>

        {/* 포토월 컨트롤 (Live 이후에만 표시할 수도 있지만, 우선 항상 렌더링하거나 조건부로) */}
        {room.status !== 'lobby' && (
          <section className="mt-4">
            <HostPhotoWallControl 
              photos={photos}
              onToggleHide={toggleHidePhoto}
              onAddTestPhoto={handleAddTestPhoto}
            />
          </section>
        )}

      </div>
    </div>
  );
}
