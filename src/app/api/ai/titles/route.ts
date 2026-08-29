import { NextResponse } from "next/server";
import { ai, TEXT_MODEL, withTimeout } from "@/lib/ai/gemini";
import { TitlesRequest, TitlesResponse, TitleEntry } from "@/lib/ai/types";
import { buildTitlesPrompt } from "@/lib/ai/prompts";
import { getFallbackTitles } from "@/lib/ai/fallbacks";

/**
 * F6: 칭호 배치 생성 API 라우트
 *
 * 파티 종료 시 모든 참가자의 활동 내역(완료한 미션, 캡션 등)을 기반으로
 * 각 참가자에게 고유하고 재미있는 시상 칭호(TitleEntry)를 일괄 생성합니다.
 *
 * Gemini AI 호출 실패 또는 타임아웃 발생 시 규칙 기반의 폴백 칭호를 반환합니다.
 *
 * @param request Next.js Request (Body: TitlesRequest)
 * @returns NextResponse<TitlesResponse | { error: string }>
 */
export async function POST(
  request: Request
): Promise<NextResponse<TitlesResponse | { error: string }>> {
  // 1. 요청 본문 파싱 및 유효성 검증
  let body: TitlesRequest;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "올바른 JSON 형식이 아닙니다." },
      { status: 400 }
    );
  }

  if (
    !body ||
    !Array.isArray(body.participants) ||
    body.participants.length === 0
  ) {
    return NextResponse.json(
      { error: "참가자 목록(participants)이 비어있거나 올바르지 않습니다." },
      { status: 400 }
    );
  }

  // 참가자 데이터 정규화 및 유효성 검사
  const participants = body.participants
    .filter((p) => p && typeof p.id === "string" && p.id.trim() !== "")
    .map((p) => ({
      id: p.id.trim(),
      nickname: (p.nickname || "참가자").trim(),
      completedMissions: Array.isArray(p.completedMissions)
        ? p.completedMissions.map((m) => String(m).trim()).filter(Boolean)
        : [],
      captions: Array.isArray(p.captions)
        ? p.captions.map((c) => String(c).trim()).filter(Boolean)
        : [],
    }));

  if (participants.length === 0) {
    return NextResponse.json(
      { error: "유효한 참가자 정보가 없습니다." },
      { status: 400 }
    );
  }

  // 2. 프롬프트 생성 및 AI 호출 (타임아웃 적용)
  try {
    const prompt = buildTitlesPrompt(participants);

    const response = await withTimeout(
      ai.models.generateContent({
        model: TEXT_MODEL,
        contents: prompt,
      })
    );

    // AI 호출 타임아웃 발생 시 폴백 반환
    if (!response || !response.text) {
      console.warn(
        "[SnapQuest AI Titles] AI 응답 타임아웃 또는 빈 응답 -> 폴백 사용"
      );
      return NextResponse.json({
        titles: getFallbackTitles(participants),
        isFallback: true,
      });
    }

    // 3. AI 응답 텍스트 정제 및 JSON 파싱
    const rawText = response.text.trim();
    let parsedJson: unknown;

    try {
      // 마크다운 코드 블록 제거 및 JSON 배열 추출
      const jsonMatch = rawText.match(/\[\s*\{[\s\S]*\}\s*\]/);
      const cleanedText = jsonMatch
        ? jsonMatch[0]
        : rawText
            .replace(/^```(?:json)?\s*/i, "")
            .replace(/\s*```$/, "")
            .trim();

      parsedJson = JSON.parse(cleanedText);
    } catch (parseError) {
      console.warn(
        "[SnapQuest AI Titles] JSON 파싱 실패 -> 폴백 사용:",
        parseError,
        rawText
      );
      return NextResponse.json({
        titles: getFallbackTitles(participants),
        isFallback: true,
      });
    }

    if (!Array.isArray(parsedJson) || parsedJson.length === 0) {
      console.warn(
        "[SnapQuest AI Titles] AI 응답 배열이 비어있음 -> 폴백 사용"
      );
      return NextResponse.json({
        titles: getFallbackTitles(participants),
        isFallback: true,
      });
    }

    // 4. 각 칭호 항목 유효성 검증 및 맵핑
    const titleMap = new Map<string, TitleEntry>();

    for (const item of parsedJson) {
      if (
        item &&
        typeof item === "object" &&
        typeof item.participantId === "string" &&
        typeof item.title === "string" &&
        item.participantId.trim() !== "" &&
        item.title.trim() !== ""
      ) {
        const participantId = item.participantId.trim();
        const nickname =
          typeof item.nickname === "string" && item.nickname.trim() !== ""
            ? item.nickname.trim()
            : participants.find((p) => p.id === participantId)?.nickname ||
              "참가자";
        const title = item.title.trim();
        const basis =
          typeof item.basis === "string" && item.basis.trim() !== ""
            ? item.basis.trim()
            : "파티에서의 활발한 참여";

        titleMap.set(participantId, {
          participantId,
          nickname,
          title,
          basis,
        });
      }
    }

    // 유효하게 파싱된 칭호가 하나도 없으면 폴백 반환
    if (titleMap.size === 0) {
      console.warn("[SnapQuest AI Titles] 유효한 칭호 항목 없음 -> 폴백 사용");
      return NextResponse.json({
        titles: getFallbackTitles(participants),
        isFallback: true,
      });
    }

    // 5. 누락된 참가자가 있는 경우 폴백 칭호로 보완
    const fallbackTitles = getFallbackTitles(participants);
    const fallbackMap = new Map(
      fallbackTitles.map((f) => [f.participantId, f])
    );

    const finalTitles: TitleEntry[] = participants.map((p) => {
      const existing = titleMap.get(p.id);
      if (existing) {
        return existing;
      }
      return (
        fallbackMap.get(p.id) ?? {
          participantId: p.id,
          nickname: p.nickname,
          title: "🎉 파티의 주인공",
          basis: "파티에 끝까지 함께 참여",
        }
      );
    });

    return NextResponse.json({
      titles: finalTitles,
      isFallback: false,
    });
  } catch (error) {
    console.error(
      "[SnapQuest AI Titles] 예기치 못한 에러 발생 -> 폴백 사용:",
      error
    );
    return NextResponse.json({
      titles: getFallbackTitles(participants),
      isFallback: true,
    });
  }
}
