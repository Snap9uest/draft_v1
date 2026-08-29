-- `session_token` is a bearer credential: /api/photo, /api/vote and the
-- self-check branch of /api/photo/[id] all authorize on it alone. The anon key
-- ships in the browser bundle, so leaving the column selectable let anyone read
-- every guest's token out of `participants` and post as them.
--
-- Same treatment as rooms.host_token in 0001: revoke the one column, keep the
-- row readable. Clients that need their own row now go through
-- GET /api/room/[code]/me, which reads it with the service role.

revoke select (session_token) on participants from anon;
