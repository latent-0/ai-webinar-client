-- Room presence heartbeats (LLP-82 / T-76)
-- Powers the facilitator monitor grid: each client in a room heartbeats every
-- few seconds; the monitor reads recent heartbeats to show who's in each room
-- and how active it is. Apply via the Supabase SQL editor or `supabase db push`.

create table if not exists public.room_presence (
  room_id   text not null,
  identity  text not null,          -- participant display name
  last_seen timestamptz not null default now(),
  primary key (room_id, identity)
);

create index if not exists room_presence_room on public.room_presence (room_id, last_seen);

alter table public.room_presence enable row level security;

-- Readable so the monitor can render tiles; writes go through the service role
-- in /api/live/presence (heartbeats), never the client key directly.
drop policy if exists room_presence_select on public.room_presence;
create policy room_presence_select on public.room_presence for select using (true);
