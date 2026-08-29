/**
 * [F2] AI 개인화 빙고판 생성 API
 *
 * 참가자 프로필을 크로스하여 각자 다른 3×3 사진 미션 빙고판을 생성한다.
 * 호출 규칙: 입장 시 1인당 1회 (9칸 일괄 생성)
 * 폴백: 프리셋 미션 풀에서 랜덤 조합
 */
import { NextResponse } from "next/server";
import { ai, TEXT_MODEL, withTimeout } from "@/lib/ai/gemini";
import type { BingoBoardRequest, BingoBoardResponse } from "@/lib/ai/types";
import { buildBingoBoardPrompt } from "@/lib/ai/prompts";
import { getFallbackMissions } from "@/lib/ai/fallbacks";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as BingoBoardRequest;

    // 입력 검증
    if (!body.participant?.nickname) {
      return NextResponse.json(
        { error: "participant.nickname은 필수입니다." },
        { status: 400 }
      );
    }

    const { participant, others = [], tonePreset = "친목" } = body;

    // 프롬프트 생성
    const prompt = buildBingoBoardPrompt(participant, others, tonePreset);

    // AI 호출 (타임아웃 적용)
    const result = await withTimeout(
      ai.models.generateContent({
        model: TEXT_MODEL,
        contents: prompt,
      })
    );

    if (result?.text) {
      try {
        // 마크다운 펜스 제거 후 JSON 파싱
        const cleaned = result.text
          .replace(/```(?:json)?\s*/g, "")
          .replace(/```\s*/g, "")
          .trim();

        const missions: string[] = JSON.parse(cleaned);

        // 정확히 9개인지 검증
        if (Array.isArray(missions) && missions.length >= 9) {
          const response: BingoBoardResponse = {
            missions: missions.slice(0, 9),
            isFallback: false,
          };
          return NextResponse.json(response);
        }

        // 9개 미만이면 폴백으로 패딩
        if (Array.isArray(missions) && missions.length > 0) {
          const fallbackPad = getFallbackMissions(
            tonePreset,
            others.map((o) => o.nickname)
          );
          const padded = [
            ...missions,
            ...fallbackPad.slice(0, 9 - missions.length),
          ].slice(0, 9);

          const response: BingoBoardResponse = {
            missions: padded,
            isFallback: false,
          };
          return NextResponse.json(response);
        }
      } catch {
        // JSON 파싱 실패 → 폴백
      }
    }

    // AI 실패 → 폴백
    const response: BingoBoardResponse = {
      missions: getFallbackMissions(
        tonePreset,
        others.map((o) => o.nickname)
      ),
      isFallback: true,
    };
    return NextResponse.json(response);
  } catch (error) {
    console.error("[F2 BingoBoard] Error:", error);

    const response: BingoBoardResponse = {
      missions: getFallbackMissions("친목", []),
      isFallback: true,
    };
    return NextResponse.json(response);
  }
}
