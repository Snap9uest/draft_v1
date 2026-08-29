import Link from 'next/link';
import { Play, Tv, Smartphone, PlusCircle } from 'lucide-react';

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-6 bg-slate-950 text-white font-sans">
      <div className="max-w-md w-full text-center space-y-6">
        <div className="space-y-2">
          <span className="px-3 py-1 text-xs font-semibold bg-indigo-500/20 text-indigo-400 rounded-full border border-indigo-500/30">
            SnapQuest Demo Dashboard
          </span>
          <h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
            SnapQuest
          </h1>
          <p className="text-sm text-slate-400">
            파티 포토 빙고 & 네컷 전리품 — 실시간 테스트 센터
          </p>
        </div>

        <div className="grid gap-3 text-left">
          <Link
            href="/create"
            className="flex items-center gap-3 p-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 transition-all font-semibold shadow-lg shadow-indigo-500/20 border border-indigo-400/30 group"
          >
            <PlusCircle className="w-6 h-6 text-white group-hover:scale-110 transition-transform" />
            <div>
              <div className="text-white font-bold">1. 방 생성 플로우 테스트 (F9)</div>
              <div className="text-xs text-indigo-200">톤 선택 ➔ 3클릭 방 생성 ➔ 호스트 토큰 발급</div>
            </div>
          </Link>

          <Link
            href="/room/demo-party?role=tv"
            target="_blank"
            className="flex items-center gap-3 p-4 rounded-xl bg-slate-900 hover:bg-slate-800 transition-all border border-slate-800 hover:border-slate-700 group"
          >
            <Tv className="w-6 h-6 text-purple-400 group-hover:scale-110 transition-transform" />
            <div>
              <div className="text-slate-200 font-bold">2. TV 대형 화면 뷰 열기 (?role=tv)</div>
              <div className="text-xs text-slate-400">빔프로젝터용 QR 코드 및 실시간 로비/포토월 화면</div>
            </div>
          </Link>

          <Link
            href="/room/demo-party?role=host"
            target="_blank"
            className="flex items-center gap-3 p-4 rounded-xl bg-slate-900 hover:bg-slate-800 transition-all border border-slate-800 hover:border-slate-700 group"
          >
            <Smartphone className="w-6 h-6 text-pink-400 group-hover:scale-110 transition-transform" />
            <div>
              <div className="text-slate-200 font-bold">3. 호스트 폰 컨트롤 뷰 열기 (?role=host)</div>
              <div className="text-xs text-slate-400">파티 시작 / 시상식 / 종료 / 사진 숨김 제어</div>
            </div>
          </Link>

          <Link
            href="/room/demo-party"
            target="_blank"
            className="flex items-center gap-3 p-4 rounded-xl bg-slate-900 hover:bg-slate-800 transition-all border border-slate-800 hover:border-slate-700 group"
          >
            <Play className="w-6 h-6 text-emerald-400 group-hover:scale-110 transition-transform" />
            <div>
              <div className="text-slate-200 font-bold">4. 게스트 플레이어 뷰 열기 (기본)</div>
              <div className="text-xs text-slate-400">게스트 입장 및 파티 대기실 화면</div>
            </div>
          </Link>
        </div>

        <div className="p-3 rounded-lg bg-slate-900/60 border border-slate-800/80 text-xs text-slate-500">
          💡 <strong>테스트 팁:</strong> TV 뷰와 호스트 뷰를 브라우저 창 2개로 나란히 띄우고 호스트 창에서 [파티 시작]을 눌러보세요!
        </div>
      </div>
    </main>
  );
}
