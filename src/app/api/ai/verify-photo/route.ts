import { NextResponse } from "next/server";
import { ai, VISION_MODEL, withTimeout } from "@/lib/ai/gemini";
import type { VerifyPhotoRequest, VerifyPhotoResponse } from "@/lib/ai/types";
import { buildVerifyPhotoPrompt } from "@/lib/ai/prompts";
import { getFallbackCaption } from "@/lib/ai/fallbacks";

/**
 * Data URI에서 MIME 타입과 순수 Base64 데이터 문자열을 분리 및 정제합니다.
 *
 * @param imageBase64 - 'data:image/jpeg;base64,...' 형태의 URI 또는 순수 Base64 문자열
 * @returns 추출된 MIME 타입과 순수 Base64 문자열
 */
function extractBase64Data(imageBase64: string): {
  mimeType: string;
  pureBase64: string;
} {
  const matches = imageBase64.match(
    /^data:([a-zA-Z0-9]+\/[a-zA-Z0-9-.+]+);base64,([\s\S]+)$/
  );

  if (matches) {
    return {
      mimeType: matches[1],
      pureBase64: matches[2].trim(),
    };
  }

  // data: URI 스키마가 없는 경우 기본값 image/jpeg 적용
  return {
    mimeType: "image/jpeg",
    pureBase64: imageBase64.trim(),
  };
}

/**
 * AI 응답 텍스트에서 마크다운 코드 블록(```json ... ```)을 제거하고 순수 JSON 문자열을 추출합니다.
 *
 * @param text - Gemini 모델이 반환한 원본 텍스트
 * @returns 정제된 JSON 문자열
 */
function extractJson(text: string): string {
  const trimmed = text.trim();
  const jsonBlockRegex = /```(?:json)?\s*([\s\S]*?)\s*```/;
  const match = trimmed.match(jsonBlockRegex);

  if (match && match[1]) {
    return match[1].trim();
  }

  return trimmed;
}

/**
 * F3: AI 비전 사진 인증 + 자동 캡션 생성 API 라우트
 *
 * 참가자가 업로드한 사진이 빙고 미션에 부합하는지 비전 모델(Gemini 3.7 Flash)을 통해 검증하고,
 * 사진에 어울리는 위트 있는 한국어 한 줄 캡션을 자동 생성합니다.
 *
 * - AI 호출 타임아웃(15초) 또는 에러 발생 시 isFallback: true와 함께 수동 인증 모드로 안전하게 전환됩니다.
 */
export async function POST(request: Request): Promise<NextResponse> {
  try {
    const body = (await request.json().catch(() => null)) as Partial<VerifyPhotoRequest> | null;

    // 요청 바디 검증
    if (!body || !body.missionText || typeof body.missionText !== "string" || !body.imageBase64 || typeof body.imageBase64 !== "string") {
      return NextResponse.json(
        { error: "미션 텍스트(missionText)와 이미지 데이터(imageBase64)가 필요합니다." },
        { status: 400 }
      );
    }

    const { mimeType, pureBase64 } = extractBase64Data(body.imageBase64);
    const prompt = buildVerifyPhotoPrompt(body.missionText);

    // Gemini Vision 멀티모달 호출 (타임아웃 적용)
    const aiPromise = ai.models.generateContent({
      model: VISION_MODEL,
      contents: [
        { text: prompt },
        {
          inlineData: {
            mimeType,
            data: pureBase64,
          },
        },
      ],
    });

    const response = await withTimeout(aiPromise);

    // AI 응답 실패 또는 타임아웃 발생 시 폴백 반환
    if (!response || !response.text) {
      console.warn("[VerifyPhoto API] Gemini AI 응답 없음(타임아웃 등) → 폴백 모드로 전환");
      const fallbackResponse: VerifyPhotoResponse = {
        verified: false,
        caption: getFallbackCaption(),
        reason: "AI 응답 시간 초과로 인해 수동 확인이 필요합니다.",
        isFallback: true,
      };
      return NextResponse.json(fallbackResponse);
    }

    // JSON 파싱 및 데이터 검증
    const cleanedJson = extractJson(response.text);
    const parsed = JSON.parse(cleanedJson);

    if (typeof parsed.verified !== "boolean" || typeof parsed.caption !== "string") {
      throw new Error("AI 응답 데이터 형식이 올바르지 않습니다.");
    }

    const successResponse: VerifyPhotoResponse = {
      verified: parsed.verified,
      caption: parsed.caption,
      reason: typeof parsed.reason === "string" ? parsed.reason : undefined,
      isFallback: false,
    };

    return NextResponse.json(successResponse);
  } catch (error) {
    console.error("[VerifyPhoto API] 사진 인증 처리 중 오류 발생:", error);

    // 예외 발생 시 클라이언트 수동 인증을 위한 폴백 응답 반환
    const fallbackResponse: VerifyPhotoResponse = {
      verified: false,
      caption: getFallbackCaption(),
      reason: "사진 인증 처리 중 오류가 발생하여 수동 확인 모드로 전환되었습니다.",
      isFallback: true,
    };

    return NextResponse.json(fallbackResponse);
  }
}
