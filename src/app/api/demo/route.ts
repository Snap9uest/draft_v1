import { NextResponse } from "next/server";
import { serverDb } from "@/lib/db/client";
import { getRoom } from "@/lib/db/server";

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
      await db.from("rooms").update({ status: "live", ended_at: null }).eq("id", room.id);
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
