import { NextResponse } from "next/server";
import { serverDb } from "@/lib/db/client";
import { fail, hostRoom, str } from "@/lib/db/server";
import { cutProgress, readFourcut, startSession } from "@/lib/fourcut";

/**
 * POST /api/fourcut/start — 호스트 전용.
 * `{roomCode, hostToken}` → `{fourcut, progress, alreadyRunning}`
 *
 * 포즈는 프리셋에서 뽑는다 — 생성형 호출 0(원가 0, 실패 없음).
 */
export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const roomCode = str(body.roomCode).trim();
    if (!roomCode) return fail("방 코드가 없어요. 화면을 새로고침한 뒤 다시 눌러 주세요.");

    const room = await hostRoom(roomCode, body.hostToken);
    if (!room) return fail("이 기기에는 진행 권한이 없어요. 방을 만든 기기에서 열어 주세요.", 403);

    const now = new Date();

    // 두 번 눌러도 돌고 있는 판을 갈아엎지 않는다.
    const running = readFourcut(room.state);
    if (running && Date.parse(running.deadline) > now.getTime()) {
      return NextResponse.json({
        fourcut: running,
        progress: cutProgress(running, now),
        alreadyRunning: true,
      });
    }

    const fourcut = startSession(room.id, now);
    const { error } = await serverDb()
      .from("rooms")
      .update({ state: { ...(room.state ?? {}), fourcut } })
      .eq("id", room.id);
    if (error) return fail("네컷 타임을 시작하지 못했어요. 다시 눌러 주세요.", 500);

    return NextResponse.json({
      fourcut,
      progress: cutProgress(fourcut, now),
      alreadyRunning: false,
    });
  } catch (error) {
    return fail(
      error instanceof Error ? error.message : "네컷 타임을 시작하지 못했어요. 다시 눌러 주세요.",
      500,
    );
  }
}
