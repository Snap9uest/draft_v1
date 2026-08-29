import { NextResponse } from "next/server";
import { ai, IMAGE_MODEL, TEXT_MODEL, withTimeout } from "@/lib/ai/gemini";
import type { AvatarRequest, AvatarResponse } from "@/lib/ai/types";
import { AVATAR_CHARACTER_PROMPT, AVATAR_INTRO_PROMPT } from "@/lib/ai/prompts";
import {
  getRandomPresetAvatar,
  getDefaultIntroMessage,
} from "@/lib/ai/fallbacks";

/**
 * Base64 데이터 URI 문자열 파싱 헬퍼 함수
 * @param input data URI 또는 순수 Base64 문자열
 * @returns mimeType과 순수 base64 데이터
 */
function parseBase64(input: string): { mimeType: string; data: string } {
  const match = input.match(/^data:([^;]+);base64,(.+)$/);
  if (match) {
    return { mimeType: match[1], data: match[2] };
  }
  return { mimeType: "image/jpeg", data: input };
}

/**
 * F1: AI 캐릭터 프로필 및 MC 환영 멘트 생성 API Route
 *
 * 1. 셀카 사진(Base64) 또는 3줄 자기소개를 기반으로 2D 카툰 캐릭터 일러스트를 생성합니다.
 * 2. 닉네임과 자기소개를 기반으로 TV 로비용 위트 있는 한국어 MC 환영 멘트를 생성합니다.
 * 3. AI 호출 실패 또는 타임아웃 시 프리셋 아바타 및 기본 소개 멘트로 안전하게 폴백합니다.
 */
export async function POST(request: Request) {
  try {
    let body: Partial<AvatarRequest>;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: "올바른 JSON 요청 본문이 필요합니다." },
        { status: 400 }
      );
    }

    const nickname = body.nickname?.trim();
    if (!nickname) {
      return NextResponse.json(
        { error: "닉네임(nickname)은 필수 항목입니다." },
        { status: 400 }
      );
    }

    const introLines = body.introLines?.trim() || "";
    const selfieBase64 = body.selfieBase64?.trim() || "";

    // 1. 캐릭터 이미지 생성 프롬프트 및 컨텐츠 구성
    const imagePrompt = selfieBase64
      ? `${AVATAR_CHARACTER_PROMPT}\n\nUser Nickname: "${nickname}"\nSelf-Intro: "${
          introLines || "파티 참가자"
        }"\nPlease transform this selfie into a cute, vibrant 2D cartoon avatar character illustration.`
      : `${AVATAR_CHARACTER_PROMPT}\n\nUser Nickname: "${nickname}"\nSelf-Intro: "${
          introLines || "파티 참가자"
        }"\nPlease generate a cute, vibrant 2D cartoon avatar character illustration for this party guest.`;

    const imageContents = selfieBase64
      ? [
          { text: imagePrompt },
          {
            inlineData: parseBase64(selfieBase64),
          },
        ]
      : imagePrompt;

    // 2. 캐릭터 이미지 생성 및 MC 소개 멘트 동시 호출
    const [imageResult, introResult] = await Promise.all([
      // (1) 캐릭터 일러스트 생성
      (async (): Promise<string | null> => {
        try {
          const response = await withTimeout(
            ai.models.generateContent({
              model: IMAGE_MODEL,
              contents: imageContents,
              config: {
                responseModalities: ["image", "text"],
              },
            })
          );

          if (!response?.candidates?.[0]?.content?.parts) {
            return null;
          }

          for (const part of response.candidates[0].content.parts) {
            if (part.inlineData?.data) {
              const mimeType = part.inlineData.mimeType || "image/png";
              return `data:${mimeType};base64,${part.inlineData.data}`;
            }
          }

          return null;
        } catch (error) {
          console.error("[Avatar API] 이미지 생성 중 오류 발생:", error);
          return null;
        }
      })(),

      // (2) MC 소개 멘트 생성
      (async (): Promise<string | null> => {
        try {
          const response = await withTimeout(
            ai.models.generateContent({
              model: TEXT_MODEL,
              contents: `User Nickname: ${nickname}\nIntro: ${
                introLines || "새로운 파티 참가자"
              }`,
              config: {
                systemInstruction: AVATAR_INTRO_PROMPT,
              },
            })
          );

          const text = response?.text?.trim();
          return text && text.length > 0 ? text : null;
        } catch (error) {
          console.error("[Avatar API] MC 소개 멘트 생성 중 오류 발생:", error);
          return null;
        }
      })(),
    ]);

    // 3. 폴백 검사 및 응답 조합
    let isFallback = false;

    let avatarUrl = imageResult;
    if (!avatarUrl) {
      avatarUrl = getRandomPresetAvatar();
      isFallback = true;
    }

    let introMessage = introResult;
    if (!introMessage) {
      introMessage = getDefaultIntroMessage(nickname);
      isFallback = true;
    }

    const responseData: AvatarResponse = {
      avatarUrl,
      introMessage,
      isFallback,
    };

    return NextResponse.json(responseData, { status: 200 });
  } catch (error) {
    console.error("[Avatar API] 예외 발생:", error);

    const fallbackResponse: AvatarResponse = {
      avatarUrl: getRandomPresetAvatar(),
      introMessage: getDefaultIntroMessage("게스트"),
      isFallback: true,
    };

    return NextResponse.json(fallbackResponse, { status: 200 });
  }
}
