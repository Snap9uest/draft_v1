/* ─────────────────────────────────────────────
 * SnapQuest AI Types — 전 AI API 공용 타입 정의
 * ───────────────────────────────────────────── */

// ── F1: AI 캐릭터 프로필 ──
export interface AvatarRequest {
  nickname: string;
  /** Base64 데이터 URI (선택) */
  selfieBase64?: string;
  /** 셀카 대신 자기소개 3줄 */
  introLines?: string;
}

export interface AvatarResponse {
  /** 생성된 캐릭터 이미지 URL (Storage) 또는 data URI */
  avatarUrl: string;
  /** TV 로비 사회자 소개 멘트 */
  introMessage: string;
  /** 폴백 사용 여부 */
  isFallback: boolean;
}

// ── F2: AI 빙고판 ──
export interface BingoBoardRequest {
  /** 본인 프로필 */
  participant: { nickname: string; intro: string };
  /** 방 안의 다른 참가자/봇 프로필 */
  others: { nickname: string; intro: string }[];
  /** 톤 프리셋 */
  tonePreset: "친목" | "동아리" | "워크샵" | "파티" | string;
}

export interface BingoBoardResponse {
  /** 3×3 = 9개 미션 텍스트 */
  missions: string[];
  isFallback: boolean;
}

// ── F3: AI 비전 사진 인증 ──
export interface VerifyPhotoRequest {
  /** 미션 텍스트 */
  missionText: string;
  /** 업로드된 이미지 Base64 데이터 URI */
  imageBase64: string;
}

export interface VerifyPhotoResponse {
  /** 인증 통과 여부 */
  verified: boolean;
  /** 자동 한 줄 캡션 */
  caption: string;
  /** 판정 사유 (선택) */
  reason?: string;
  /** 수동 인증 폴백 사용 여부 */
  isFallback: boolean;
}

// ── F4: 사회자 리액션 ──
export interface McReactionRequest {
  nickname: string;
  missionText: string;
  caption: string;
}

export interface McReactionResponse {
  reaction: string;
  isFallback: boolean;
}

// ── F6: 칭호 배치 생성 ──
export interface TitlesRequest {
  participants: {
    id: string;
    nickname: string;
    completedMissions: string[];
    captions: string[];
  }[];
}

export interface TitleEntry {
  participantId: string;
  nickname: string;
  title: string;
  basis: string;
}

export interface TitlesResponse {
  titles: TitleEntry[];
  isFallback: boolean;
}
