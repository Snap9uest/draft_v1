import { QRCodeSVG } from 'qrcode.react';
import { Room } from '../../types/room';
import { useEffect, useState } from 'react';
import { useRoomSession } from '../../hooks/useRoomSession';
import TvPhotoWall from '../photowall/TvPhotoWall';

interface TvLobbyViewProps {
  room: Room;
}

export function TvLobbyView({ room: initialRoom }: TvLobbyViewProps) {
  const { room } = useRoomSession(initialRoom);
  const [joinUrl, setJoinUrl] = useState('');

  useEffect(() => {
    // Generate URL only on client side to avoid hydration mismatch
    setJoinUrl(`${window.location.origin}/join/${room.code}`);
  }, [room.code]);

  if (room.status === 'live') {
    return <TvPhotoWall roomId={room.id} />;
  }

  if (room.status !== 'lobby') {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center text-white">
        <h1 className="text-5xl font-bold animate-pulse text-center leading-normal">
          {room.status === 'award' && '시상식이 진행 중입니다! 🏆'}
          {room.status === 'ended' && '파티가 종료되었습니다. 감사합니다! 🎉'}
        </h1>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-indigo-900 flex flex-col items-center justify-center text-white p-8">
      <div className="text-center mb-12">
        <h1 className="text-6xl font-extrabold mb-4 drop-shadow-lg tracking-tight">SnapQuest</h1>
        <p className="text-2xl text-indigo-200">카메라를 켜서 QR 코드를 스캔하고 파티에 참여하세요!</p>
      </div>

      <div className="flex flex-row items-center gap-16 bg-white/10 p-12 rounded-3xl backdrop-blur-sm border border-white/20 shadow-2xl">
        <div className="bg-white p-6 rounded-2xl shadow-xl">
          {joinUrl && (
            <QRCodeSVG 
              value={joinUrl}
              size={320}
              level="H"
              includeMargin={true}
              className="rounded-xl"
            />
          )}
        </div>

        <div className="flex flex-col items-center justify-center">
          <p className="text-3xl font-semibold mb-6 text-indigo-100">입장 코드</p>
          <div className="text-8xl font-black tracking-[0.2em] bg-white text-indigo-900 px-8 py-4 rounded-2xl shadow-inner mb-6">
            {room.code}
          </div>
          <p className="text-xl text-indigo-200 bg-black/20 px-6 py-3 rounded-full">
            직접 접속: <span className="font-mono ml-2">{joinUrl}</span>
          </p>
        </div>
      </div>
      
      <div className="mt-16 animate-bounce">
        <p className="text-2xl font-medium text-yellow-300 drop-shadow">
          호스트가 파티를 시작할 때까지 대기해주세요...
        </p>
      </div>
    </div>
  );
}
