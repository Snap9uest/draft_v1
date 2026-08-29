-- Two bearer credentials live in these tables and both were readable with the
-- anon key that ships in the browser bundle:
--
--   rooms.host_token         — full host control of any party
--   participants.session_token — post photos and vote as any guest
--
-- 0001 tried `revoke select (host_token) on rooms from anon`, but that is a
-- no-op: Supabase grants table-wide SELECT on public tables to anon, and a
-- table-level grant satisfies every column, so a per-column revoke never bites.
-- Verified against the live project — the anon key still returned host_token.
--
-- The fix is to drop the table-wide grant first, then grant back exactly the
-- columns the browser reads. These two lists are ROOM_COLS and
-- PARTICIPANT_COLS in src/lib/db/client.ts; keep them in sync.
--
-- Clients that need their own participant row (formerly a
-- `.eq('session_token', …)` filter, which also needs the column privilege) now
-- go through GET /api/room/[code]/me, which reads it with the service role.

revoke select on rooms from anon, authenticated;
grant select (
  id, code, tone_preset, reward_on, status, state, is_demo,
  created_at, ended_at, expires_at
) on rooms to anon, authenticated;

revoke select on participants from anon, authenticated;
grant select (
  id, room_id, nickname, intro, avatar_url, avatar_is_ai, invited_by,
  is_bot, board, title, title_basis, ticket_url, ticket_frame, joined_at
) on participants to anon, authenticated;

-- ponytail: realtime payloads are not column-filtered by these grants. The
-- screens only use change events as a "refetch now" nudge, so nothing is read
-- off the payload today. Tighten with a publication column list
-- (`alter publication supabase_realtime set table rooms (…)`) if a screen ever
-- starts consuming the row it receives.
