/**
 * 보관 기간의 단일 출처 (티어다운 33 / P6).
 *
 * 티켓 각인·앨범 배너·정책 문구가 서로 다른 숫자를 말하지 않도록 일수와 포맷터를
 * 여기 하나에 둔다. Picapica 는 FAQ 와 Privacy Policy 가 정반대를 말하고 있었다.
 */

import { ddayLabel } from "./canvas/constants";

/** supabase/migrations/0001_init.sql 의 `rooms.expires_at` 기본값(now() + 7 days)과 같은 값. */
export const RETENTION_DAYS = 7;

/** 상단 배너를 띄우기 시작하는 잔여 일수. */
export const RETENTION_WARN_DAYS = 3;

export const RETENTION_NOTICE = `파티 사진과 티켓은 ${RETENTION_DAYS}일 동안 보관돼요.`;

export function toDate(v: string | Date | null | undefined): Date | null {
  if (v instanceof Date) return Number.isNaN(v.getTime()) ? null : v;
  if (typeof v !== "string" || !v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** 남은 일수. 이미 지났으면 0, 값이 없으면 null. */
export function daysLeft(
  expiresAt: string | Date | null | undefined,
  now: Date = new Date(),
): number | null {
  const d = toDate(expiresAt);
  if (!d) return null;
  return Math.max(0, Math.ceil((d.getTime() - now.getTime()) / 86_400_000));
}

/** 티켓 각인 2행과 **같은 문자열**. 화면 문구도 이 포맷터만 쓴다. */
export function retentionLabel(
  expiresAt: string | Date | null | undefined,
  now: Date = new Date(),
): string {
  return ddayLabel(toDate(expiresAt), now);
}
