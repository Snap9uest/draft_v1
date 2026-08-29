import Link from 'next/link';
import { Play, Tv, Smartphone, PlusCircle, Image as ImageIcon } from 'lucide-react';

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-6 bg-slate-950 text-white font-sans">
      <div className="max-w-md w-full text-center space-y-6">
        <div className="space-y-2">
          <span className="px-3 py-1 text-xs font-semibold bg-indigo-500/20 text-indigo-400 rounded-full border border-indigo-500/30">
            SnapQuest Live Test Center
          </span>
          <h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
            SnapQuest
          </h1>
          <p className="text-sm text-slate-400">
            [F9 호스트 진행 도구] &amp; [F4 라이브 포토월] 실시간 테스트
          </p>
        </div>

        <div className="grid gap-3 text-left">
          {/* F9: 방 생성 */}
          <Link
            href="/create"
            className="flex items-center gap-3 p-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 transition-all font-semibold shadow-lg shadow-indigo-500/20 border border-indigo-400/30 group"
          >
            <PlusCircle className="w-6 h-6 text-white group-hover:scale-110 transition-transform" />
            <div>
              <div className="text-white font-bold">[F9] 새 방 만들기 플로우</div>
              <div className="text-xs text-indigo-200">톤 선택 ➔ 3클릭 방 생성 ➔ 호스트 토큰 발급</div>
            </div>
          </Link>

          {/* F4: 라이브 포토월 제어 */}
          <Link
            href="/test-photowall"
            target="_blank"
            className="flex items-center gap-3 p-4 rounded-xl bg-purple-900/40 hover:bg-purple-900/60 transition-all border border-purple-500/40 hover:border-purple-400 group"
          >
            <ImageIcon className="w-6 h-6 text-purple-400 group-hover:scale-110 transition-transform" />
            <div>
              <div className="text-purple-200 font-bold">[F4] 라이브 포토월 사진 제어 테스트 📸</div>
              <div className="text-xs text-purple-300">사진 숨김/복구 토글, 필터, 테스트 사진 추가</div>
            </div>
          </Link>

          {/* F9: TV 대기/로비 */}
          <Link
            href="/room/demo-party?role=tv"
            target="_blank"
            className="flex items-center gap-3 p-4 rounded-xl bg-slate-900 hover:bg-slate-800 transition-all border border-slate-800 hover:border-slate-700 group"
          >
            <Tv className="w-6 h-6 text-indigo-400 group-hover:scale-110 transition-transform" />
            <div>
              <div className="text-slate-200 font-bold">[F9] TV 대형 로비 화면 (?role=tv)</div>
              <div className="text-xs text-slate-400">대형 QR 코드 및 6자리 입장 코드 표시 화면</div>
            </div>
          </Link>

          {/* F9: 호스트 컨트롤 */}
          <Link
            href="/room/demo-party?role=host"
            target="_blank"
            className="flex items-center gap-3 p-4 rounded-xl bg-slate-900 hover:bg-slate-800 transition-all border border-slate-800 hover:border-slate-700 group"
          >
            <Smartphone className="w-6 h-6 text-pink-400 group-hover:scale-110 transition-transform" />
            <div>
              <div className="text-slate-200 font-bold">[F9] 호스트 폰 조작 패널 (?role=host)</div>
              <div className="text-xs text-slate-400">파티 시작 / 시상식 / 종료 / 리워드 토글</div>
            </div>
          </Link>
        </div>

        <div className="p-3 rounded-lg bg-slate-900/60 border border-slate-800/80 text-xs text-slate-400 text-center">
          💡 메인 링크를 클릭하여 새 창으로 열면 바로 테스트할 수 있습니다!
        </div>
      </div>
    </main>
  );
}
