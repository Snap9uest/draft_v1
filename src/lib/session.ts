"use client";

const SESSION_KEY = "snapquest.session";
const hostKey = (roomCode: string) => `snapquest.host.${roomCode.toUpperCase()}`;

let memo = "";

/** 참가자 식별자. localStorage 가 막힌 브라우저에서는 탭 수명만큼만 유지된다. */
export function getSessionToken(): string {
  if (memo) return memo;
  try {
    memo = localStorage.getItem(SESSION_KEY) ?? "";
    if (!memo) {
      memo = crypto.randomUUID();
      localStorage.setItem(SESSION_KEY, memo);
    }
  } catch {
    memo = memo || crypto.randomUUID();
  }
  return memo;
}

export function getHostToken(roomCode: string): string | null {
  try {
    return localStorage.getItem(hostKey(roomCode));
  } catch {
    return null;
  }
}

export function setHostToken(roomCode: string, token: string): void {
  try {
    localStorage.setItem(hostKey(roomCode), token);
  } catch {
    // 시크릿 모드 등 — 호스트 권한은 이 탭에서만 유효하지 않게 되지만 막지는 않는다
  }
}
