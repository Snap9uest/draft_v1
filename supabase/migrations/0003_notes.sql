-- Guestbook notes.
--
-- The album already outlives the party; this is what makes it worth
-- reopening. A photo gets looked at once, but a note someone left you is a
-- reason to come back, which is the retention the album alone does not have.
--
-- A note can be addressed to one guest or to the room. Both live here: the
-- difference is whether `to_id` is set.

create table notes (
  id         uuid primary key default gen_random_uuid(),
  room_id    uuid not null references rooms(id) on delete cascade,
  from_id    uuid not null references participants(id) on delete cascade,
  -- null means the note is for the whole party rather than one person
  to_id      uuid references participants(id) on delete cascade,
  body       text not null check (char_length(body) between 1 and 300),
  -- one of a small preset set, picked in the UI; kept as text so adding a
  -- colour later needs no migration
  color      text not null default 'peach',
  hidden     boolean not null default false,
  created_at timestamptz not null default now()
);

create index notes_room_idx on notes (room_id, created_at desc);
create index notes_to_idx on notes (to_id);

alter publication supabase_realtime add table notes;

alter table notes enable row level security;

-- Reads go through the anon key like the rest of the album; writes go
-- through the route handler on the service role.
revoke all on notes from anon, authenticated;
grant select (id, room_id, from_id, to_id, body, color, hidden, created_at)
  on notes to anon, authenticated;
create policy "anon reads notes" on notes for select using (true);
