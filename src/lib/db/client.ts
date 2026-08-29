import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const MISSING =
  "Supabase 환경변수가 없습니다. .env.local 에 NEXT_PUBLIC_SUPABASE_URL / " +
  "NEXT_PUBLIC_SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY 를 넣어주세요 (.env.example 참고).";

/** rooms 는 host_token 을 빼고 읽는다 (anon 은 그 컬럼 select 권한이 없다). */
export const ROOM_COLS =
  "id, code, tone_preset, reward_on, status, state, is_demo, created_at, ended_at, expires_at";

/** participants 는 남의 session_token 이 새지 않게 컬럼을 명시한다. */
export const PARTICIPANT_COLS =
  "id, room_id, nickname, intro, avatar_url, avatar_is_ai, invited_by, is_bot, board, title, title_basis, ticket_url, ticket_frame, joined_at";

let browser: SupabaseClient | null = null;

/** anon 키. 브라우저 읽기 전용. */
export function browserDb(): SupabaseClient {
  if (browser) return browser;
  // Next 는 정적 참조만 번들에 인라인한다 — process.env[name] 형태로 바꾸지 말 것.
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error(MISSING);
  browser = createClient(url, key);
  return browser;
}

let server: SupabaseClient | null = null;

/**
 * service role 키. 서버 라우트 전용.
 * NEXT_PUBLIC_ 접두사가 없어 클라이언트 번들에서는 undefined 로 치환된다 —
 * 이 파일이 클라이언트에 import 돼도 키 자체는 새지 않는다.
 */
export function serverDb(): SupabaseClient {
  if (server) return server;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error(MISSING);
  server = createClient(url, key, { auth: { persistSession: false } });
  return server;
}
