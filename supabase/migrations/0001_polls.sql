-- Polls (LLP-74 / T-68)
-- Run in the Supabase SQL editor (or via `supabase db push`) for the project
-- whose keys are set in the app's env vars.

-- One poll per room at a time (open or revealed); closed polls are history.
create table if not exists public.polls (
  id          uuid primary key default gen_random_uuid(),
  room_id     text not null,
  question    text not null,
  options     jsonb not null,               -- [{ id, label }]
  status      text not null default 'open',  -- 'open' | 'revealed' | 'closed'
  created_by  text not null,                 -- email of the host who launched it
  results     jsonb,                         -- [{ optionId, count }] once revealed
  created_at  timestamptz not null default now(),
  revealed_at timestamptz
);

-- At most one active (non-closed) poll per room.
create unique index if not exists polls_one_active_per_room
  on public.polls (room_id) where status <> 'closed';

create table if not exists public.poll_votes (
  poll_id    uuid not null references public.polls (id) on delete cascade,
  voter      text not null,                  -- email; the PK enforces "vote once"
  option_id  text not null,
  created_at timestamptz not null default now(),
  primary key (poll_id, voter)
);

-- Row Level Security ---------------------------------------------------------
alter table public.polls enable row level security;
alter table public.poll_votes enable row level security;

-- Clients (anon/authenticated key) may READ polls so they can subscribe to
-- status/question/options and receive the results once the host reveals them.
drop policy if exists polls_select on public.polls;
create policy polls_select on public.polls for select using (true);

-- No client policies on poll_votes: raw votes are readable and writable ONLY
-- by the service role (used server-side in /api/live/poll). This is what stops
-- a participant from computing the tally before the host reveals it.

-- Realtime: broadcast poll row changes so participants see the reveal live.
alter publication supabase_realtime add table public.polls;
