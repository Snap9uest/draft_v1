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

/** 텍스트 생성 기본 모델 */
export const TEXT_MODEL = "gemini-3.7-flash";

/** 멀티모달(비전) 모델 */
export const VISION_MODEL = "gemini-3.7-flash";

/** 이미지 생성 모델 (캐릭터 일러스트) */
export const IMAGE_MODEL = "gemini-3.1-flash-image-preview";

/** 공용 AI 호출 타임아웃 (ms) */
export const AI_TIMEOUT_MS = 15_000;

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
