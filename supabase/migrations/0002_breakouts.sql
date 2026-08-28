-- Breakouts (LLP-80 / T-74)
-- Apply in the Supabase SQL editor or via `supabase db push`.

-- One breakout session per parent room; the room assignments live in `rooms`
-- as [{ index, name, roomId, members: [displayName] }].
create table if not exists public.breakouts (
  id             uuid primary key default gen_random_uuid(),
  parent_room_id text not null,
  status         text not null default 'open',   -- 'open' | 'closed'
  rooms          jsonb not null,
  timer_ends_at  timestamptz,
  created_by     text not null,                    -- host email
  created_at     timestamptz not null default now()
);

-- At most one active (open) breakout session per parent room.
create unique index if not exists breakouts_one_active_per_room
  on public.breakouts (parent_room_id) where status = 'open';

alter table public.breakouts enable row level security;

-- Participants may READ so they can find and join their assigned room.
drop policy if exists breakouts_select on public.breakouts;
create policy breakouts_select on public.breakouts for select using (true);

-- Writes (launch/close) go only through the service role in /api/live/breakouts.

-- Realtime so participants are notified the moment breakouts open or close.
alter publication supabase_realtime add table public.breakouts;
