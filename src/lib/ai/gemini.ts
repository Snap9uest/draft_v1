/**
 * Gemini AI Client — SnapQuest 공용 인스턴스
 *
 * 모든 AI API 라우트가 이 단일 클라이언트를 공유한다.
 * 환경변수 GEMINI_API_KEY (또는 GOOGLE_API_KEY) 를 읽는다.
 */
import { GoogleGenAI } from "@google/genai";

const apiKey = process.env.GEMINI_API_KEY ?? process.env.GOOGLE_API_KEY ?? "";

if (!apiKey) {
  console.warn(
    "[SnapQuest AI] ⚠ GEMINI_API_KEY / GOOGLE_API_KEY 가 설정되지 않았습니다. " +
      "AI 기능은 폴백(Fallback)으로 동작합니다."
  );
}

/** 공용 Gemini AI 클라이언트 */
export const ai = new GoogleGenAI({ apiKey });

/**
 * 텍스트 생성 기본 모델.
 * 3.7-flash 는 파티 시간대에 "high demand" 로 응답이 막히는 일이 잦아,
 * 즉답이 확인된 3.5-flash 를 쓴다.
 */
export const TEXT_MODEL = "gemini-3.5-flash";

/** 멀티모달(비전) 모델 */
export const VISION_MODEL = "gemini-3.5-flash";

/** 이미지 생성 모델 (캐릭터 일러스트) */
export const IMAGE_MODEL = "gemini-3.1-flash-image";

/**
 * 공용 AI 호출 타임아웃.
 * 참가자를 기다리게 두는 상한이므로 짧게 잡되, 이미지 생성은 텍스트보다
 * 오래 걸려 따로 둔다. 초과분은 호출자가 폴백으로 흡수한다.
 */
export const AI_TIMEOUT_MS = 20_000;
export const IMAGE_TIMEOUT_MS = 30_000;

/**
 * 타임아웃 래퍼 — AI 호출에 시간 제한을 건다.
 * 시간 초과 시 null 반환 → 호출자가 폴백 처리.
 */
export async function withTimeout<T>(
  promise: Promise<T>,
  ms: number = AI_TIMEOUT_MS
): Promise<T | null> {
  const timeout = new Promise<null>((resolve) =>
    setTimeout(() => resolve(null), ms)
  );
  return Promise.race([promise, timeout]);
}

/**
 * 텍스트 생성 폴백 체인.
 *
 * 실패의 대부분은 키나 프롬프트가 아니라 모델 과부하(503 "high demand")이고,
 * 그건 계정을 바꿔도 같이 막히므로 키를 늘리는 대신 다음 모델로 넘어간다.
 * 전부 실패하면 null — 호출자가 프리셋 폴백을 쓴다.
 */
const TEXT_MODEL_CHAIN = [TEXT_MODEL, "gemini-2.5-flash", "gemini-flash-latest"];

export async function generateText(
  contents: unknown,
  ms: number = AI_TIMEOUT_MS
): Promise<string | null> {
  for (const model of TEXT_MODEL_CHAIN) {
    try {
      const result = await withTimeout(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ai.models.generateContent({ model, contents } as any),
        ms
      );
      if (result?.text) return result.text;
    } catch (error) {
      console.warn(`[SnapQuest AI] ${model} 실패, 다음 모델로:`, error);
    }
  }
  return null;
}
