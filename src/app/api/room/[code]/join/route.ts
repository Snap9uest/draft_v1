import { after, NextResponse } from "next/server";
import { POST as generateAvatar } from "@/app/api/ai/avatar/route";
import { POST as generateBoard } from "@/app/api/ai/bingo-board/route";
import { getFallbackMissions } from "@/lib/ai/fallbacks";
import type { AvatarResponse, BingoBoardResponse } from "@/lib/ai/types";
import { PARTICIPANT_COLS, serverDb } from "@/lib/db/client";
import type { BoardCell } from "@/lib/db/types";
import {
  boardFrom,
  callAi,
  FALLBACK_BOTS,
  fail,
  getRoom,
  MAX_IMAGE_CHARS,
  presetAvatar,
  str,
  uploadImage,
} from "@/lib/db/server";

// 응답 뒤에 도는 아바타·빙고판 생성이 잘릴 여지를 준다.
export const maxDuration = 60;

/**
 * POST /api/room/[code]/join
 * `{nickname, intro?, selfieBase64?, sessionToken, invitedBy?}` → `{participant}`
 *
 * 프리셋 아바타 + 프리셋 9칸으로 즉시 응답하고, AI 결과는 after() 에서 덮어쓴다.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ code: string }> },
) {
  try {
    const { code } = await params;
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;

    const nickname = str(body.nickname).trim().slice(0, 20);
    if (!nickname) return fail("닉네임을 입력해 주세요.");
    const sessionToken = str(body.sessionToken).trim();
    if (!sessionToken || sessionToken.length > 64) {
      return fail("세션 토큰이 올바르지 않습니다.");
    }
    const intro = str(body.intro).trim().slice(0, 300);
    const selfieBase64 = str(body.selfieBase64).trim();
    if (selfieBase64.length > MAX_IMAGE_CHARS) {
      return fail("셀카 이미지가 너무 큽니다. 다시 촬영해 주세요.", 413);
    }
    const invitedBy = str(body.invitedBy).trim() || null;

    const room = await getRoom(code);
    if (!room) return fail("방을 찾을 수 없습니다.", 404);
    if (room.status === "ended") return fail("이미 종료된 파티입니다.", 409);

    const db = serverDb();

    // 재입장·중복 제출은 기존 참가자를 그대로 돌려준다 (session unique index).
    const { data: existing } = await db
      .from("participants")
      .select(PARTICIPANT_COLS)
      .eq("room_id", room.id)
      .eq("session_token", sessionToken)
      .maybeSingle();
    if (existing) return NextResponse.json({ participant: existing });

    // 빙고판 크로스 재료: 다른 참가자, 아무도 없으면 봇 프로필.
    const { data: others } = await db
      .from("participants")
      .select("nickname, intro")
      .eq("room_id", room.id)
      .limit(8);
    const cross: { nickname: string; intro: string }[] = others?.length
      ? others
      : FALLBACK_BOTS.map((b) => ({ nickname: b.nickname, intro: b.intro }));

    const { data: participant, error } = await db
      .from("participants")
      .insert({
        room_id: room.id,
        nickname,
        intro,
        session_token: sessionToken,
        avatar_url: presetAvatar(sessionToken),
        invited_by: invitedBy,
        board: boardFrom(
          getFallbackMissions(room.tone_preset, cross.map((o) => o.nickname)),
        ),
      })
      .select(PARTICIPANT_COLS)
      .single();
    if (error || !participant) {
      return fail(`입장에 실패했습니다: ${error?.message ?? "알 수 없는 오류"}`, 500);
    }

    const id = participant.id as string;
    after(async () => {
      await Promise.all([
        (async () => {
          const res = await callAi<AvatarResponse>(generateAvatar, {
            nickname,
            selfieBase64: selfieBase64 || undefined,
            introLines: intro || undefined,
          });
          // 폴백 아바타는 이미 넣어둔 프리셋보다 나을 게 없다.
          if (!res || res.isFallback || !res.avatarUrl.startsWith("data:image")) return;
          const url = await uploadImage(`avatars/${id}`, res.avatarUrl);
          if (url) {
            await db
              .from("participants")
              .update({ avatar_url: url, avatar_is_ai: true })
              .eq("id", id);
          }
        })(),
        (async () => {
          const res = await callAi<BingoBoardResponse>(generateBoard, {
            participant: { nickname, intro },
            others: cross,
            tonePreset: room.tone_preset,
          });
          if (!res || res.isFallback || res.missions.length < 9) return;
          const { data: fresh } = await db
            .from("participants")
            .select("board")
            .eq("id", id)
            .maybeSingle();
          // 이미 한 칸이라도 진행했으면 미션을 갈아치우지 않는다.
          const cur = (fresh?.board ?? []) as BoardCell[];
          if (cur.some((c) => c.status !== "todo")) return;
          await db
            .from("participants")
            .update({ board: boardFrom(res.missions) })
            .eq("id", id);
        })(),
      ]);
    });

    return NextResponse.json({ participant });
  } catch (error) {
    return fail(error instanceof Error ? error.message : "입장에 실패했습니다.", 500);
  }
}
