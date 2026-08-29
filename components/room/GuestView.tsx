import { Room } from '../../types/room';
import { useRoomSession } from '../../hooks/useRoomSession';

interface GuestViewProps {
  initialRoom: Room;
}

export function GuestView({ initialRoom }: GuestViewProps) {
  const { room } = useRoomSession(initialRoom);

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center p-6 text-gray-900">
      <div className="max-w-md w-full bg-white rounded-3xl shadow-xl p-8 text-center space-y-6">
        <h1 className="text-3xl font-bold text-indigo-900">SnapQuest</h1>
        
        <div className="bg-indigo-50 p-4 rounded-xl">
          <p className="text-indigo-800 font-medium mb-1">방 코드: {room.code}</p>
          <p className="text-sm text-indigo-600">
            상태: {
              room.status === 'lobby' ? '대기 중' : 
              room.status === 'live' ? '진행 중' : 
              room.status === 'award' ? '시상식' : '종료됨'
            }
          </p>
        </div>

        <div className="py-8">
          {room.status === 'lobby' && (
            <p className="text-xl font-medium text-gray-600 animate-pulse">
              파티가 곧 시작됩니다!
            </p>
          )}
          {room.status === 'live' && (
            <p className="text-xl font-medium text-green-600">
              파티 진행 중! 미션을 수행하세요.
            </p>
          )}
          {room.status === 'award' && (
            <p className="text-xl font-medium text-purple-600">
              시상식이 진행 중입니다!
            </p>
          )}
          {room.status === 'ended' && (
            <p className="text-xl font-medium text-gray-400">
              파티가 종료되었습니다.
            </p>
          )}
        </div>

        {/* 리워드 토글 비즈니스 규칙: rewardToggle이 true일 때만 문구 노출 */}
        {room.rewardToggle && (
          <div className="mt-4 p-4 bg-yellow-100 border border-yellow-300 rounded-xl">
            <p className="text-yellow-800 font-bold">🎁 현장 리워드가 활성화되었습니다!</p>
            <p className="text-yellow-700 text-sm mt-1">미션을 완료하고 음료 교환권을 받아가세요!</p>
          </div>
        )}
      </div>
    </div>
  );
}
