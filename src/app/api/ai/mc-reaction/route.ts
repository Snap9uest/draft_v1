import { NextResponse } from "next/server";
import { ai, TEXT_MODEL, withTimeout } from "@/lib/ai/gemini";
import type { McReactionRequest, McReactionResponse } from "@/lib/ai/types";
import { buildMcReactionPrompt } from "@/lib/ai/prompts";
import { getFallbackReaction } from "@/lib/ai/fallbacks";

/**
 * F4: 사회자 리액션 멘트 생성 API 라우트
 *
 * 라이브 포토 월에 새로운 미션 인증 사진이 등록되었을 때,
 * 참가자 닉네임, 미션 텍스트, 사진 캡션을 기반으로
 * 재치 있고 에너지 넘치는 파티 사회자(MC)의 한 줄 리액션 멘트를 생성합니다.
 *
 * 타임아웃 또는 AI 에러 발생 시 사전 정의된 폴백 멘트를 반환합니다.
 *
 * @param request - McReactionRequest JSON 본문 (nickname, missionText, caption)
 * @returns NextResponse<McReactionResponse> - 생성된 리액션 멘트 및 폴백 여부
 */
export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Partial<McReactionRequest>;
    const { nickname, missionText = "", caption = "" } = body;

    if (!nickname || typeof nickname !== "string" || !nickname.trim()) {
      return NextResponse.json(
        { error: "nickname 필드가 필요합니다." },
        { status: 400 }
      );
    }

    const safeNickname = nickname.trim();
    const safeMissionText =
      typeof missionText === "string" ? missionText.trim() : "";
    const safeCaption = typeof caption === "string" ? caption.trim() : "";

    // 1. 프롬프트 생성
    const prompt = buildMcReactionPrompt(
      safeNickname,
      safeMissionText,
      safeCaption
    );

    try {
      // 2. Gemini 텍스트 모델 호출 (타임아웃 래핑)
      const aiResponse = await withTimeout(
        ai.models.generateContent({
          model: TEXT_MODEL,
          contents: prompt,
        })
      );

      const rawText = aiResponse?.text?.trim();

      if (rawText) {
        // 3. 모델이 출력한 양끝 따옴표 및 특수 따옴표 제거
        const cleaned = rawText
          .replace(/^["'“”‘’`「」『』]+|["'“”‘’`「」『』]+$/g, "")
          .trim();

        if (cleaned) {
          const responseData: McReactionResponse = {
            reaction: cleaned,
            isFallback: false,
          };
          return NextResponse.json(responseData);
        }
      }

      // 4. AI 응답이 비어있거나 타임아웃 시 폴백 적용
      const responseData: McReactionResponse = {
        reaction: getFallbackReaction(safeNickname),
        isFallback: true,
      };
      return NextResponse.json(responseData);
    } catch (aiError) {
      console.error("[MC Reaction API] Gemini API 호출 오류:", aiError);
      const responseData: McReactionResponse = {
        reaction: getFallbackReaction(safeNickname),
        isFallback: true,
      };
      return NextResponse.json(responseData);
    }
  } catch (error) {
    console.error("[MC Reaction API] 요청 파싱 오류:", error);
    return NextResponse.json(
      { error: "유효하지 않은 요청 본문입니다." },
      { status: 400 }
    );
  }
}
