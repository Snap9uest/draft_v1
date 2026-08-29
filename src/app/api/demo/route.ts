import { NextResponse } from "next/server";
import { getFallbackMissions } from "@/lib/ai/fallbacks";
import { placeholderPhoto, SEED_CAPTIONS } from "@/lib/bots";
import { serverDb } from "@/lib/db/client";
import { boardFrom, FALLBACK_BOTS, getRoom, presetAvatar } from "@/lib/db/server";

/**
 * GET /api/demo → `{code}`
 *
 * The demo room has a fixed code so a link to it never rots, and this route
 * rebuilds whatever is missing: the room, its bots, their boards, their
 * photos. Someone opening the demo alone has to land in a party already in
 * progress, not an empty room, and the previous visitor may have emptied it.
 */
export const DEMO_CODE = "DEMO01";

const HOST_TOKEN = "demo-host";
const TONE = "동아리";

export async function GET() {
  try {
    const db = serverDb();
    let room = await getRoom(DEMO_CODE);

    if (!room) {
      const { data, error } = await db
        .from("rooms")
        .insert({
          code: DEMO_CODE,
          host_token: HOST_TOKEN,
          tone_preset: TONE,
          status: "live",
          is_demo: true,
        })
        .select()
        .single();
      if (error) throw error;
      room = data;
    } else if (room.status === "ended") {
      // A visitor ended the party. Reopen it for the next one.
      await db.from("rooms").update({ status: "live", ended_at: null }).eq("id", room.id);
    }

    const { data: existing } = await db
      .from("participants")
      .select("id, nickname")
      .eq("room_id", room!.id);
    const have = new Set((existing ?? []).map((p) => p.nickname));

    const missing = FALLBACK_BOTS.filter((b) => !have.has(b.nickname));
    if (missing.length) {
      const others = FALLBACK_BOTS.map((b) => b.nickname);
      await db.from("participants").insert(
        missing.map((bot) => ({
          room_id: room!.id,
          nickname: bot.nickname,
          intro: bot.intro,
          avatar_url: presetAvatar(bot.nickname, bot.emoji),
          session_token: `demo-bot-${bot.nickname}`,
          is_bot: true,
          // Seeded per nickname, so each bot holds a different board — the
          // same promise the AI path makes.
          board: boardFrom(
            getFallbackMissions(TONE, others.filter((n) => n !== bot.nickname)),
          ),
        })),
      );
    }

    const { data: bots } = await db
      .from("participants")
      .select("id, nickname, board")
      .eq("room_id", room!.id)
      .eq("is_bot", true);

    const { count } = await db
      .from("photos")
      .select("id", { count: "exact", head: true })
      .eq("room_id", room!.id);

    // Enough photos that the wall reads as busy rather than as a first upload.
    if ((count ?? 0) < 6 && bots?.length) {
      const rows = bots.slice(0, 6).map((bot, i) => {
        const board = (bot.board ?? []) as { mission?: string }[];
        const emoji = FALLBACK_BOTS.find((b) => b.nickname === bot.nickname)?.emoji ?? "🎉";
        return {
          room_id: room!.id,
          owner_id: bot.id,
          cell_index: i % 9,
          url: placeholderPhoto(`${bot.nickname}-${i}`, emoji),
          caption: SEED_CAPTIONS[i % SEED_CAPTIONS.length],
          verify_status: "ai_pass" as const,
          mc_reaction: `${bot.nickname}님의 미션 인증! 분위기 살아나는데요 🔥`,
        };
      });
      await db.from("photos").insert(rows);

      // Mark the matching squares done so the boards agree with the wall.
      for (const [i, bot] of bots.slice(0, 6).entries()) {
        const board = ((bot.board ?? []) as { mission: string; status: string }[]).map(
          (cell, idx) => (idx === i % 9 ? { ...cell, status: "done" } : cell),
        );
        await db.from("participants").update({ board }).eq("id", bot.id);
      }
    }

    return NextResponse.json({ code: DEMO_CODE, hostToken: HOST_TOKEN });
  } catch (error) {
    console.error("[demo] 데모 방 준비 실패:", error);
    return NextResponse.json(
      { error: "데모 방을 준비하지 못했습니다." },
      { status: 500 },
    );
  }
}
