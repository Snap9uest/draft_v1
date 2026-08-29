-- SnapQuest schema
--
-- Four tables. Anything 1:1 with a participant (bingo board, award title,
-- ending ticket) lives on `participants` as a column rather than its own table.
--
-- Writes go through Next.js route handlers using the service role key; the
-- browser holds the anon key and only reads. That is why the policies below
-- grant SELECT to anon and nothing else — with no login there is no JWT to
-- write a per-row policy against, so the trust boundary is the server, not RLS.

create extension if not exists "pgcrypto";

-- ── rooms ────────────────────────────────────────────────────────────────
create table rooms (
  id           uuid primary key default gen_random_uuid(),
  code         text unique not null,
  host_token   text not null,
  tone_preset  text not null default '친목',
  reward_on    boolean not null default false,
  status       text not null default 'lobby'
               check (status in ('lobby','live','award','ended')),
  -- Broadcast blob the TV and phones subscribe to: countdown state, current
  -- award step, anything transient that should not need its own table.
  state        jsonb not null default '{}'::jsonb,
  is_demo      boolean not null default false,
  created_at   timestamptz not null default now(),
  ended_at     timestamptz,
  expires_at   timestamptz not null default now() + interval '7 days'
);

create index rooms_code_idx on rooms (code);

-- ── participants ─────────────────────────────────────────────────────────
create table participants (
  id             uuid primary key default gen_random_uuid(),
  room_id        uuid not null references rooms(id) on delete cascade,
  nickname       text not null,
  intro          text not null default '',
  avatar_url     text,
  -- true once the generated illustration replaces the preset avatar
  avatar_is_ai   boolean not null default false,
  session_token  text not null,
  -- set when this guest arrived through another guest's invite link; the
  -- frame-unlock check and the K-factor metric both read this column
  invited_by     uuid references participants(id) on delete set null,
  is_bot         boolean not null default false,

  -- F2: nine missions. [{mission, status, photo_id, caption}]
  board          jsonb not null default '[]'::jsonb,
  -- F6
  title          text,
  title_basis    text,
  -- F7
  ticket_url     text,
  ticket_frame   text,

  joined_at      timestamptz not null default now()
);

create index participants_room_idx on participants (room_id);
create unique index participants_session_idx on participants (room_id, session_token);

-- ── photos ───────────────────────────────────────────────────────────────
create table photos (
  id            uuid primary key default gen_random_uuid(),
  room_id       uuid not null references rooms(id) on delete cascade,
  owner_id      uuid not null references participants(id) on delete cascade,
  -- 0-8 for a bingo mission, null for a free shot taken with the always-on
  -- camera button
  cell_index    int check (cell_index between 0 and 8),
  url           text not null,
  caption       text not null default '',
  mc_reaction   text,
  verify_status text not null default 'pending'
                check (verify_status in ('pending','ai_pass','self_check')),
  -- host hid it: drops off the photo wall and out of the album, both
  hidden        boolean not null default false,
  created_at    timestamptz not null default now()
);

create index photos_room_idx on photos (room_id, created_at desc);
create index photos_owner_idx on photos (owner_id);

-- ── votes ────────────────────────────────────────────────────────────────
create table votes (
  voter_id   uuid not null references participants(id) on delete cascade,
  photo_id   uuid not null references photos(id) on delete cascade,
  room_id    uuid not null references rooms(id) on delete cascade,
  created_at timestamptz not null default now(),
  -- one vote per guest
  primary key (voter_id)
);

create index votes_photo_idx on votes (photo_id);

-- ── realtime ─────────────────────────────────────────────────────────────
alter publication supabase_realtime add table rooms, participants, photos, votes;

-- ── RLS ──────────────────────────────────────────────────────────────────
alter table rooms        enable row level security;
alter table participants enable row level security;
alter table photos       enable row level security;
alter table votes        enable row level security;

create policy "anon reads rooms"        on rooms        for select using (true);
create policy "anon reads participants" on participants for select using (true);
create policy "anon reads photos"       on photos       for select using (true);
create policy "anon reads votes"        on votes        for select using (true);

-- host_token is the only secret in the schema and anon can read `rooms`, so
-- revoke that one column rather than hiding the whole row.
revoke select (host_token) on rooms from anon;

-- ── storage ──────────────────────────────────────────────────────────────
-- Public bucket: canvas ticket composition reads these images back with
-- crossOrigin="anonymous", which a signed URL would break.
insert into storage.buckets (id, name, public)
values ('photos', 'photos', true)
on conflict (id) do nothing;
